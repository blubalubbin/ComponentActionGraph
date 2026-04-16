---
mode: agent
description: Emit test cases that cover every requirement, standard, and action-reachable path in the graph.
---

# Task

Generate the minimal set of `test` YAML files such that:

- Every `req-*` has at least one test in its `verifiedBy:` list.
- Every `std-*` of severity `error` has at least one positive and one
  negative test.
- For every `(persona, action, component)` triple reachable from any path,
  there is either a positive test (persona has all `requires:`) or a
  negative test (persona is missing at least one `requires:` — expect a
  denial).

## Process

1. Enumerate requirements not yet covered (`verifiedBy:` empty or stale).
2. For each action-level standard (`forbidsAction` / `requiresAction`),
   synthesise a negative test that attempts the forbidden action or omits
   the required one, and expect failure.
3. For each path, walk the steps and emit one integration test per step
   that asserts the step's `expects:` clause.

## Output contract

Emit one file per test, each preceded by:

```
<!-- file: tests/<test-id>.yaml -->
```

Follow the schema in `schemas/test.schema.json`:
- `type:` must be one of `unit | integration | acceptance | negative`.
- `given:`, `when:`, `then:` each must be non-empty string arrays.
- `targets:` must link back to the paths, standards, requirements the test
  exercises.

End with `cag validate` as the self-check.
