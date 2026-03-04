import { parse as parseYaml } from 'yaml';
import { toolDefinitionFileSchema } from '../schemas/tool-definition.js';
import type { ToolDefinition } from '../types.js';

export function parseToolDefinition(raw: string, filePath: string): ToolDefinition {
  const parsed = parseYaml(raw);
  const result = toolDefinitionFileSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid tool definition ${filePath}:\n${issues}`);
  }

  return result.data;
}
