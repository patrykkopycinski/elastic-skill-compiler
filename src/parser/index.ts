import { readFile, readdir, access } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseSkillMarkdown } from './markdown.js';
import { parseSkillExtensions } from './skill-extensions.js';
import { parseToolDefinition } from './tool-schema.js';
import type { ParsedSkill, Platform, SkillExtensions, ToolDefinition } from '../types.js';

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir: string): Promise<string[]> {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { recursive: true });
  return entries.map(String);
}

async function readOptional(path: string): Promise<string | undefined> {
  if (!(await exists(path))) return undefined;
  return readFile(path, 'utf-8');
}

export async function parseSkillSource(skillDir: string): Promise<ParsedSkill> {
  const skillMdPath = join(skillDir, 'SKILL.md');
  const extensionsPath = join(skillDir, 'skill.extensions.yaml');

  const skillMdRaw = await readFile(skillMdPath, 'utf-8');
  const { frontmatter, content } = parseSkillMarkdown(skillMdRaw);

  let extensions: SkillExtensions = {};
  const extensionsRaw = await readOptional(extensionsPath);
  if (extensionsRaw) {
    extensions = parseSkillExtensions(extensionsRaw);
  }

  const agentsContent = await readOptional(join(skillDir, 'AGENTS.md'));
  const references = await listFiles(join(skillDir, 'references'));
  const examples = await listFiles(join(skillDir, 'examples'));
  const scripts = await listFiles(join(skillDir, 'scripts'));
  const tests = await listFiles(join(skillDir, 'tests'));

  const platformOverrides = new Map<Platform, string>();
  const platformsDir = join(skillDir, 'platforms');
  if (await exists(platformsDir)) {
    for (const platform of ['cursor', 'claude-code', 'agent-builder', 'mcp-server'] as Platform[]) {
      const extraContentPath = join(platformsDir, platform, 'extra-content.md');
      const extraContent = await readOptional(extraContentPath);
      if (extraContent) {
        platformOverrides.set(platform, extraContent);
      }
    }
  }

  const inlineTools = await resolveInlineTools(extensions, skillDir);

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    frontmatter,
    content,
    extensions: { ...extensions, tools: inlineTools },
    sourceDir: skillDir,
    agentsContent,
    references,
    examples,
    scripts,
    tests,
    platformOverrides,
  };
}

async function resolveInlineTools(
  extensions: SkillExtensions,
  skillDir: string,
): Promise<Array<ToolDefinition | string>> {
  if (!extensions.tools) return [];

  const resolved: Array<ToolDefinition | string> = [];
  for (const tool of extensions.tools) {
    if (typeof tool === 'string') {
      if (tool.endsWith('.yaml') || tool.endsWith('.yml')) {
        const toolPath = join(skillDir, tool);
        const raw = await readFile(toolPath, 'utf-8');
        resolved.push(parseToolDefinition(raw, relative(skillDir, toolPath)));
      } else {
        resolved.push(tool);
      }
    } else {
      resolved.push(tool);
    }
  }
  return resolved;
}
