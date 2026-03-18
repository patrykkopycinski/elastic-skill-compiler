import { stringify as toYaml } from 'yaml';
import type { SharedExpectation } from './index.js';

export function generateSandboxEvals(
  expectations: SharedExpectation[],
  extensions?: Record<string, unknown>,
): string {
  const tests = expectations.map((e) => ({
    name: `${e.scenarioId} | ${e.scenarioName}`,
    input: e.when,
    expected: {
      keywords: [e.then],
    },
    evaluators: ['keywords'],
  }));

  if (extensions) {
    for (const [scenarioId, ext] of Object.entries(extensions)) {
      const existing = tests.find((t) => t.name.startsWith(scenarioId));
      if (existing && typeof ext === 'object' && ext !== null) {
        Object.assign(existing, ext);
      } else {
        tests.push(ext as typeof tests[number]);
      }
    }
  }

  return toYaml(tests, { lineWidth: 0 });
}
