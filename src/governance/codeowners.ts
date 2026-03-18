import { readFile, stat } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';

export async function validateCodeowners(
  skillDir: string,
  owners: string[],
): Promise<{ valid: boolean; errors: string[] }> {
  const repoRoot = await findRepoRoot(skillDir);
  if (!repoRoot) {
    return { valid: false, errors: ['No .git directory found — cannot locate repo root'] };
  }

  const codeownersPath = await findCodeownersFile(repoRoot);
  if (!codeownersPath) {
    return { valid: false, errors: ['No CODEOWNERS file found'] };
  }

  const content = await readFile(codeownersPath, 'utf-8');
  const relativePath = skillDir.startsWith(repoRoot)
    ? skillDir.slice(repoRoot.length)
    : skillDir;
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\//, '');

  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const hasMatch = lines.some((line) => {
    const pattern = line.split(/\s+/)[0];
    if (!pattern) return false;
    const cleanPattern = pattern.replace(/^\//, '');
    return normalized.startsWith(cleanPattern) || matchGlob(cleanPattern, normalized);
  });

  if (!hasMatch) {
    return { valid: false, errors: [`No CODEOWNERS entry for skill directory: ${normalized}`] };
  }

  return { valid: true, errors: [] };
}

function matchGlob(pattern: string, path: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{GLOBSTAR}}/g, '.*');
  return new RegExp(`^${escaped}`).test(path);
}

async function findRepoRoot(startDir: string): Promise<string | null> {
  let dir = resolve(startDir);
  const root = dirname(dir) === dir ? dir : '/';
  while (dir !== root) {
    try {
      const gitStat = await stat(join(dir, '.git'));
      if (gitStat.isDirectory() || gitStat.isFile()) {
        return dir;
      }
    } catch {
      // .git not found here, keep walking up
    }
    dir = dirname(dir);
  }
  return null;
}

async function findCodeownersFile(repoRoot: string): Promise<string | null> {
  const candidates = [
    join(repoRoot, 'CODEOWNERS'),
    join(repoRoot, '.github', 'CODEOWNERS'),
    join(repoRoot, 'docs', 'CODEOWNERS'),
  ];
  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      // not found, try next
    }
  }
  return null;
}
