import { readFile, writeFile, mkdir, rm, stat, cp } from 'node:fs/promises';
import { join, resolve, relative, dirname, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import chalk from 'chalk';
import { compile } from './compiler/index.js';
import { loadGlobalConfig, resolveTargetConfig, type GlobalConfig, type TargetSyncConfig } from './config.js';
import { parseSkillRequirements } from './parser/skill-requirements.js';
import type { Platform, GeneratedFile } from './types.js';

const exec = promisify(execFile);

const TARGET_TO_PLATFORM: Record<string, Platform> = {
  'agent-skills-sandbox': 'sandbox',
  'kibana-agent-builder': 'kibana-agent-builder',
};

export interface SyncOptions {
  skillDir: string;
  targets?: string[];
  dryRun?: boolean;
  createPr?: boolean;
  verbose?: boolean;
  sharedToolsDir?: string;
}

export interface SyncResult {
  target: string;
  platform: Platform;
  filesWritten: string[];
  filesUnchanged: string[];
  warnings: string[];
  prUrl?: string;
}

export const sync = async (options: SyncOptions): Promise<SyncResult[]> => {
  const { skillDir, dryRun = false, createPr = false, verbose = false } = options;
  const resolvedSkillDir = resolve(skillDir);

  const config = await loadGlobalConfig();

  const requirementsRaw = await readFile(join(resolvedSkillDir, 'skill.requirements.yaml'), 'utf-8');
  const requirements = parseSkillRequirements(requirementsRaw);

  const requestedTargets = options.targets ?? requirements.targets;
  const results: SyncResult[] = [];

  for (const target of requestedTargets) {
    const platform = TARGET_TO_PLATFORM[target];
    if (!platform) {
      console.log(chalk.yellow(`⚠ Unknown target "${target}", skipping.`));
      continue;
    }

    const targetConfig = resolveTargetConfig(config, target as 'agent-skills-sandbox' | 'kibana-agent-builder');
    const repoPath = resolve(targetConfig.repoPath.replace(/^~/, process.env.HOME ?? ''));

    await assertDirectory(repoPath, `Target repo "${target}" at ${repoPath}`);

    const destDir = resolveSkillDestination(repoPath, targetConfig.skillDir, requirements.id);

    if (verbose) {
      console.log(chalk.dim(`  ${target}: compiling → ${destDir}`));
    }

    const compileResult = await compile(resolvedSkillDir, {
      platforms: [platform],
      outputDir: join(resolvedSkillDir, '.tmp-sync'),
      sharedToolsDir: options.sharedToolsDir,
      verbose,
    });

    if (compileResult.errors.length > 0) {
      throw new Error(`Compilation failed for ${target}: ${compileResult.errors.join(', ')}`);
    }

    const genResult = compileResult.results.find((r) => r.platform === platform);
    if (!genResult) {
      throw new Error(`No output generated for platform ${platform}`);
    }

    const filesWritten: string[] = [];
    const filesUnchanged: string[] = [];

    for (const file of genResult.files) {
      const destPath = join(destDir, file.path);

      if (dryRun) {
        const changed = await isFileChanged(destPath, file.content);
        if (changed) {
          filesWritten.push(relative(repoPath, destPath));
          console.log(chalk.cyan(`  [dry-run] would write: ${relative(repoPath, destPath)}`));
        } else {
          filesUnchanged.push(relative(repoPath, destPath));
        }
        continue;
      }

      const changed = await isFileChanged(destPath, file.content);
      await mkdir(dirname(destPath), { recursive: true });
      await writeFile(destPath, file.content, 'utf-8');

      if (changed) {
        filesWritten.push(relative(repoPath, destPath));
      } else {
        filesUnchanged.push(relative(repoPath, destPath));
      }
    }

    await copyReferences(resolvedSkillDir, destDir, dryRun);

    await rm(join(resolvedSkillDir, '.tmp-sync'), { recursive: true, force: true });

    let prUrl: string | undefined;
    if (createPr && filesWritten.length > 0 && !dryRun) {
      prUrl = await createPullRequest(
        repoPath,
        destDir,
        requirements.id,
        requirements.title,
        config,
        filesWritten,
      );
    }

    results.push({
      target,
      platform,
      filesWritten,
      filesUnchanged,
      warnings: genResult.warnings,
      prUrl,
    });
  }

  return results;
};

const resolveSkillDestination = (repoPath: string, skillDirTemplate: string, skillId: string): string => {
  const parts = skillId.split('-');
  const domain = parts.length > 1 ? mapDomain(parts[0]) : 'general';
  const skillName = parts.length > 1 ? parts.slice(1).join('-') : skillId;

  const resolved = skillDirTemplate
    .replace('{domain}', domain)
    .replace('{skill}', skillId)
    .replace('{skill-name}', skillName);

  return join(repoPath, resolved);
};

const mapDomain = (prefix: string): string => {
  const domainMap: Record<string, string> = {
    security: 'security',
    sec: 'security',
    o11y: 'observability',
    obs: 'observability',
    observability: 'observability',
    kibana: 'kibana',
    platform: 'platform',
    search: 'search',
  };
  return domainMap[prefix] ?? prefix;
};

const isFileChanged = async (filePath: string, newContent: string): Promise<boolean> => {
  try {
    const existing = await readFile(filePath, 'utf-8');
    return existing !== newContent;
  } catch {
    return true;
  }
};

const assertDirectory = async (dirPath: string, label: string): Promise<void> => {
  try {
    const s = await stat(dirPath);
    if (!s.isDirectory()) {
      throw new Error(`${label} is not a directory`);
    }
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`${label} does not exist. Check your .skill-compiler.yaml targets.`);
    }
    throw err;
  }
};

const copyReferences = async (sourceSkillDir: string, destDir: string, dryRun: boolean): Promise<void> => {
  const refsDir = join(sourceSkillDir, 'references');
  try {
    const s = await stat(refsDir);
    if (!s.isDirectory()) return;
  } catch {
    return;
  }

  const destRefsDir = join(destDir, 'references');

  if (dryRun) {
    console.log(chalk.cyan(`  [dry-run] would copy references/ → ${relative(process.cwd(), destRefsDir)}`));
    return;
  }

  await mkdir(destRefsDir, { recursive: true });
  await cp(refsDir, destRefsDir, { recursive: true, force: true });
};

const createPullRequest = async (
  repoPath: string,
  destDir: string,
  skillId: string,
  skillTitle: string,
  config: GlobalConfig,
  changedFiles: string[],
): Promise<string> => {
  const branchName = `${config.github.branchPrefix}sync-${skillId}-${Date.now()}`;
  const baseBranch = config.github.defaultBase;
  const isDraft = config.github.draft;

  console.log(chalk.blue(`\n  Creating PR in ${repoPath}...`));

  await git(repoPath, ['checkout', baseBranch]);
  await git(repoPath, ['pull', '--ff-only']);
  await git(repoPath, ['checkout', '-b', branchName]);

  for (const file of changedFiles) {
    await git(repoPath, ['add', file]);
  }

  const refsRelative = relative(repoPath, join(destDir, 'references'));
  try {
    await git(repoPath, ['add', refsRelative]);
  } catch {
    // references/ may not exist
  }

  const commitMessage = `[skill-compiler] Sync ${skillTitle} (${skillId})`;
  await git(repoPath, ['commit', '-m', commitMessage]);
  await git(repoPath, ['push', '-u', 'origin', branchName]);

  const prTitle = `[skill-compiler] Sync: ${skillTitle}`;
  const prBody = [
    '## Auto-generated by elastic-skill-compiler',
    '',
    `Synced canonical skill \`${skillId}\` from \`elastic-skill-compiler\`.`,
    '',
    '### Changed files',
    ...changedFiles.map((f) => `- \`${f}\``),
    '',
    '### How to verify',
    '```bash',
    `elastic-skill-compiler check skills/${skillId} --platforms ${skillId.includes('kibana') ? 'kibana-agent-builder' : 'sandbox'} --output .`,
    '```',
  ].join('\n');

  const ghArgs = [
    'pr', 'create',
    '--title', prTitle,
    '--body', prBody,
    '--base', baseBranch,
    ...(isDraft ? ['--draft'] : []),
  ];

  const { stdout } = await exec('gh', ghArgs, { cwd: repoPath });
  const prUrl = stdout.trim();

  console.log(chalk.green(`  ✓ PR created: ${prUrl}`));

  await git(repoPath, ['checkout', baseBranch]);

  return prUrl;
};

const git = async (cwd: string, args: string[]): Promise<string> => {
  const { stdout } = await exec('git', args, { cwd });
  return stdout.trim();
};
