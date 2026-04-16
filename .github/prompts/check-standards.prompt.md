---
mode: agent
description: Explain what each standard enforces and which components currently violate it.
---

# Task

For every file in `/standards/`, produce a concise human-readable summary:

- What does the standard require?
- Which components match its `appliesTo:` selector?
- Which of them satisfy the rule, which violate it?

## Process

1. Read the standard and the rule grammar (see `schemas/standard.schema.json`).
2. Resolve `appliesTo.type` + `where` against the component graph.
3. For each matched component, evaluate each rule clause:
   - `requires:` — fields present and non-empty.
   - `forbids:` — fields absent.
   - `pattern:` — regex match per named field.
   - `edgeRequired:` / `edgeForbidden:` — edge kinds present/absent.
   - `forbidsAction:` / `requiresAction:` — compare against the component
     type's action catalog (and any `actionsOverride:`).
   - `customRuleId:` — defer to the named rule in `tools/cag/rules/`.

## Output contract

A markdown table:

| Standard | Severity | Matches | Pass | Fail | Notes |
|----------|----------|---------|------|------|-------|

Followed, for every failure, by a one-line explanation with the
`standard-id → component-id → reason`.

End by recommending `cag check-standards` as the automated equivalent.
