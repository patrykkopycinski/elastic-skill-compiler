import matter from 'gray-matter';
import type { SkillFrontmatter } from '../types.js';

export interface ParsedMarkdown {
  frontmatter: SkillFrontmatter;
  content: string;
}

export function parseSkillMarkdown(raw: string): ParsedMarkdown {
  const { data, content } = matter(raw);

  const frontmatter: SkillFrontmatter = {
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    license: data.license ? String(data.license) : undefined,
    compatibility: data.compatibility ? String(data.compatibility) : undefined,
    metadata: data.metadata as Record<string, string> | undefined,
  };

  if (!frontmatter.name) {
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      frontmatter.name = h1Match[1].trim();
    }
  }

  return { frontmatter, content: content.trim() };
}
