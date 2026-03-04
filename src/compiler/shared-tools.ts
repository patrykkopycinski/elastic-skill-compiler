import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { toolDefinitionFileSchema } from '../schemas/tool-definition.js';
import type { ToolDefinition } from '../types.js';

const sharedToolCache = new Map<string, ToolDefinition>();

export async function loadSharedTools(
  sharedToolsDir: string,
): Promise<Map<string, ToolDefinition>> {
  if (sharedToolCache.size > 0) return sharedToolCache;

  let entries: string[];
  try {
    entries = await readdir(sharedToolsDir);
  } catch {
    return sharedToolCache;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;

    const raw = await readFile(join(sharedToolsDir, entry), 'utf-8');
    const parsed = parseYaml(raw);
    const result = toolDefinitionFileSchema.safeParse(parsed);
    if (result.success) {
      sharedToolCache.set(result.data.name, result.data);
    }
  }

  return sharedToolCache;
}

export function resolveSharedToolRef(
  ref: string,
  sharedTools: Map<string, ToolDefinition>,
): ToolDefinition {
  const prefix = 'shared:';
  if (!ref.startsWith(prefix)) {
    throw new Error(`Invalid shared tool reference: ${ref}. Expected "shared:<tool-name>".`);
  }

  const toolName = ref.slice(prefix.length);
  const tool = sharedTools.get(toolName);
  if (!tool) {
    const available = [...sharedTools.keys()].join(', ');
    throw new Error(
      `Shared tool "${toolName}" not found. Available: ${available || '(none)'}`,
    );
  }

  return tool;
}
