import { parse as parseYaml } from 'yaml';
import { skillRequirementsSchema } from '../schemas/skill-requirements.js';
import type { SkillRequirements } from '../schemas/skill-requirements.js';

export function parseSkillRequirements(raw: string): SkillRequirements {
  const parsed = parseYaml(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid skill.requirements.yaml: expected a YAML object');
  }

  const result = skillRequirementsSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid skill.requirements.yaml:\n${issues}`);
  }

  return result.data;
}
