import { z } from 'zod';

const toolParameterSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    description: z.string(),
    required: z.boolean().optional(),
    default: z.unknown().optional(),
    enum: z.array(z.string()).optional(),
    items: z.object({ type: z.string() }).optional(),
    properties: z.record(z.any()).optional(),
  }),
);

const toolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.array(toolParameterSchema as z.ZodType),
  returns: z
    .object({
      type: z.string(),
      description: z.string(),
    })
    .optional(),
});

const platformOverridesSchema = z
  .object({
    cursor: z
      .object({
        rules: z.array(z.string()).optional(),
        extraContent: z.string().optional(),
        commands: z
          .array(z.object({ name: z.string(), description: z.string() }))
          .optional(),
        agents: z
          .array(z.object({ name: z.string(), file: z.string() }))
          .optional(),
        hooks: z.record(z.unknown()).optional(),
      })
      .optional(),
    'claude-code': z
      .object({
        extraContent: z.string().optional(),
        subagents: z
          .array(
            z.object({
              name: z.string(),
              description: z.string(),
              prompt: z.string(),
            }),
          )
          .optional(),
        hooks: z.record(z.unknown()).optional(),
      })
      .optional(),
    'agent-builder': z
      .object({
        skillType: z.string().optional(),
        category: z.string().optional(),
        handlerDir: z.string().optional(),
      })
      .optional(),
    'mcp-server': z
      .object({
        packageName: z.string().optional(),
        serverName: z.string().optional(),
        transport: z.enum(['stdio', 'http']).optional(),
      })
      .optional(),
  })
  .optional();

export const skillExtensionsSchema = z.object({
  tools: z
    .array(z.union([toolDefinitionSchema, z.string()]))
    .optional(),
  sharedTools: z.array(z.string()).optional(),
  platforms: platformOverridesSchema,
  agentBuilder: z
    .object({
      skillType: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
});

export type SkillExtensionsInput = z.input<typeof skillExtensionsSchema>;
