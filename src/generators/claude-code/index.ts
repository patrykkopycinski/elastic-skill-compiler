import type { PlatformGenerator } from '../types.js';
import type { GeneratorContext, GeneratorResult, GeneratedFile } from '../../types.js';

export class ClaudeCodeGenerator implements PlatformGenerator {
  readonly platform = 'claude-code';

  async generate(ctx: GeneratorContext): Promise<GeneratorResult> {
    const files: GeneratedFile[] = [];
    const warnings: string[] = [];
    const { skill } = ctx;
    const ccOverrides = skill.extensions.platforms?.['claude-code'];

    files.push({
      path: '.claude-plugin/plugin.json',
      content: JSON.stringify(buildPluginManifest(skill.name, skill.description), null, 2),
    });

    files.push({
      path: `skills/${slugify(skill.name)}/SKILL.md`,
      content: buildClaudeCodeSkillMd(ctx),
    });

    if (skill.agentsContent) {
      files.push({
        path: 'AGENTS.md',
        content: skill.agentsContent,
      });
    }

    if (ctx.resolvedTools.length > 0) {
      files.push({
        path: '.mcp.json',
        content: JSON.stringify(buildMcpConfig(skill.name), null, 2),
      });
    }

    if (ccOverrides?.subagents) {
      for (const subagent of ccOverrides.subagents) {
        files.push({
          path: `subagents/${slugify(subagent.name)}.md`,
          content: buildSubagentFile(subagent),
        });
      }
    }

    return { platform: 'claude-code', files, warnings };
  }
}

function buildPluginManifest(name: string, description: string) {
  return {
    name: slugify(name),
    displayName: name,
    description,
    version: '0.1.0',
    skills: [`skills/${slugify(name)}/SKILL.md`],
  };
}

function buildClaudeCodeSkillMd(ctx: GeneratorContext): string {
  const { skill } = ctx;
  const lines: string[] = [];

  lines.push('---');
  lines.push(`name: ${skill.name}`);
  lines.push(`description: ${skill.description}`);
  if (skill.frontmatter.license) {
    lines.push(`license: ${skill.frontmatter.license}`);
  }
  lines.push('---');
  lines.push('');
  lines.push(skill.content);

  const platformExtra = skill.platformOverrides.get('claude-code');
  if (platformExtra) {
    lines.push('');
    lines.push(platformExtra);
  }

  if (ctx.resolvedTools.length > 0) {
    lines.push('');
    lines.push('## Tools');
    lines.push('');
    for (const tool of ctx.resolvedTools) {
      lines.push(`### ${tool.name}`);
      lines.push(tool.description);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildMcpConfig(skillName: string) {
  return {
    mcpServers: {
      [slugify(skillName)]: {
        command: 'node',
        args: ['dist/mcp-server.js'],
      },
    },
  };
}

function buildSubagentFile(subagent: {
  name: string;
  description: string;
  prompt: string;
}): string {
  return `---\nname: ${subagent.name}\ndescription: ${subagent.description}\n---\n\n${subagent.prompt}\n`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
