# Security Alert Triage — Agent Context

When operating as an agent:

- Start executing tools immediately — do not read SKILL.md, browse the workspace, or list files first.
- Follow the full workflow: fetch → investigate → document → acknowledge. Never stop after gathering context.
- For ES|QL queries, write the query to a temporary `.esql` file and pass it via `--query-file` to avoid shell pipe
  interpretation issues.
- Keep context gathering focused: run 2–4 targeted queries (process tree, network, related alerts), not 10+.
- When triaging multiple alerts, group by agent/host and time window first, then triage each group as a unit.
- Always use `--dry-run` before bulk acknowledgments to preview scope.
- Pass `--yes` to skip confirmation prompts.
