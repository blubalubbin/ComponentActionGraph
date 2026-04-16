---
mode: agent
description: Given the current component graph, check it against every requirement and report gaps.
---

# Task

Walk every file in `/requirements/` and determine whether the current graph
satisfies it.

## Process

1. For each requirement:
   a. Follow `satisfiedBy:` and confirm each referenced component/path exists.
   b. Follow `verifiedBy:` and confirm each referenced test exists and its
      `targets` include this requirement id.
   c. Trace the path(s) and confirm every step's `action` is in the
      referenced component type's catalog.
2. Flag any requirement that lacks:
   - a component satisfying it, OR
   - a path exercising it, OR
   - a test verifying it.
3. Also flag components that claim to satisfy a requirement via
   `requirementRefs:` but are not reachable from any path.

## Output contract

A markdown report with three sections:

- **Satisfied** — requirement id + brief evidence
- **Partially satisfied** — what is missing and what to add
- **Unsatisfied** — no components/paths/tests cover this

End with the command `cag coverage` and instruct the caller to run it to
cross-check your findings.
