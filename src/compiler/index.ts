import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSkillSource } from '../parser/index.js';
import { loadSharedTools, resolveSharedToolRef } from './shared-tools.js';
import type { PlatformGenerator } from '../generators/types.js';
import type {
  CompilerOptions,
  CompilerResult,
  GeneratorContext,
  GeneratorResult,
  Platform,
  ToolDefinition,
} from '../types.js';

import { CursorGenerator } from '../generators/cursor/index.js';
import { ClaudeCodeGenerator } from '../generators/claude-code/index.js';
import { AgentBuilderGenerator } from '../generators/agent-builder/index.js';
import { McpServerGenerator } from '../generators/mcp-server/index.js';

const GENERATORS: Record<Platform, () => PlatformGenerator> = {
  cursor: () => new CursorGenerator(),
  'claude-code': () => new ClaudeCodeGenerator(),
  'agent-builder': () => new AgentBuilderGenerator(),
  'mcp-server': () => new McpServerGenerator(),
};

export async function compile(
  skillDir: string,
  options: CompilerOptions,
): Promise<CompilerResult> {
  const skill = await parseSkillSource(skillDir);

  const sharedTools = options.sharedToolsDir
    ? await loadSharedTools(options.sharedToolsDir)
    : new Map<string, ToolDefinition>();

  const resolvedTools = resolveTools(skill.extensions.tools ?? [], sharedTools);

  const results: GeneratorResult[] = [];
  const errors: string[] = [];

  for (const platform of options.platforms) {
    const generatorFn = GENERATORS[platform];
    if (!generatorFn) {
      errors.push(`Unknown platform: ${platform}`);
      continue;
    }

    const platformOutputDir = join(options.outputDir, platform);
    await mkdir(platformOutputDir, { recursive: true });

    const ctx: GeneratorContext = {
      skill,
      resolvedTools,
      outputDir: platformOutputDir,
      sharedToolsDir: options.sharedToolsDir,
    };

    try {
      const generator = generatorFn();
      const result = await generator.generate(ctx);
      results.push(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`[${platform}] ${message}`);
    }
  }

  return { skill, results, errors };
}

function resolveTools(
  tools: Array<ToolDefinition | string>,
  sharedTools: Map<string, ToolDefinition>,
): ToolDefinition[] {
  return tools.map((tool) => {
    if (typeof tool === 'string') {
      return resolveSharedToolRef(tool, sharedTools);
    }
    return tool;
  });
}
