import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PlatformGenerator } from '../types.js';
import type {
  GeneratorContext,
  GeneratorResult,
  GeneratedFile,
  ToolDefinition,
  ToolParameter,
} from '../../types.js';
import { parseSkillRequirements } from '../../parser/skill-requirements.js';
import { parseScenarios, type ParsedScenario } from '../../scenarios.js';

const SCRIPT_ONLY_PATTERN = /\.(js|sh)$/;

export class KibanaAgentBuilderGenerator implements PlatformGenerator {
  readonly platform = 'kibana-agent-builder';

  async generate(ctx: GeneratorContext): Promise<GeneratorResult> {
    const files: GeneratedFile[] = [];
    const warnings: string[] = [];
    const { skill } = ctx;

    for (const tool of ctx.resolvedTools) {
      if (SCRIPT_ONLY_PATTERN.test(tool.name)) {
        warnings.push(
          `[kibana-agent-builder] Tool "${tool.name}" references a script-only pattern and is incompatible with Kibana Agent Builder.`,
        );
      }
    }

    files.push({
      path: 'register.ts',
      content: generateRegistration(skill, ctx.resolvedTools),
    });

    for (const tool of ctx.resolvedTools) {
      files.push({
        path: `tools/${tool.name}/schema.ts`,
        content: generateZodSchema(tool),
      });

      files.push({
        path: `tools/${tool.name}/handler.ts`,
        content: generateHandlerStub(tool),
      });
    }

    const scenarios = await loadScenarios(skill.sourceDir);
    if (scenarios.length > 0) {
      files.push({
        path: `evals/${slugify(skill.name)}.eval.ts`,
        content: generateEvalFile(scenarios),
      });
    }

    return { platform: 'kibana-agent-builder', files, warnings };
  }
}

const generateRegistration = (
  skill: GeneratorContext['skill'],
  tools: ToolDefinition[],
): string => {
  const toolNames = tools.map((t) => `'${t.name}'`).join(', ');
  const escapedContent = skill.content.replace(/`/g, '\\`').replace(/\$/g, '\\$');

  return `agentBuilder.skills.register({
  id: '${slugify(skill.name)}',
  name: '${skill.name}',
  basePath: 'skills/compiled',
  description: \`${skill.description.replace(/`/g, '\\`')}\`,
  content: \`${escapedContent}\`,
  getRegistryTools: () => [${toolNames}],
});
`;
};

const generateZodSchema = (tool: ToolDefinition): string => {
  const lines: string[] = [];
  lines.push("import { z } from 'zod';");
  lines.push('');
  lines.push(`export const ${camelCase(tool.name)}Schema = z.object({`);

  for (const param of tool.parameters) {
    const zodType = paramToZod(param);
    const desc = param.description.replace(/'/g, "\\'");
    const optional = param.required === false ? '.optional()' : '';
    lines.push(`  ${param.name}: ${zodType}.describe('${desc}')${optional},`);
  }

  lines.push('});');
  lines.push('');
  lines.push(
    `export type ${pascalCase(tool.name)}Input = z.infer<typeof ${camelCase(tool.name)}Schema>;`,
  );

  return lines.join('\n');
};

const generateHandlerStub = (tool: ToolDefinition): string => {
  const typeName = `${pascalCase(tool.name)}Input`;
  return `import type { ${typeName} } from './schema.js';

export async function handle${pascalCase(tool.name)}(input: ${typeName}): Promise<{ content: string }> {
  // TODO: Implement server-side handler
  throw new Error('Not implemented: ${tool.name}');
}
`;
};

const generateEvalFile = (scenarios: ParsedScenario[]): string => {
  const lines: string[] = [];
  lines.push("import { evaluate } from '@kbn/evals';");
  lines.push('');

  for (const scenario of scenarios) {
    const escapedName = scenario.scenarioName.replace(/'/g, "\\'");
    const escapedWhen = scenario.when.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const escapedThen = scenario.then.replace(/`/g, '\\`').replace(/\$/g, '\\$');

    lines.push(`// scenario-id: ${scenario.id}`);
    lines.push(`evaluate('${escapedName}', async ({ inferenceClient, executorClient }) => {`);
    lines.push(`  const input = \`${escapedWhen}\`;`);
    lines.push(`  const expected = \`${escapedThen}\`;`);
    lines.push('  // TODO: Implement scenario evaluation using inferenceClient and executorClient');
    lines.push(`  throw new Error('Not implemented: ${escapedName}');`);
    lines.push('});');
    lines.push('');
  }

  return lines.join('\n');
};

const paramToZod = (param: ToolParameter): string => {
  switch (param.type) {
    case 'string':
      if (param.enum) {
        const vals = param.enum.map((v) => `'${v}'`).join(', ');
        return `z.enum([${vals}])`;
      }
      return 'z.string()';
    case 'number':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'array':
      if (param.items) {
        const itemType = primitiveZod(param.items.type);
        return `z.array(${itemType})`;
      }
      return 'z.array(z.unknown())';
    case 'object':
      if (param.properties) {
        const fields = Object.entries(param.properties)
          .map(([key, val]) => {
            const zType = primitiveZod(val.type);
            const opt = val.required === false ? '.optional()' : '';
            return `    ${key}: ${zType}${opt}`;
          })
          .join(',\n');
        return `z.object({\n${fields}\n  })`;
      }
      return 'z.record(z.unknown())';
    default:
      return 'z.unknown()';
  }
};

const primitiveZod = (type: string): string => {
  switch (type) {
    case 'string':
      return 'z.string()';
    case 'number':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    default:
      return 'z.unknown()';
  }
};

const camelCase = (s: string): string => s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());

const pascalCase = (s: string): string => {
  const camel = camelCase(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
};

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const loadScenarios = async (sourceDir: string): Promise<ParsedScenario[]> => {
  try {
    const raw = await readFile(join(sourceDir, 'skill.requirements.yaml'), 'utf-8');
    const requirements = parseSkillRequirements(raw);
    return parseScenarios(requirements);
  } catch {
    return [];
  }
};
