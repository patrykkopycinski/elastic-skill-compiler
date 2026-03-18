import { createHash } from 'node:crypto';
import type { SkillRequirements } from './schemas/skill-requirements.js';

export interface ParsedScenario {
  id: string;
  skillId: string;
  requirementName: string;
  scenarioName: string;
  when: string;
  then: string;
  tags: string[];
}

export const generateScenarioId = (
  skillId: string,
  requirementName: string,
  scenarioName: string,
): string => {
  const input = `${skillId}::${requirementName}::${scenarioName}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
};

export const parseScenarios = (requirements: SkillRequirements): ParsedScenario[] => {
  const scenarios: ParsedScenario[] = [];

  for (const req of requirements.requirements) {
    for (const scenario of req.scenarios) {
      scenarios.push({
        id: generateScenarioId(requirements.id, req.name, scenario.name),
        skillId: requirements.id,
        requirementName: req.name,
        scenarioName: scenario.name,
        when: scenario.when,
        then: scenario.then,
        tags: scenario.tags ?? [],
      });
    }
  }

  return scenarios;
};
