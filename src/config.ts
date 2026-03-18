import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import yaml from 'yaml';

const CONFIG_FILENAME = '.skill-compiler.yaml';

const targetSyncConfigSchema = z.object({
  repoPath: z.string().min(1),
  skillDir: z.string().min(1),
});

const globalConfigSchema = z.object({
  targets: z.object({
    'agent-skills-sandbox': targetSyncConfigSchema.optional(),
    'kibana-agent-builder': targetSyncConfigSchema.optional(),
  }),
  github: z
    .object({
      defaultBase: z.string().default('main'),
      branchPrefix: z.string().default('skill-compiler/'),
      draft: z.boolean().default(true),
    })
    .default({}),
});

export type GlobalConfig = z.infer<typeof globalConfigSchema>;
export type TargetSyncConfig = z.infer<typeof targetSyncConfigSchema>;

const configSearchPaths = (): string[] => [
  join(process.cwd(), CONFIG_FILENAME),
  join(homedir(), CONFIG_FILENAME),
];

export const loadGlobalConfig = async (): Promise<GlobalConfig> => {
  for (const configPath of configSearchPaths()) {
    try {
      const raw = await readFile(configPath, 'utf-8');
      const parsed = yaml.parse(raw);
      return globalConfigSchema.parse(parsed);
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    `No ${CONFIG_FILENAME} found. Create one at ${join(homedir(), CONFIG_FILENAME)} or ${join(process.cwd(), CONFIG_FILENAME)}.\n` +
      `Run 'elastic-skill-compiler init-config' to generate a template.`,
  );
};

export const resolveTargetConfig = (
  config: GlobalConfig,
  target: 'agent-skills-sandbox' | 'kibana-agent-builder',
): TargetSyncConfig => {
  const targetConfig = config.targets[target];
  if (!targetConfig) {
    throw new Error(
      `Target "${target}" not configured in ${CONFIG_FILENAME}. Add targets.${target}.repoPath and targets.${target}.skillDir.`,
    );
  }
  return targetConfig;
};

export const generateConfigTemplate = (): string => {
  return `# elastic-skill-compiler configuration
# Place this file at ~/.skill-compiler.yaml or in the compiler project root.

targets:
  agent-skills-sandbox:
    # Absolute path to the agent-skills-sandbox repo checkout
    repoPath: ~/Projects/agent-skills-sandbox
    # Relative path within the repo where skills live.
    # {domain} = extracted from skill ID prefix (e.g. "security" from "security-alert-triage")
    # {skill} = full skill ID, {skill-name} = skill ID without domain prefix
    skillDir: skills/{domain}/{skill-name}

  kibana-agent-builder:
    # Absolute path to the Kibana repo checkout
    repoPath: ~/Projects/kibana
    # Relative path within the repo where compiled Agent Builder skills are placed
    skillDir: x-pack/solutions/security/plugins/security_solution/server/assistant/skills/compiled/{skill}

github:
  defaultBase: main
  branchPrefix: skill-compiler/
  draft: true
`;
};

export const writeConfigTemplate = async (targetPath?: string): Promise<string> => {
  const outPath = targetPath ?? join(homedir(), CONFIG_FILENAME);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, generateConfigTemplate(), 'utf-8');
  return outPath;
};
