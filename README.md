# elastic-skill-compiler

Write a skill once. Ship it everywhere.

## The Problem

The AI agent ecosystem is fragmenting faster than teams can keep up. Cursor, Claude Code, Windsurf, Agent Builder, MCP — each platform demands its own format, its own packaging, its own publishing pipeline. The result is predictable: 110+ skills scattered across 30+ repos, 8 incompatible directory structures, 12 MCP servers with no shared patterns, and a product-native agent framework (Agent Builder) that lives on an island with no bridge to IDE-authored skills.

Every new platform means rewriting every skill. Every skill update means touching N repos. Every team that ships a capability chooses a single target and leaves the rest behind. This is the "Datadog speed problem" — competitors that solve distribution once move faster than teams that solve it N times.

## The Approach

Instead of standardizing on one platform's format (which locks out every other platform), the compiler takes the opposite approach: **standardize on a canonical source that is a superset of the open [agentskills.io](https://agentskills.io) format**, then generate platform-native artifacts from that source.

The canonical format is backwards-compatible by design. Without the compiler, a skill directory is just a standard `SKILL.md` + `AGENTS.md` + supporting files — it works on 25+ Agent Skills platforms via `npx skills add`. The compiler extensions (`skill.extensions.yaml`, `platforms/`) are additive. Nothing breaks if they're absent.

## What It Generates

From a single canonical skill directory, the compiler produces ready-to-publish artifacts for four platforms:

**Cursor Plugin** — `.cursor-plugin/plugin.json`, SKILL.md with Cursor frontmatter, rules, commands, agents, and `mcp.json` for tool integration.

**Claude Code Plugin** — `.claude-plugin/plugin.json`, SKILL.md with Claude Code frontmatter, subagent configurations, and `.mcp.json`.

**Agent Builder** — Zod schemas generated from tool YAML definitions, typed handler stubs, and a `register.ts` module compatible with Kibana's `defineSkillType()` API. This is the IDE-to-product bridge: the same skill that works in an IDE also registers as a product-native capability.

**Standalone MCP Server** — A complete `@modelcontextprotocol/sdk` server package with JSON Schema tool definitions compiled from the same YAML source, stdio transport, and `package.json` ready for npm publish and MCP Registry listing.

## Canonical Skill Format

```
skill/
  SKILL.md                  # Core skill definition (agentskills.io standard)
  AGENTS.md                 # Agent-specific context
  references/               # Reference materials
  examples/                 # Usage examples
  scripts/                  # Executable scripts
  tests/                    # Skill tests
  skill.extensions.yaml     # Compiler extensions: tool schemas, platform config
  platforms/                # Per-platform overrides (optional)
    cursor/
    claude-code/
    agent-builder/
      tools/                # Hand-authored server-side handlers
    mcp-server/
```

Tool definitions are written once in YAML and compiled to Zod (Agent Builder) and JSON Schema (MCP) automatically. Shared tools (`es-query`, `kibana-api`, etc.) can be referenced across skills via `shared:tool-name` syntax.

## Usage

```bash
# Scaffold a new skill
elastic-skill-compiler init "my-skill"

# Validate without generating
elastic-skill-compiler validate ./skills/my-skill

# Compile to all platforms
elastic-skill-compiler build ./skills/my-skill --platforms cursor,claude-code,agent-builder,mcp-server

# Compile to a specific platform
elastic-skill-compiler build ./skills/my-skill --platforms cursor --output ./dist

# Use shared tool definitions
elastic-skill-compiler build ./skills/my-skill --shared-tools ./shared-tools
```

## Architecture

```
src/
  index.ts                          CLI entry point
  cli.ts                            Commander CLI (build, validate, init)
  types.ts                          Core type definitions
  schemas/
    skill-extensions.ts             Zod validation for skill.extensions.yaml
    tool-definition.ts              Zod validation for tool YAML files
  parser/
    index.ts                        Canonical skill directory parser
    markdown.ts                     SKILL.md frontmatter extraction
    skill-extensions.ts             skill.extensions.yaml parser
    tool-schema.ts                  Tool definition YAML parser
  compiler/
    index.ts                        Orchestration and generator dispatch
    shared-tools.ts                 shared:tool-name resolution
  generators/
    types.ts                        PlatformGenerator interface
    cursor/index.ts                 Cursor plugin generator
    claude-code/index.ts            Claude Code plugin generator
    agent-builder/index.ts          Agent Builder generator
    mcp-server/index.ts             MCP server generator
```

Adding a new platform target means implementing one interface:

```typescript
interface PlatformGenerator {
  readonly platform: string;
  generate(ctx: GeneratorContext): Promise<GeneratorResult>;
}
```

## Development

```bash
npm install
npm run build        # Compile TypeScript
npm run typecheck    # Type check without emitting
npm run test         # Run tests
```

## License

[Elastic License 2.0](LICENSE)
