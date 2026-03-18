---
name: security-alert-triage
description: >
  Triage Elastic Security alerts — fetch, investigate context, classify threats, create cases, and acknowledge.
metadata:
  author: security-threat-hunting-investigations
  version: "0.1.0"
  visibility: public
---

# Security Alert Triage

Analyze Elastic Security alerts: fetch the next pending alert, gather corroborating evidence, classify the threat,
create a case for true positives, and acknowledge. Always complete the full workflow — do not stop after gathering
context.

## Workflow

```text
fetch → investigate → classify → document → acknowledge
```

1. **Fetch** — Retrieve the next untriaged alert (or a specific alert by ID).
2. **Investigate** — Query process trees, network connections, and related alerts on the same host/user.
3. **Classify** — Determine benign, unknown, or malicious based on evidence (see `references/classification-guide.md`).
4. **Document** — Create or update a case with findings, IOCs, and MITRE techniques.
5. **Acknowledge** — Mark the alert (and related alerts) as acknowledged.

## Tools

| Tool | Purpose |
| --- | --- |
| `fetch-next-alert` | Retrieve the next unacknowledged alert or a specific alert by ID |
| `run-query` | Run ES\|QL or KQL queries for context gathering |
| `acknowledge-alert` | Acknowledge alerts after triage and documentation |

## Critical Principles

- **Do NOT classify prematurely.** Gather ALL context before deciding.
- **Most alerts are false positives.** Rule names and severity labels are not evidence.
- **"Unknown" is acceptable** when evidence is insufficient.
- **MALICIOUS requires strong corroborating evidence:** persistence + C2, credential theft, lateral movement — not
  suspicious API calls alone.
- **Report tool output verbatim.** Copy IDs, hostnames, timestamps, and counts exactly.

## Investigation Queries

Time range: extract the alert's `@timestamp` and build queries with a +/- 1 hour window. Never use relative time.

| Data type | Index pattern |
| --- | --- |
| Alerts | `.alerts-security.alerts-*` |
| Processes | `logs-endpoint.events.process-*` |
| Network | `logs-endpoint.events.network-*` |
| Logs | `logs-*` |

## Examples

- "Fetch the next unacknowledged alert and triage it"
- "Investigate alert ID abc-123 — gather context, classify, and create a case if malicious"
- "Process the top 5 critical alerts from the last 24 hours"
