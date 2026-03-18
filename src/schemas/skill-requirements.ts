import { z } from 'zod';

const targetSchema = z.enum(['agent-skills-sandbox', 'kibana-agent-builder']);

const inputFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean().optional(),
});

const outputFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1),
});

const requirementScenarioSchema = z.object({
  name: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

const requirementSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  scenarios: z.array(requirementScenarioSchema).min(1),
});

export const skillRequirementsSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  owners: z.array(z.string()).min(1),
  targets: z.array(targetSchema).min(1),
  parity: z.enum(['required', 'optional']).default('required'),
  inputs: z.array(inputFieldSchema).optional(),
  outputs: z.array(outputFieldSchema).optional(),
  requirements: z.array(requirementSchema),
  evalExtensions: z
    .object({
      'agent-skills-sandbox': z.record(z.string(), z.unknown()).optional(),
      'kibana-agent-builder': z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export type SkillRequirements = z.infer<typeof skillRequirementsSchema>;
export type RequirementScenario = z.infer<typeof requirementScenarioSchema>;
