---
name: es-query
description: Execute Elasticsearch queries and analyze results
license: Elastic-2.0
metadata:
  author: elastic
  version: "1.0"
---

# ES Query

Execute Elasticsearch queries with natural language or ES|QL, analyze results, and provide insights.

## Workflow

1. Understand the user's query intent
2. Translate to appropriate ES|QL or Query DSL
3. Execute against the cluster
4. Analyze and summarize results

## Rules

- Always validate index patterns before querying
- Use ES|QL for analytical queries, Query DSL for precision searches
- Limit result sets to prevent overwhelming output
