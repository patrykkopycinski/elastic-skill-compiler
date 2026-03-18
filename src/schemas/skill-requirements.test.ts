import { describe, it, expect } from 'vitest';
import { skillRequirementsSchema } from './skill-requirements.js';

const validDoc = {
  id: 'test-skill',
  title: 'Test Skill',
  owners: ['team-a'],
  targets: ['agent-skills-sandbox'] as const,
  requirements: [
    {
      name: 'req-1',
      description: 'First requirement',
      scenarios: [{ name: 'scenario-1', when: 'user asks', then: 'skill responds' }],
    },
  ],
};

describe('skillRequirementsSchema', () => {
  it('parses a valid document', () => {
    const result = skillRequirementsSchema.safeParse(validDoc);
    expect(result.success).toBe(true);
  });

  it('fails when id is missing', () => {
    const { id: _, ...doc } = validDoc;
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails when title is missing', () => {
    const { title: _, ...doc } = validDoc;
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails when owners is missing', () => {
    const { owners: _, ...doc } = validDoc;
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails when targets is missing', () => {
    const { targets: _, ...doc } = validDoc;
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails with an empty owners array', () => {
    const doc = { ...validDoc, owners: [] };
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails with an empty targets array', () => {
    const doc = { ...validDoc, targets: [] };
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails with an invalid target enum value', () => {
    const doc = { ...validDoc, targets: ['not-a-real-target'] };
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('defaults parity to required', () => {
    const result = skillRequirementsSchema.parse(validDoc);
    expect(result.parity).toBe('required');
  });

  it('allows explicit parity = optional', () => {
    const result = skillRequirementsSchema.parse({ ...validDoc, parity: 'optional' });
    expect(result.parity).toBe('optional');
  });

  it('fails when requirements is empty', () => {
    const doc = { ...validDoc, requirements: [] };
    const result = skillRequirementsSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it('requires at least one scenario per requirement', () => {
    const doc = {
      ...validDoc,
      requirements: [{ name: 'r', description: 'd', scenarios: [] }],
    };
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails when scenario is missing name', () => {
    const doc = {
      ...validDoc,
      requirements: [
        { name: 'r', description: 'd', scenarios: [{ when: 'w', then: 't' }] },
      ],
    };
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails when scenario is missing when', () => {
    const doc = {
      ...validDoc,
      requirements: [
        { name: 'r', description: 'd', scenarios: [{ name: 's', then: 't' }] },
      ],
    };
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });

  it('fails when scenario is missing then', () => {
    const doc = {
      ...validDoc,
      requirements: [
        { name: 'r', description: 'd', scenarios: [{ name: 's', when: 'w' }] },
      ],
    };
    expect(skillRequirementsSchema.safeParse(doc).success).toBe(false);
  });
});
