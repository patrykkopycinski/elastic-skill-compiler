import { parseScenarios } from '../scenarios.js';
import type { SkillRequirements } from '../schemas/skill-requirements.js';

export interface SharedExpectation {
  scenarioId: string;
  skillId: string;
  requirementName: string;
  scenarioName: string;
  when: string;
  then: string;
  tags?: string[];
}

export function extractExpectations(requirements: SkillRequirements): SharedExpectation[] {
  return parseScenarios(requirements).map((s) => ({
    scenarioId: s.id,
    skillId: s.skillId,
    requirementName: s.requirementName,
    scenarioName: s.scenarioName,
    when: s.when,
    then: s.then,
    tags: s.tags.length > 0 ? s.tags : undefined,
  }));
}
