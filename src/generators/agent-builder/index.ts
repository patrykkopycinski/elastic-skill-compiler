import type { PlatformGenerator } from '../types.js';
import type {
  GeneratorContext,
  GeneratorResult,
  GeneratedFile,
  ToolDefinition,
  ToolParameter,
} from '../../types.js';

export class AgentBuilderGenerator implements PlatformGenerator {
  readonly platform = 'agent-builder';

  async generate(ctx: GeneratorContext): Promise<GeneratorResult> {
    const files: GeneratedFile[] = [];
    const warnings: string[] = [];
    const { skill } = ctx;
    const abConfig = skill.extensions.agentBuilder;

    if (ctx.resolvedTools.length === 0) {
      warnings.push('No tool definitions found — Agent Builder output will be a stub.');
    }

    for (const tool of ctx.resolvedTools) {
      files.push({
        path: `tools/${tool.name}/schema.ts`,
        content: generateZodSchema(tool),
      });

      files.push({
        path: `tools/${tool.name}/handler.ts`,
        content: generateHandlerStub(tool),
      });
    }

    files.push({
      path: 'register.ts',
      content: generateRegistration(skill.name, skill.description, ctx.resolvedTools, abConfig),
    });

    files.push({
      path: 'index.ts',
      content: generateEntryPoint(ctx.resolvedTools),
    });

    return { platform: 'agent-builder', files, warnings };
  }
}

function generateZodSchema(tool: ToolDefinition): string {
  const lines: string[] = [];
  lines.push("import { z } from 'zod';");
  lines.push('');
  lines.push(`export const ${camelCase(tool.name)}Schema = z.object({`);

  for (const param of tool.parameters) {
    const zodType = paramToZod(param);
    const desc = param.description.replace(/'/g, "\\'");
    const optional = param.required === false ? '.optional()' : '';
    lines.push(`  ${param.name}: ${zodType}.describe('${desc}')${optional},`);
  }

  lines.push('});');
  lines.push('');
  lines.push(`export type ${pascalCase(tool.name)}Input = z.infer<typeof ${camelCase(tool.name)}Schema>;`);

  return lines.join('\n');
}

function generateHandlerStub(tool: ToolDefinition): string {
  const typeName = `${pascalCase(tool.name)}Input`;
  return `import type { ${typeName} } from './schema.js';

/**
 * Handler for ${tool.name}
 * ${tool.description}
 */
export async function handle${pascalCase(tool.name)}(input: ${typeName}): Promise<{ content: string }> {
  // TODO: Implement server-side handler
  throw new Error('Not implemented: ${tool.name}');
}
`;
}

function generateRegistration(
  skillName: string,
  description: string,
  tools: ToolDefinition[],
  abConfig?: { skillType?: string; category?: string; tags?: string[] },
): string {
  const lines: string[] = [];
  const skillType = abConfig?.skillType ?? pascalCase(skillName) + 'Skill';
  const category = abConfig?.category ?? 'custom';

  for (const tool of tools) {
    lines.push(`import { ${camelCase(tool.name)}Schema } from './tools/${tool.name}/schema.js';`);
    lines.push(`import { handle${pascalCase(tool.name)} } from './tools/${tool.name}/handler.js';`);
  }

  lines.push('');
  lines.push(`export function register${pascalCase(skillName)}() {`);
  lines.push(`  return {`);
  lines.push(`    name: '${skillName}',`);
  lines.push(`    description: \`${description.replace(/`/g, '\\`')}\`,`);
  lines.push(`    type: '${skillType}',`);
  lines.push(`    category: '${category}',`);
  if (abConfig?.tags) {
    lines.push(`    tags: ${JSON.stringify(abConfig.tags)},`);
  }
  lines.push(`    tools: {`);

  for (const tool of tools) {
    lines.push(`      '${tool.name}': {`);
    lines.push(`        schema: ${camelCase(tool.name)}Schema,`);
    lines.push(`        handler: handle${pascalCase(tool.name)},`);
    lines.push(`      },`);
  }

  lines.push(`    },`);
  lines.push(`  };`);
  lines.push(`}`);

  return lines.join('\n');
}

function generateEntryPoint(tools: ToolDefinition[]): string {
  const lines: string[] = [];
  lines.push("export { register } from './register.js';");
  for (const tool of tools) {
    lines.push(`export { ${camelCase(tool.name)}Schema } from './tools/${tool.name}/schema.js';`);
  }
  return lines.join('\n');
}

function paramToZod(param: ToolParameter): string {
  switch (param.type) {
    case 'string':
      if (param.enum) {
        const vals = param.enum.map((v) => `'${v}'`).join(', ');
        return `z.enum([${vals}])`;
      }
      return 'z.string()';
    case 'number':
      return 'z.number()';
    case 'boolean':
      return 'z.boolean()';
    case 'array':
      if (param.items) {
        const itemType = primitiveZod(param.items.type);
        return `z.array(${itemType})`;
      }
      return 'z.array(z.unknown())';
    case 'object':
      if (param.properties) {
        const fields = Object.entries(param.properties)
          .map(([key, val]) => {
            const zType = primitiveZod(val.type);
            const opt = val.required === false ? '.optional()' : '';
            return `    ${key}: ${zType}${opt}`;
          })
          .join(',\n');
        return `z.object({\n${fields}\n  })`;
      }
      return 'z.record(z.unknown())';
    default:
      return 'z.unknown()';
  }
}

function primitiveZod(type: string): string {
  switch (type) {
    case 'string': return 'z.string()';
    case 'number': return 'z.number()';
    case 'boolean': return 'z.boolean()';
    default: return 'z.unknown()';
  }
}

function camelCase(s: string): string {
  return s.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
}

function pascalCase(s: string): string {
  const camel = camelCase(s);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}
