import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { compile } from './index.js';

const fixturesDir = resolve(import.meta.dirname, '../../test-fixtures/sample-skill');
const securitySkillDir = resolve(import.meta.dirname, '../../skills/security-alert-triage');
const tmpOutDir = resolve(import.meta.dirname, '../../tmp-test-output');

describe('compile() integration', () => {
  it('compiles sample-skill for cursor platform', async () => {
    const result = await compile(fixturesDir, {
      platforms: ['cursor'],
      outputDir: resolve(tmpOutDir, 'cursor-test'),
    });

    expect(result.errors).toHaveLength(0);
    expect(result.skill.name).toBe('es-query');
    expect(result.results).toHaveLength(1);
    expect(result.results[0].platform).toBe('cursor');
    expect(result.results[0].files.length).toBeGreaterThan(0);
  });

  it('compiles sample-skill for agent-builder platform', async () => {
    const result = await compile(fixturesDir, {
      platforms: ['agent-builder'],
      outputDir: resolve(tmpOutDir, 'ab-test'),
    });

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].platform).toBe('agent-builder');
  });

  it('compiles security-alert-triage for sandbox', async () => {
    const result = await compile(securitySkillDir, {
      platforms: ['sandbox'],
      outputDir: resolve(tmpOutDir, 'sandbox-test'),
    });

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].platform).toBe('sandbox');
  });

  it('compiles security-alert-triage for kibana-agent-builder', async () => {
    const result = await compile(securitySkillDir, {
      platforms: ['kibana-agent-builder'],
      outputDir: resolve(tmpOutDir, 'kab-test'),
    });

    expect(result.errors).toHaveLength(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].platform).toBe('kibana-agent-builder');
  });

  it('records error for unknown platform', async () => {
    const result = await compile(fixturesDir, {
      platforms: ['not-a-platform' as never],
      outputDir: resolve(tmpOutDir, 'unknown-test'),
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Unknown platform');
  });
});
