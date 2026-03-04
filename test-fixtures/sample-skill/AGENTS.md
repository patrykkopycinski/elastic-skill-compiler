# ES Query — Agent Context

When using this skill as an agent:

- Prefer ES|QL over Query DSL for aggregations
- Always include field type validation before querying
- Use `_source` filtering to minimize response payload
