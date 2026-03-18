import { Command } from 'commander';
import { resolve } from 'node:path';
import { writeFile, mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import chalk from 'chalk';
import { compile } from './compiler/index.js';
import { validateCodeowners } from './governance/codeowners.js';
import type { Platform } from './types.js';

const ALL_PLATFORMS: Platform[] = [
  'cursor',
  'claude-code',
  'agent-builder',
  'mcp-server',
  'sandbox',
  'kibana-agent-builder',
];

export function createCli(): Command {
  const program = new Command()
    .name('elastic-skill-compiler')
    .description('Universal skill compiler — single canonical source to all agent platforms')
    .version('0.1.0');

  program
    .command('build')
    .description('Compile a canonical skill source into platform-native artifacts')
    .argument('<skill-dir>', 'Path to the canonical skill source directory')
    .option(
      '-p, --platforms <platforms>',
      `Comma-separated platforms: ${ALL_PLATFORMS.join(', ')}`,
      ALL_PLATFORMS.join(','),
    )
    .option('-o, --output <dir>', 'Output directory', './dist-skill')
    .option('--shared-tools <dir>', 'Path to shared tool definitions directory')
    .option('-v, --verbose', 'Verbose output')
    .action(async (skillDir: string, opts) => {
      const platforms = parsePlatforms(opts.platforms);
      const outputDir = resolve(opts.output);
      const resolvedSkillDir = resolve(skillDir);

      if (opts.verbose) {
        console.log(chalk.dim(`Skill source: ${resolvedSkillDir}`));
        console.log(chalk.dim(`Output: ${outputDir}`));
        console.log(chalk.dim(`Platforms: ${platforms.join(', ')}`));
      }

      console.log(chalk.blue('⚙ Compiling skill...'));

      const result = await compile(resolvedSkillDir, {
        platforms,
        outputDir,
        sharedToolsDir: opts.sharedTools ? resolve(opts.sharedTools) : undefined,
        verbose: opts.verbose,
      });

      if (result.errors.length > 0) {
        console.log(chalk.red('\nErrors:'));
        for (const err of result.errors) {
          console.log(chalk.red(`  ✗ ${err}`));
        }
      }

      let totalFiles = 0;
      for (const genResult of result.results) {
        console.log(chalk.green(`\n✓ ${genResult.platform} (${genResult.files.length} files)`));

        for (const file of genResult.files) {
          const fullPath = join(outputDir, genResult.platform, file.path);
          await mkdir(dirname(fullPath), { recursive: true });
          await writeFile(fullPath, file.content, 'utf-8');

          if (opts.verbose) {
            console.log(chalk.dim(`  → ${file.path}`));
          }
          totalFiles++;
        }

        for (const warning of genResult.warnings) {
          console.log(chalk.yellow(`  ⚠ ${warning}`));
        }
      }

      console.log(
        chalk.blue(
          `\nDone: ${totalFiles} files across ${result.results.length} platform(s) → ${outputDir}`,
        ),
      );

      if (result.errors.length > 0) {
        process.exit(1);
      }
    });

  program
    .command('validate')
    .description('Validate a canonical skill source without generating output')
    .argument('<skill-dir>', 'Path to the canonical skill source directory')
    .option('--shared-tools <dir>', 'Path to shared tool definitions directory')
    .action(async (skillDir: string, opts) => {
      const resolvedSkillDir = resolve(skillDir);

      console.log(chalk.blue(`Validating ${resolvedSkillDir}...`));

      try {
        const { parseSkillSource } = await import('./parser/index.js');
        const skill = await parseSkillSource(resolvedSkillDir);

        console.log(chalk.green(`✓ ${skill.name}`));
        console.log(chalk.dim(`  Description: ${skill.description}`));
        console.log(chalk.dim(`  Tools: ${(skill.extensions.tools ?? []).length}`));
        console.log(chalk.dim(`  Shared tools: ${(skill.extensions.sharedTools ?? []).length}`));
        console.log(chalk.dim(`  References: ${skill.references.length}`));
        console.log(chalk.dim(`  Examples: ${skill.examples.length}`));
        console.log(chalk.dim(`  Scripts: ${skill.scripts.length}`));
        console.log(chalk.dim(`  Tests: ${skill.tests.length}`));
        console.log(chalk.dim(`  AGENTS.md: ${skill.agentsContent ? 'yes' : 'no'}`));
        console.log(
          chalk.dim(`  Platform overrides: ${[...skill.platformOverrides.keys()].join(', ') || 'none'}`),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`✗ Validation failed: ${message}`));
        process.exit(1);
      }
    });

  program
    .command('init')
    .description('Scaffold a new canonical skill directory')
    .argument('<name>', 'Skill name')
    .option('-d, --dir <dir>', 'Parent directory', '.')
    .action(async (name: string, opts) => {
      const skillDir = join(resolve(opts.dir), slugify(name));

      console.log(chalk.blue(`Scaffolding skill: ${name} → ${skillDir}`));

      const dirs = [
        '',
        'references',
        'examples',
        'scripts',
        'tests',
        'platforms/cursor',
        'platforms/claude-code',
        'platforms/agent-builder/tools',
        'platforms/mcp-server',
      ];
      for (const dir of dirs) {
        await mkdir(join(skillDir, dir), { recursive: true });
      }

      await writeFile(
        join(skillDir, 'SKILL.md'),
        `---\nname: ${name}\ndescription: TODO\n---\n\n# ${name}\n\nDescribe the skill here.\n`,
      );

      await writeFile(
        join(skillDir, 'AGENTS.md'),
        `# ${name} — Agent Context\n\nAgent-specific instructions.\n`,
      );

      await writeFile(
        join(skillDir, 'skill.extensions.yaml'),
        `# Compiler extensions for ${name}\ntools: []\nsharedTools: []\nplatforms: {}\nagentBuilder:\n  category: custom\n  tags: []\n`,
      );

      console.log(chalk.green(`✓ Created ${skillDir}`));
      console.log(chalk.dim('  Edit SKILL.md, AGENTS.md, and skill.extensions.yaml to configure.'));
    });

  program
    .command('check')
    .description('Verify generated artifacts are up to date with the canonical source')
    .argument('<skill-dir>', 'Path to the canonical skill source directory')
    .option(
      '-p, --platforms <platforms>',
      `Comma-separated platforms: ${ALL_PLATFORMS.join(', ')}`,
      ALL_PLATFORMS.join(','),
    )
    .option('-o, --output <dir>', 'Directory containing existing generated artifacts', './dist-skill')
    .option('--shared-tools <dir>', 'Path to shared tool definitions directory')
    .action(async (skillDir: string, opts) => {
      const platforms = parsePlatforms(opts.platforms);
      const outputDir = resolve(opts.output);
      const resolvedSkillDir = resolve(skillDir);

      const tempDir = await mkdtemp(join(tmpdir(), 'skill-check-'));

      try {
        const result = await compile(resolvedSkillDir, {
          platforms,
          outputDir: tempDir,
          sharedToolsDir: opts.sharedTools ? resolve(opts.sharedTools) : undefined,
        });

        if (result.errors.length > 0) {
          for (const err of result.errors) {
            console.log(chalk.red(`  ✗ ${err}`));
          }
          process.exit(1);
        }

        const diffs: string[] = [];

        for (const genResult of result.results) {
          for (const file of genResult.files) {
            const generatedPath = join(tempDir, genResult.platform, file.path);
            await mkdir(dirname(generatedPath), { recursive: true });
            await writeFile(generatedPath, file.content, 'utf-8');

            const actualPath = join(outputDir, genResult.platform, file.path);

            let actual: string;
            try {
              actual = await readFile(actualPath, 'utf-8');
            } catch {
              diffs.push(actualPath);
              continue;
            }

            if (actual !== file.content) {
              diffs.push(actualPath);
            }
          }
        }

        if (diffs.length > 0) {
          console.log(chalk.red('Artifacts out of date:'));
          for (const d of diffs) {
            console.log(chalk.red(`  ✗ ${d}`));
          }
          process.exit(1);
        }

        console.log(chalk.green('All artifacts up to date'));
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    });

  program
    .command('validate-codeowners')
    .description('Validate CODEOWNERS has an entry for the skill directory')
    .argument('<skill-dir>', 'Path to the canonical skill source directory')
    .action(async (skillDir: string) => {
      const resolvedSkillDir = resolve(skillDir);

      let owners: string[];
      try {
        const { parseSkillRequirements } = await import('./parser/skill-requirements.js');
        const raw = await readFile(join(resolvedSkillDir, 'skill.requirements.yaml'), 'utf-8');
        const requirements = parseSkillRequirements(raw);
        owners = requirements.owners;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(chalk.red(`✗ Failed to read skill requirements: ${message}`));
        process.exit(1);
      }

      const result = await validateCodeowners(resolvedSkillDir, owners);

      if (!result.valid) {
        for (const error of result.errors) {
          console.log(chalk.red(`✗ ${error}`));
        }
        process.exit(1);
      }

      console.log(chalk.green('✓ CODEOWNERS entry found'));
    });

  return program;
}

function parsePlatforms(input: string): Platform[] {
  const platforms = input.split(',').map((s) => s.trim()) as Platform[];
  for (const p of platforms) {
    if (!ALL_PLATFORMS.includes(p)) {
      throw new Error(`Unknown platform: ${p}. Valid: ${ALL_PLATFORMS.join(', ')}`);
    }
  }
  return platforms;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
