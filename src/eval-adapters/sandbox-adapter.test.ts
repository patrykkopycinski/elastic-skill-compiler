import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { generateSandboxEvals } from './sandbox-adapter.js';
import type { SharedExpectation } from './index.js';

const expectations: SharedExpectation[] = [
  {
    scenarioId: 'abc123def456',
    skillId: 'test-skill',
    requirementName: 'req-1',
    scenarioName: 'scenario-a',
    when: 'user asks a question',
    then: 'skill returns answer',
  },
  {
    scenarioId: '789012345678',
    skillId: 'test-skill',
    requirementName: 'req-2',
    scenarioName: 'scenario-b',
    when: 'user provides data',
    then: 'skill processes it',
  },
];

describe('generateSandboxEvals', () => {
  it('produces valid YAML', () => {
    const yaml = generateSandboxEvals(expectations);
    const parsed = parseYaml(yaml);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('produces one test entry per expectation', () => {
    const yaml = generateSandboxEvals(expectations);
    const tests = parseYaml(yaml) as Array<Record<string, unknown>>;
    expect(tests).toHaveLength(2);
  });

  it('sets correct name, input, and keywords per entry', () => {
    const yaml = generateSandboxEvals(expectations);
    const tests = parseYaml(yaml) as Array<Record<string, unknown>>;
    expect(tests[0].name).toBe('abc123def456 | scenario-a');
    expect(tests[0].input).toBe('user asks a question');
    expect(tests[0].expected).toEqual({ keywords: ['skill returns answer'] });
    expect(tests[0].evaluators).toEqual(['keywords']);
  });

  it('merges extensions by scenarioId', () => {
    const extensions = {
      abc123def456: { timeout: 30 },
    };
    const yaml = generateSandboxEvals(expectations, extensions);
    const tests = parseYaml(yaml) as Array<Record<string, unknown>>;
    const merged = tests.find((t) => (t.name as string).startsWith('abc123def456'));
    expect(merged).toHaveProperty('timeout', 30);
  });

  it('appends unknown scenarioIds as extra tests', () => {
    const extensions = {
      unknown_id: { name: 'extra test', input: 'extra input', evaluators: ['keywords'] },
    };
    const yaml = generateSandboxEvals(expectations, extensions);
    const tests = parseYaml(yaml) as Array<Record<string, unknown>>;
    expect(tests).toHaveLength(3);
    expect(tests[2].name).toBe('extra test');
  });
});
