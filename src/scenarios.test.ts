import { describe, it, expect } from 'vitest';
import { generateScenarioId, parseScenarios } from './scenarios.js';
import type { SkillRequirements } from './schemas/skill-requirements.js';

describe('generateScenarioId', () => {
  it('returns a 12-char hex string', () => {
    const id = generateScenarioId('skill', 'req', 'scenario');
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('is deterministic', () => {
    const a = generateScenarioId('skill', 'req', 'scenario');
    const b = generateScenarioId('skill', 'req', 'scenario');
    expect(a).toBe(b);
  });

  it('produces different IDs for different inputs', () => {
    const a = generateScenarioId('skill', 'req', 'scenario-a');
    const b = generateScenarioId('skill', 'req', 'scenario-b');
    expect(a).not.toBe(b);
  });
});

describe('parseScenarios', () => {
  const requirements: SkillRequirements = {
    id: 'my-skill',
    title: 'My Skill',
    owners: ['team-x'],
    targets: ['agent-skills-sandbox'],
    parity: 'required',
    requirements: [
      {
        name: 'req-1',
        description: 'd1',
        scenarios: [
          { name: 's1', when: 'when-1', then: 'then-1', tags: ['fast'] },
          { name: 's2', when: 'when-2', then: 'then-2' },
        ],
      },
      {
        name: 'req-2',
        description: 'd2',
        scenarios: [
          { name: 's3', when: 'when-3', then: 'then-3' },
        ],
      },
    ],
  };

  it('flattens all scenarios', () => {
    const result = parseScenarios(requirements);
    expect(result).toHaveLength(3);
  });

  it('propagates skillId on every scenario', () => {
    const result = parseScenarios(requirements);
    expect(result.every((s) => s.skillId === 'my-skill')).toBe(true);
  });

  it('propagates requirementName', () => {
    const result = parseScenarios(requirements);
    expect(result[0].requirementName).toBe('req-1');
    expect(result[2].requirementName).toBe('req-2');
  });

  it('propagates scenarioName, when, then', () => {
    const result = parseScenarios(requirements);
    expect(result[0]).toMatchObject({
      scenarioName: 's1',
      when: 'when-1',
      then: 'then-1',
    });
  });

  it('propagates tags (defaulting to empty array)', () => {
    const result = parseScenarios(requirements);
    expect(result[0].tags).toEqual(['fast']);
    expect(result[1].tags).toEqual([]);
  });
});
