import { describe, it, expect } from 'vitest';
import { KibanaAgentBuilderGenerator } from './index.js';
import type { GeneratorContext, ParsedSkill, ToolDefinition } from '../../types.js';

const makeTool = (name: string): ToolDefinition => ({
  name,
  description: `Tool ${name}`,
  parameters: [
    { name: 'query', type: 'string', description: 'query string', required: true },
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
  outputDir: '/tmp/out/kibana-agent-builder',
});

describe('KibanaAgentBuilderGenerator', () => {
  const generator = new KibanaAgentBuilderGenerator();

  it('has platform = kibana-agent-builder', () => {
    expect(generator.platform).toBe('kibana-agent-builder');
  });

  it('produces register.ts with agentBuilder.skills.register()', async () => {
    const ctx = makeContext([makeTool('search-alerts')]);
    const result = await generator.generate(ctx);
    const registerFile = result.files.find((f) => f.path === 'register.ts');
    expect(registerFile).toBeDefined();
    expect(registerFile!.content).toContain('agentBuilder.skills.register(');
  });

  it('produces tool schema and handler files', async () => {
    const ctx = makeContext([makeTool('search-alerts')]);
    const result = await generator.generate(ctx);
    const schema = result.files.find((f) => f.path === 'tools/search-alerts/schema.ts');
    const handler = result.files.find((f) => f.path === 'tools/search-alerts/handler.ts');
    expect(schema).toBeDefined();
    expect(handler).toBeDefined();
    expect(schema!.content).toContain("import { z } from 'zod'");
  });

  it('warns on script-only tool names ending in .js', async () => {
    const ctx = makeContext([makeTool('run-query.js')]);
    const result = await generator.generate(ctx);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('run-query.js');
    expect(result.warnings[0]).toContain('incompatible');
  });

  it('warns on script-only tool names ending in .sh', async () => {
    const ctx = makeContext([makeTool('setup.sh')]);
    const result = await generator.generate(ctx);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('setup.sh');
  });

  it('does not warn on regular tool names', async () => {
    const ctx = makeContext([makeTool('search-alerts')]);
    const result = await generator.generate(ctx);
    expect(result.warnings).toHaveLength(0);
  });

  it('register.ts lists tool names', async () => {
    const ctx = makeContext([makeTool('tool-a'), makeTool('tool-b')]);
    const result = await generator.generate(ctx);
    const registerFile = result.files.find((f) => f.path === 'register.ts')!;
    expect(registerFile.content).toContain("'tool-a'");
    expect(registerFile.content).toContain("'tool-b'");
  });
});
