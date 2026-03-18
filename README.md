# elastic-skill-compiler

Write a skill once. Ship it everywhere.

## The Problem

The AI agent ecosystem is fragmenting faster than teams can keep up. Cursor, Claude Code, Windsurf, Agent Builder, MCP — each platform demands its own format, its own packaging, its own publishing pipeline. The result: 110+ skills scattered across 30+ repos, 8 incompatible directory structures, 12 MCP servers with no shared patterns, and a product-native agent framework (Agent Builder) that lives on an island with no bridge to IDE-authored skills.

Every new platform means rewriting every skill. Every skill update means touching N repos. Every team that ships a capability chooses a single target and leaves the rest behind.

## The Approach

Instead of standardizing on one platform's format, the compiler takes the opposite approach: **standardize on a canonical source that is a superset of the open [agentskills.io](https://agentskills.io) format**, then generate platform-native artifacts from that source.

The canonical format is backwards-compatible by design. Without the compiler, a skill directory is just a standard `SKILL.md` + `AGENTS.md` + supporting files — it works on 25+ Agent Skills platforms via `npx skills add`. The compiler extensions (`skill.extensions.yaml`, `skill.requirements.yaml`, `platforms/`) are additive.

## Quick Start

```bash
# Install
git clone https://github.com/patrykkopycinski/elastic-skill-compiler.git
cd elastic-skill-compiler
npm install && npm run build

# One-time: generate config with your local repo paths
node dist/index.js init-config
# Edit ~/.skill-compiler.yaml (see Configuration below)

# Sync a skill to all target repos — zero manual copying
node dist/index.js sync skills/security-alert-triage

# Preview what would change (dry run)
node dist/index.js sync skills/security-alert-triage --dry-run

# Open PRs in target repos automatically
node dist/index.js sync skills/security-alert-triage --pr

# CI: fail the build if target repos drift from canonical source
node dist/index.js sync-check skills/security-alert-triage
```

## What It Generates

From a single canonical skill directory, the compiler produces ready-to-use artifacts for six platforms:

| Platform | Artifacts Generated |
|---|---|
| **Cursor** | `.cursor-plugin/plugin.json`, SKILL.md with Cursor frontmatter, rules, commands, `mcp.json` |
| **Claude Code** | `.claude-plugin/plugin.json`, SKILL.md with Claude Code frontmatter, subagent configs, `.mcp.json` |
| **Agent Builder** | Zod schemas from tool YAML, typed handler stubs, `register.ts` for Kibana's skill registration API |
| **MCP Server** | Complete `@modelcontextprotocol/sdk` server with JSON Schema tools, stdio transport, `package.json` |
| **Sandbox (IDE skills)** | SKILL.md with frontmatter, Node.js script stubs, `cursor-plugin-evals` YAML |
| **Kibana Agent Builder** | `register.ts`, Zod tool schemas, handler stubs, `kbn/evals` TypeScript test file |

## How Sync Works

The `sync` command is the primary automation entry point. It eliminates all manual file copying between the canonical source and target repositories.

```
┌─────────────────────────────────┐
│  elastic-skill-compiler repo    │
│                                 │
│  skills/                        │
│    security-alert-triage/       │
│      SKILL.md                   │ ── canonical source
│      skill.requirements.yaml    │ ── parity requirements
│      skill.extensions.yaml      │ ── tool schemas
│      references/                │
│                                 │
│  .skill-compiler.yaml           │ ── repo path mappings
└────────────┬────────────────────┘
             │
             │  elastic-skill-compiler sync
             │
     ┌───────┴────────┐
     ▼                ▼
┌──────────────┐  ┌─────────────────────┐
│ agent-skills │  │ kibana               │
│ -sandbox     │  │                      │
│              │  │ x-pack/.../compiled/ │
│ skills/      │  │   security-alert-    │
│  security/   │  │   triage/            │
│   alert-     │  │     register.ts      │
│   triage/    │  │     tools/           │
│     SKILL.md │  │     evals/           │
│     scripts/ │  │     references/      │
│     evals/   │  │                      │
│     refs/    │  │                      │
└──────────────┘  └─────────────────────┘
```

### What sync does, step by step

1. Reads `skill.requirements.yaml` to determine target repos (`agent-skills-sandbox`, `kibana-agent-builder`)
2. Loads `.skill-compiler.yaml` to resolve local repo paths
3. Compiles the canonical source into platform-native artifacts
4. Writes artifacts directly into the correct directories in each target repo
5. Copies `references/` to both targets
6. Reports what changed (or confirms no changes if already in sync)

With `--pr`, it also creates a git branch, commits the changes, pushes, and opens a draft PR via `gh`.

## Configuration

Create a `.skill-compiler.yaml` in the project root or at `~/.skill-compiler.yaml`:

```yaml
targets:
  agent-skills-sandbox:
    repoPath: ~/Projects/agent-skills-sandbox
    skillDir: skills/{domain}/{skill-name}

  kibana-agent-builder:
    repoPath: ~/Projects/kibana
    skillDir: x-pack/solutions/security/plugins/security_solution/server/assistant/skills/compiled/{skill}

github:
  defaultBase: main
  branchPrefix: skill-compiler/
  draft: true
```

### Template variables

| Variable | Resolves to | Example |
|---|---|---|
| `{domain}` | Domain prefix from skill ID | `security` (from `security-alert-triage`) |
| `{skill}` | Full skill ID | `security-alert-triage` |
| `{skill-name}` | Skill ID without domain prefix | `alert-triage` |

Generate a template with `elastic-skill-compiler init-config`.

## Canonical Skill Format

```
skill/
  SKILL.md                  # Core skill content (agentskills.io standard)
  AGENTS.md                 # Agent-specific context
  skill.extensions.yaml     # Tool schemas, platform config
  skill.requirements.yaml   # Parity requirements + behavioral scenarios
  references/               # Reference materials (auto-copied to targets)
  examples/                 # Usage examples
  scripts/                  # Executable scripts
  tests/                    # Skill tests
  platforms/                # Per-platform overrides (optional)
    cursor/
    claude-code/
    agent-builder/
    mcp-server/
```

### skill.requirements.yaml — Parity specification

This file defines **what** the skill must do (requirements with when/then scenarios), **where** it must work (targets), and **who** owns it:

```yaml
id: security-alert-triage
title: Security Alert Triage
owners:
  - security-threat-hunting-investigations
targets:
  - agent-skills-sandbox
  - kibana-agent-builder
parity: required

inputs:
  - name: alert_id
    type: string
    description: The alert ID to triage (optional; fetches next if omitted)
    required: false

outputs:
  - name: triage_result
    type: object
    description: Classification, case ID, and acknowledgement status

requirements:
  - name: Fetch next untriaged alert
    description: The skill SHALL fetch the next pending alert when no specific alert ID is provided.
    scenarios:
      - name: No alert ID provided
        when: User requests alert triage without specifying an alert ID
        then: The skill fetches the next untriaged alert and returns its details
      - name: Specific alert ID provided
        when: User provides a specific alert ID for triage
        then: The skill fetches that specific alert's details

  - name: Investigate alert context
    description: The skill SHALL gather corroborating evidence before classification.
    scenarios:
      - name: Process tree investigation
        when: An alert involves a suspicious process
        then: The skill queries the process tree and related events

  - name: Classify and document
    description: The skill SHALL classify the alert and create a case for true positives.
    scenarios:
      - name: True positive classification
        when: Corroborating evidence confirms malicious activity
        then: The skill classifies as malicious and creates a case with findings
      - name: False positive classification
        when: Investigation reveals benign activity
        then: The skill classifies as benign with justification

  - name: Acknowledge alerts
    description: The skill SHALL acknowledge alerts after classification and documentation.
    scenarios:
      - name: Acknowledge after case creation
        when: A case has been created for the alert
        then: The skill acknowledges the alert and related alerts

evalExtensions:
  agent-skills-sandbox:
    timeout: 120
    retries: 2
  kibana-agent-builder:
    connectorId: default
```

Each scenario gets a stable SHA-256 ID for traceability across eval frameworks.

### skill.extensions.yaml — Tool definitions

```yaml
tools:
  - name: fetch-next-alert
    description: Fetch the next unacknowledged Elastic Security alert
    parameters:
      - name: alert_id
        type: string
        description: Specific alert ID to fetch
        required: false
      - name: severity
        type: string
        description: Filter by alert severity
        required: false
        enum: [low, medium, high, critical]
    returns:
      type: object
      description: Alert details

  - name: run-query
    description: Run an ES|QL or KQL query for investigation
    parameters:
      - name: query
        type: string
        description: The query string
        required: true
      - name: type
        type: string
        description: Query language
        default: esql
        enum: [esql, kql]

sharedTools: []

platforms:
  cursor:
    rules:
      - alert-triage-conventions.mdc
  agent-builder:
    skillType: AlertTriageSkill
    category: security

agentBuilder:
  category: security
  tags: [security, alert-triage, soc]
```

## Generated Output Examples

### Sandbox target (agent-skills-sandbox)

**SKILL.md** — includes YAML frontmatter required by the sandbox repo:

```yaml
---
name: security-alert-triage
description: >
  Triage Elastic Security alerts — fetch, investigate context, classify threats,
  create cases, and acknowledge.
metadata:
  author: security-threat-hunting-investigations
  version: 0.1.0
  visibility: public
---
# Security Alert Triage
...
```

**scripts/fetch-next-alert.js** — executable Node.js with ES client:

```javascript
#!/usr/bin/env node
import { Client } from '@elastic/elasticsearch';

const client = new Client({
  node: process.env.ES_URL ?? 'http://localhost:9200',
  auth: process.env.ES_API_KEY
    ? { apiKey: process.env.ES_API_KEY }
    : { username: process.env.ES_USERNAME ?? 'elastic', password: process.env.ES_PASSWORD ?? 'changeme' },
});

const args = process.argv.slice(2);
  const alert_id = args[0] ?? undefined;
  const days = args[1] ?? 7;
  const severity = args[2] ?? undefined;

async function run(alert_id, days, severity) {
  // TODO: Implement fetch-next-alert handler
  throw new Error('Not implemented: fetch-next-alert');
}

run(alert_id, days, severity).then(
  (result) => { console.log(JSON.stringify(result, null, 2)); },
  (err) => { console.error(err); process.exitCode = 1; },
);
```

**evals/plugin-eval.yaml** — cursor-plugin-evals compatible:

```yaml
suite: security-alert-triage
tests:
  # scenario-id: 4b01cba77feb
  - name: No alert ID provided
    input: User requests alert triage without specifying an alert ID
    assertions:
      - type: keywords
        keywords:
          - skill
          - fetches
          - next
          - untriaged
          - alert
```

### Kibana Agent Builder target

**register.ts** — skill registration module:

```typescript
agentBuilder.skills.register({
  id: 'security-alert-triage',
  name: 'security-alert-triage',
  basePath: 'skills/compiled',
  description: `Triage Elastic Security alerts — ...`,
  content: `# Security Alert Triage ...`,
  getRegistryTools: () => ['fetch-next-alert', 'run-query', 'acknowledge-alert'],
});
```

**tools/fetch-next-alert/schema.ts** — Zod schema from tool YAML:

```typescript
import { z } from 'zod';

export const fetchNextAlertSchema = z.object({
  alert_id: z.string().describe('Specific alert ID to fetch').optional(),
  days: z.number().describe('Limit search to alerts from the last N days').optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Filter by alert severity').optional(),
});

export type FetchNextAlertInput = z.infer<typeof fetchNextAlertSchema>;
```

**evals/security-alert-triage.eval.ts** — kbn/evals compatible:

```typescript
import { evaluate } from '@kbn/evals';

// scenario-id: 4b01cba77feb
evaluate('No alert ID provided', async ({ inferenceClient, executorClient }) => {
  const input = `User requests alert triage without specifying an alert ID`;
  const expected = `The skill fetches the next untriaged alert and returns its details`;
  // TODO: Implement scenario evaluation
  throw new Error('Not implemented: No alert ID provided');
});
```

## CLI Reference

```
elastic-skill-compiler [command] [options]

Commands:
  build <skill-dir>              Compile to platform-native artifacts
  validate <skill-dir>           Validate without generating output
  init <name>                    Scaffold a new canonical skill directory
  check <skill-dir>              Verify artifacts match canonical source
  validate-codeowners <skill-dir>  Validate CODEOWNERS entries
  sync <skill-dir>               Compile and sync into target repos
  sync-check <skill-dir>         CI mode: verify target repos are in sync
  init-config                    Generate .skill-compiler.yaml template

sync options:
  -t, --targets <targets>   Comma-separated targets (default: from skill.requirements.yaml)
  --dry-run                 Preview changes without writing
  --pr                      Create branches and open PRs via gh CLI
  --shared-tools <dir>      Shared tool definitions directory
  -v, --verbose             Verbose output

build options:
  -p, --platforms <list>    Comma-separated: cursor, claude-code, agent-builder,
                            mcp-server, sandbox, kibana-agent-builder
  -o, --output <dir>        Output directory (default: ./dist-skill)
  --shared-tools <dir>      Shared tool definitions directory
  -v, --verbose             Verbose output
```

## Architecture

```
src/
  index.ts                          CLI entry point
  cli.ts                            Commander CLI definition
  types.ts                          Core type definitions
  config.ts                         Global config (.skill-compiler.yaml) loader
  sync.ts                           Sync engine: compile → copy → PR
  scenarios.ts                      Scenario parsing and stable ID generation
  schemas/
    skill-extensions.ts             Zod validation for skill.extensions.yaml
    skill-requirements.ts           Zod validation for skill.requirements.yaml
    tool-definition.ts              Zod validation for tool YAML files
  parser/
    index.ts                        Canonical skill directory parser
    markdown.ts                     SKILL.md frontmatter extraction
    skill-extensions.ts             skill.extensions.yaml parser
    skill-requirements.ts           skill.requirements.yaml parser
    tool-schema.ts                  Tool definition YAML parser
  compiler/
    index.ts                        Orchestration and generator dispatch
    shared-tools.ts                 shared:tool-name resolution
  generators/
    types.ts                        PlatformGenerator interface
    cursor/index.ts                 Cursor plugin generator
    claude-code/index.ts            Claude Code plugin generator
    agent-builder/index.ts          Agent Builder generator (legacy)
    mcp-server/index.ts             MCP server generator
    sandbox/index.ts                Sandbox (IDE skills) generator
    kibana-agent-builder/index.ts   Kibana Agent Builder generator
  eval-adapters/
    index.ts                        Shared expectation extraction
    sandbox-adapter.ts              cursor-plugin-evals YAML adapter
    kibana-adapter.ts               kbn/evals TypeScript adapter
  governance/
    codeowners.ts                   CODEOWNERS validation
    export-user-skill.ts            User-created skill → canonical export
```

Adding a new platform target means implementing one interface:

```typescript
interface PlatformGenerator {
  readonly platform: string;
  generate(ctx: GeneratorContext): Promise<GeneratorResult>;
}
```

## Parity Enforcement

The system enforces feature parity between IDE skills and Agent Builder skills:

1. **Canonical source** — `skill.requirements.yaml` defines requirements and scenarios once
2. **Scenario IDs** — each scenario gets a stable SHA-256 hash for cross-framework traceability
3. **Native constraint validation** — sandbox generator warns on Kibana-native tool names; Kibana generator warns on script-only tool names
4. **Drift detection** — `sync-check` compares target repo files against canonical, fails CI on mismatch
5. **Eval adapters** — shared behavioral expectations are mapped to both `cursor-plugin-evals` (YAML) and `kbn/evals` (TypeScript)

```bash
# In CI for agent-skills-sandbox:
elastic-skill-compiler sync-check skills/security-alert-triage --targets agent-skills-sandbox

# In CI for Kibana:
elastic-skill-compiler sync-check skills/security-alert-triage --targets kibana-agent-builder
```

## Development

```bash
npm install
npm run build        # Compile TypeScript
npm run typecheck    # Type check without emitting
npm test             # Run tests (61 tests across 8 suites)
```

## License

[Elastic License 2.0](LICENSE)
