import type { SharedExpectation } from './index.js';

export function generateKibanaEvals(
  skillId: string,
  expectations: SharedExpectation[],
  extensions?: Record<string, unknown>,
): string {
  const blocks = expectations.map((e) => {
    const datasetName = `${skillId}-${e.scenarioId}`;
    return [
      `// ${e.scenarioId}: ${e.requirementName} / ${e.scenarioName}`,
      `evaluate('${escape(e.scenarioName)}', async ({ inferenceClient, executorClient }) => {`,
      `  const dataset = { name: '${escape(datasetName)}' };`,
      `  // when: ${e.when}`,
      `  // then: ${e.then}`,
      `  await executorClient.runExperiment({ dataset, task: async () => {} }, []);`,
      `});`,
    ].join('\n');
  });

  if (extensions) {
    for (const [id, ext] of Object.entries(extensions)) {
      if (typeof ext === 'object' && ext !== null && 'name' in ext) {
        const name = String((ext as Record<string, unknown>).name);
        blocks.push(
          [
            `// extension: ${id}`,
            `evaluate('${escape(name)}', async ({ inferenceClient, executorClient }) => {`,
            `  await executorClient.runExperiment({ dataset: { name: '${escape(id)}' }, task: async () => {} }, []);`,
            `});`,
          ].join('\n'),
        );
      }
    }
  }

  return [`import { evaluate } from '@kbn/evals';`, '', ...blocks, ''].join('\n');
}

function escape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
