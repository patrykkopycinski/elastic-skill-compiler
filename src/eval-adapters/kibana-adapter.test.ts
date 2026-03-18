import { describe, it, expect } from 'vitest';
import { generateKibanaEvals } from './kibana-adapter.js';
import type { SharedExpectation } from './index.js';

const expectations: SharedExpectation[] = [
  {
    scenarioId: 'aaa111bbb222',
    skillId: 'test-skill',
    requirementName: 'req-1',
    scenarioName: 'scenario-x',
    when: 'user provides alert id',
    then: 'skill fetches alert details',
  },
  {
    scenarioId: 'ccc333ddd444',
    skillId: 'test-skill',
    requirementName: 'req-2',
    scenarioName: 'scenario-y',
    when: 'user asks for triage',
    then: 'skill classifies alert',
  },
];

describe('generateKibanaEvals', () => {
  it('produces valid TypeScript with evaluate blocks', () => {
    const output = generateKibanaEvals('test-skill', expectations);
    expect(output).toContain("import { evaluate } from '@kbn/evals';");
    expect(output).toContain("evaluate('scenario-x'");
    expect(output).toContain("evaluate('scenario-y'");
  });

  it('includes scenario IDs as comments', () => {
    const output = generateKibanaEvals('test-skill', expectations);
    expect(output).toContain('// aaa111bbb222: req-1 / scenario-x');
    expect(output).toContain('// ccc333ddd444: req-2 / scenario-y');
  });

  it('uses when/then from expectations', () => {
    const output = generateKibanaEvals('test-skill', expectations);
    expect(output).toContain('// when: user provides alert id');
    expect(output).toContain('// then: skill fetches alert details');
  });

  it('creates dataset names from skillId and scenarioId', () => {
    const output = generateKibanaEvals('test-skill', expectations);
    expect(output).toContain("name: 'test-skill-aaa111bbb222'");
  });

  it('adds extension evaluate blocks', () => {
    const extensions = {
      'extra-1': { name: 'bonus test' },
    };
    const output = generateKibanaEvals('test-skill', expectations, extensions);
    expect(output).toContain('// extension: extra-1');
    expect(output).toContain("evaluate('bonus test'");
  });
});
