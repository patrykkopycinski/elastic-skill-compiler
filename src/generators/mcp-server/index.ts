import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import type { PlatformGenerator } from '../types.js';
import type {
  GeneratorContext,
  GeneratorResult,
  GeneratedFile,
  ToolDefinition,
  ToolParameter,
} from '../../types.js';

export class McpServerGenerator implements PlatformGenerator {
  readonly platform = 'mcp-server';

  async generate(ctx: GeneratorContext): Promise<GeneratorResult> {
    const files: GeneratedFile[] = [];
    const warnings: string[] = [];
    const { skill } = ctx;
    const mcpConfig = skill.extensions.platforms?.['mcp-server'];

    const packageName = mcpConfig?.packageName ?? `@elastic/skill-${slugify(skill.name)}-mcp`;
    const serverName = mcpConfig?.serverName ?? slugify(skill.name);

    if (ctx.resolvedTools.length === 0) {
      warnings.push('No tool definitions — MCP server will have no tools registered.');
    }

    files.push({
      path: 'package.json',
      content: JSON.stringify(
        buildPackageJson(packageName, skill.description),
        null,
        2,
      ),
    });

    files.push({
      path: 'tsconfig.json',
      content: JSON.stringify(buildTsConfig(), null, 2),
    });

    files.push({
      path: 'src/index.ts',
      content: generateServerEntry(serverName, skill.description, ctx.resolvedTools),
    });

    for (const tool of ctx.resolvedTools) {
      const jsonSchema = toolToJsonSchema(tool);
      files.push({
        path: `src/tools/${tool.name}.ts`,
        content: generateToolHandler(tool, jsonSchema),
      });
    }

    return { platform: 'mcp-server', files, warnings };
  }
}

function buildPackageJson(name: string, description: string) {
  return {
    name,
    version: '0.1.0',
    description,
    type: 'module',
    main: 'dist/index.js',
    bin: { [name.replace('@elastic/', '')]: './dist/index.js' },
    scripts: {
      build: 'tsc',
      start: 'node dist/index.js',
    },
    dependencies: {
      '@modelcontextprotocol/sdk': '^1.0.0',
    },
    devDependencies: {
      '@types/node': '^22.0.0',
      typescript: '^5.8.0',
    },
  };
}

function buildTsConfig() {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      outDir: './dist',
      rootDir: './src',
      declaration: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src/**/*'],
  };
}

function generateServerEntry(
  serverName: string,
  description: string,
  tools: ToolDefinition[],
): string {
  const toolImports = tools
    .map((t) => `import { register${pascalCase(t.name)} } from './tools/${t.name}.js';`)
    .join('\n');

  const toolRegistrations = tools
    .map((t) => `register${pascalCase(t.name)}(server);`)
    .join('\n');

  return `#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
${toolImports}

const server = new McpServer({
  name: '${serverName}',
  version: '0.1.0',
  description: \`${description.replace(/`/g, '\\`')}\`,
});

${toolRegistrations}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
`;
}

function generateToolHandler(tool: ToolDefinition, jsonSchema: Record<string, unknown>): string {
  const paramEntries = tool.parameters
    .map((p) => `    ${p.name}: { type: '${p.type}', description: \`${p.description.replace(/`/g, '\\`')}\` }`)
    .join(',\n');

  return `import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const INPUT_SCHEMA = ${JSON.stringify(jsonSchema, null, 2)} as const;

export function register${pascalCase(tool.name)}(server: McpServer) {
  server.tool(
    '${tool.name}',
    \`${tool.description.replace(/`/g, '\\`')}\`,
    INPUT_SCHEMA.properties ? Object.fromEntries(
      Object.entries(INPUT_SCHEMA.properties).map(([key, val]) => [key, val as any])
    ) : {},
    async (params) => {
      // TODO: Implement tool logic
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ tool: '${tool.name}', params }) }],
      };
    },
  );
}
`;
}

function toolToJsonSchema(tool: ToolDefinition): Record<string, unknown> {
  const zodObj = buildZodFromParams(tool.parameters);
  return zodToJsonSchema(zodObj, { target: 'openApi3' }) as Record<string, unknown>;
}

function buildZodFromParams(params: ToolParameter[]): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    let field = paramToZodType(p);
    if (p.required === false) {
      field = field.optional();
    }
    shape[p.name] = field;
  }
  return z.object(shape);
}

function paramToZodType(param: ToolParameter): z.ZodTypeAny {
  switch (param.type) {
    case 'string':
      if (param.enum) return z.enum(param.enum as [string, ...string[]]);
      return z.string();
    case 'number':
      return z.number();
    case 'boolean':
      return z.boolean();
    case 'array':
      return z.array(z.unknown());
    case 'object':
      return z.record(z.unknown());
    default:
      return z.unknown();
  }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function pascalCase(s: string): string {
  return s
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^./, (c) => c.toUpperCase());
}
