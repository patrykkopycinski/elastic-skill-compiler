import { parse as parseYaml } from 'yaml';
import { skillExtensionsSchema } from '../schemas/skill-extensions.js';
import type { SkillExtensions } from '../types.js';

export function parseSkillExtensions(raw: string): SkillExtensions {
  const parsed = parseYaml(raw);
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  const result = skillExtensionsSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid skill.extensions.yaml:\n${issues}`);
  }

  return result.data as SkillExtensions;
}
