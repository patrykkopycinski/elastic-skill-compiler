export type Platform = 'cursor' | 'claude-code' | 'agent-builder' | 'mcp-server';

export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  items?: { type: string };
  properties?: Record<string, Omit<ToolParameter, 'name'>>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  returns?: {
    type: string;
    description: string;
  };
}

export interface PlatformOverrides {
  cursor?: {
    rules?: string[];
    extraContent?: string;
    commands?: Array<{ name: string; description: string }>;
    agents?: Array<{ name: string; file: string }>;
    hooks?: Record<string, unknown>;
  };
  'claude-code'?: {
    extraContent?: string;
    subagents?: Array<{ name: string; description: string; prompt: string }>;
    hooks?: Record<string, unknown>;
  };
  'agent-builder'?: {
    skillType?: string;
    category?: string;
    handlerDir?: string;
  };
  'mcp-server'?: {
    packageName?: string;
    serverName?: string;
    transport?: 'stdio' | 'http';
  };
}

export interface SkillExtensions {
  tools?: Array<ToolDefinition | string>;
  sharedTools?: string[];
  platforms?: PlatformOverrides;
  agentBuilder?: {
    skillType?: string;
    category?: string;
    tags?: string[];
  };
}

export interface ParsedSkill {
  name: string;
  description: string;
  frontmatter: SkillFrontmatter;
  content: string;
  extensions: SkillExtensions;
  sourceDir: string;
  agentsContent?: string;
  references: string[];
  examples: string[];
  scripts: string[];
  tests: string[];
  platformOverrides: Map<Platform, string>;
}

export interface GeneratorContext {
  skill: ParsedSkill;
  resolvedTools: ToolDefinition[];
  outputDir: string;
  sharedToolsDir?: string;
}

export interface GeneratorResult {
  platform: Platform;
  files: GeneratedFile[];
  warnings: string[];
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface CompilerOptions {
  platforms: Platform[];
  outputDir: string;
  sharedToolsDir?: string;
  verbose?: boolean;
}

export interface CompilerResult {
  skill: ParsedSkill;
  results: GeneratorResult[];
  errors: string[];
}
