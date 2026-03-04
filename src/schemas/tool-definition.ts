import { z } from 'zod';

const paramTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'array',
  'object',
]);

export const toolParameterSchema = z.object({
  name: z.string().min(1),
  type: paramTypeSchema,
  description: z.string().min(1),
  required: z.boolean().default(true),
  default: z.unknown().optional(),
  enum: z.array(z.string()).optional(),
  items: z.object({ type: z.string() }).optional(),
  properties: z
    .record(
      z.object({
        type: paramTypeSchema,
        description: z.string(),
        required: z.boolean().optional(),
        default: z.unknown().optional(),
        enum: z.array(z.string()).optional(),
      }),
    )
    .optional(),
});

export const toolDefinitionFileSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  parameters: z.array(toolParameterSchema),
  returns: z
    .object({
      type: z.string(),
      description: z.string(),
    })
    .optional(),
});

export type ToolDefinitionFile = z.infer<typeof toolDefinitionFileSchema>;
