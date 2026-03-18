import { describe, it, expect } from 'vitest';
import { SandboxGenerator } from './index.js';
import type { GeneratorContext, ParsedSkill, ToolDefinition } from '../../types.js';

const makeTool = (name: string): ToolDefinition => ({
  name,
  description: `Tool ${name}`,
  parameters: [
    { name: 'input', type: 'string', description: 'input value', required: true },
  ],
});

const makeSkill = (overrides?: Partial<ParsedSkill>): ParsedSkill => ({
  name: 'test-skill',
  description: 'A test skill',
  frontmatter: { name: 'test-skill', description: 'A test skill' },
  content: '# Test Skill\n\nDo things.',
  extensions: {},
  sourceDir: '/tmp/nonexistent-skill-dir',
  references: [],
  examples: [],
  scripts: [],
  tests: [],
  platformOverrides: new Map(),
  ...overrides,
});

const makeContext = (
  tools: ToolDefinition[] = [],
  skill?: Partial<ParsedSkill>,
): GeneratorContext => ({
  skill: makeSkill(skill),
  resolvedTools: tools,
  outputDir: '/tmp/out/sandbox',
});

describe('SandboxGenerator', () => {
  const generator = new SandboxGenerator();

  it('has platform = sandbox', () => {
    expect(generator.platform).toBe('sandbox');
  });

  it('produces SKILL.md in output files', async () => {
    const ctx = makeContext();
    const result = await generator.generate(ctx);
    const skillMd = result.files.find((f) => f.path === 'SKILL.md');
    expect(skillMd).toBeDefined();
    expect(skillMd!.content).toContain('# Test Skill');
  });

  it('generates scripts with shebang for each tool', async () => {
    const tools = [makeTool('query-es'), makeTool('list-indices')];
    const ctx = makeContext(tools);
    const result = await generator.generate(ctx);
    const scriptFiles = result.files.filter((f) => f.path.startsWith('scripts/'));
    expect(scriptFiles).toHaveLength(2);
    for (const script of scriptFiles) {
      expect(script.content).toMatch(/^#!\/usr\/bin\/env node/);
    }
  });

  it('warns on Kibana-native tool names (agentBuilder. prefix)', async () => {
    const ctx = makeContext([makeTool('agentBuilder.alerts.triage')]);
    const result = await generator.generate(ctx);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('agentBuilder.alerts.triage');
    expect(result.warnings[0]).toContain('incompatible');
  });

  it('warns on Kibana-native tool names (kibana. prefix)', async () => {
    const ctx = makeContext([makeTool('kibana.savedObjects.get')]);
    const result = await generator.generate(ctx);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('kibana.savedObjects.get');
  });

  it('does not warn on regular tool names', async () => {
    const ctx = makeContext([makeTool('search-alerts')]);
    const result = await generator.generate(ctx);
    expect(result.warnings).toHaveLength(0);
  });
});
