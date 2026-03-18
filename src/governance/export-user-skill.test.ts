import { describe, it, expect } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { exportUserSkill } from './export-user-skill.js';

const skill = {
  id: 'user-skill-1',
  name: 'My Custom Skill',
  description: 'A user-created skill for testing',
  content: '# My Custom Skill\n\nWhen: user asks\nThen: skill answers',
};

describe('exportUserSkill', () => {
  it('produces valid YAML', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    expect(parsed).toBeDefined();
    expect(parsed.id).toBe('user-skill-1');
  });

  it('sets parity to required when specified', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    expect(parsed.parity).toBe('required');
  });

  it('sets parity to optional when specified', () => {
    const yaml = exportUserSkill(skill, 'optional');
    const parsed = parseYaml(yaml);
    expect(parsed.parity).toBe('optional');
  });

  it('sets owners to user-created', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    expect(parsed.owners).toEqual(['user-created']);
  });

  it('sets targets to kibana-agent-builder', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    expect(parsed.targets).toEqual(['kibana-agent-builder']);
  });

  it('extracts title from skill name', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    expect(parsed.title).toBe('My Custom Skill');
  });

  it('creates a requirement with a scenario', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    expect(parsed.requirements).toHaveLength(1);
    expect(parsed.requirements[0].scenarios).toHaveLength(1);
    expect(parsed.requirements[0].scenarios[0].when).toBeDefined();
    expect(parsed.requirements[0].scenarios[0].then).toBeDefined();
  });

  it('extracts when/then from content', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    const scenario = parsed.requirements[0].scenarios[0];
    expect(scenario.when).toBe('user asks');
    expect(scenario.then).toBe('skill answers');
  });

  it('uses heading as scenario name', () => {
    const yaml = exportUserSkill(skill, 'required');
    const parsed = parseYaml(yaml);
    expect(parsed.requirements[0].scenarios[0].name).toBe('My Custom Skill');
  });

  it('falls back to defaults for content without when/then patterns', () => {
    const bareSkill = { ...skill, content: '# Bare Skill\n\nJust a description.' };
    const yaml = exportUserSkill(bareSkill, 'required');
    const parsed = parseYaml(yaml);
    const scenario = parsed.requirements[0].scenarios[0];
    expect(scenario.when).toBe('User invokes the skill');
    expect(scenario.then).toBe('Skill produces expected output');
  });
});
