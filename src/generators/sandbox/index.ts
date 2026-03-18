import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlatformGenerator } from '../types.js';
import type {
  GeneratorContext,
  GeneratorResult,
  GeneratedFile,
  ToolDefinition,
} from '../../types.js';
import { parseSkillRequirements } from '../../parser/skill-requirements.js';
import { parseScenarios, type ParsedScenario } from '../../scenarios.js';

const KIBANA_NATIVE_PREFIXES = ['agentBuilder.', 'kibana.'];

export class SandboxGenerator implements PlatformGenerator {
  readonly platform = 'sandbox';

  async generate(ctx: GeneratorContext): Promise<GeneratorResult> {
    const files: GeneratedFile[] = [];
    const warnings: string[] = [];
    const { skill } = ctx;

    for (const tool of ctx.resolvedTools) {
      if (KIBANA_NATIVE_PREFIXES.some((prefix) => tool.name.startsWith(prefix))) {
        warnings.push(
          `[sandbox] Tool "${tool.name}" references a Kibana-native tool name pattern and is incompatible with agent-skills-sandbox.`,
        );
      }
    }

    files.push({
      path: 'SKILL.md',
      content: skill.content,
    });

    for (const tool of ctx.resolvedTools) {
      files.push({
        path: `scripts/${tool.name}.js`,
        content: generateNodeScript(tool),
      });
    }

    const scenarios = await loadScenarios(skill.sourceDir);
    if (scenarios.length > 0) {
      files.push({
        path: 'evals/plugin-eval.yaml',
        content: generatePluginEvalYaml(skill.name, scenarios),
      });
    }

    return { platform: 'sandbox', files, warnings };
  }
}

const generateNodeScript = (tool: ToolDefinition): string => {
  const paramParsing = tool.parameters
    .map((p, i) => {
      const fallback = p.default !== undefined ? JSON.stringify(p.default) : 'undefined';
      return `  const ${p.name} = args[${i}] ?? ${fallback};`;
    })
    .join('\n');

  const paramNames = tool.parameters.map((p) => p.name).join(', ');

  return `#!/usr/bin/env node
import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: process.env.ES_URL ?? 'http://localhost:9200',
  auth: process.env.ES_API_KEY
    ? { apiKey: process.env.ES_API_KEY }
    : { username: process.env.ES_USERNAME ?? 'elastic', password: process.env.ES_PASSWORD ?? 'changeme' },
});

const args = process.argv.slice(2);
${paramParsing}

async function run(${paramNames}) {
  // TODO: Implement ${tool.name} handler
  throw new Error('Not implemented: ${tool.name}');
}

run(${paramNames}).then(
  (result) => { console.log(JSON.stringify(result, null, 2)); },
  (err) => { console.error(err); process.exitCode = 1; },
);
`;
};

const generatePluginEvalYaml = (skillName: string, scenarios: ParsedScenario[]): string => {
  const lines: string[] = [];
  lines.push(`suite: ${skillName}`);
  lines.push('tests:');

  for (const scenario of scenarios) {
    lines.push(`  # scenario-id: ${scenario.id}`);
    lines.push(`  - name: ${yamlEscape(scenario.scenarioName)}`);
    lines.push(`    input: ${yamlEscape(scenario.when)}`);
    lines.push('    assertions:');
    lines.push('      - type: keywords');
    lines.push(`        keywords:`);
    for (const keyword of extractKeywords(scenario.then)) {
      lines.push(`          - ${yamlEscape(keyword)}`);
    }
  }

  return lines.join('\n') + '\n';
};

const extractKeywords = (thenClause: string): string[] => {
  const words = thenClause
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  return [...new Set(words)].slice(0, 10);
};

const yamlEscape = (value: string): string => {
  if (/[:{}\[\],&*?|>!%#@`'"]/.test(value) || value.includes('\n')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  }
  return value;
};

const loadScenarios = async (sourceDir: string): Promise<ParsedScenario[]> => {
  try {
    const raw = await readFile(join(sourceDir, 'skill.requirements.yaml'), 'utf-8');
    const requirements = parseSkillRequirements(raw);
    return parseScenarios(requirements);
  } catch {
    return [];
  }
};
