---
mode: agent
description: >
  Given a design and a set of requirements, list the actions each persona
  CAN take that are not demanded by any requirement. Surfaces "surplus
  capability" so you can confirm intent with stakeholders or tighten the
  design.
---

# Task

Identify, for every persona in the design, the actions they can perform on
each component they touch — and split those actions into three buckets:

1. **Required** — used in a path referenced by some requirement's `satisfiedBy`.
2. **Forbidden** — blocked by a standard (`forbidsAction`) that matches the
   component.
3. **Surplus** — in the component type's action catalog, available to the
   persona, but not in any required path. **These are what to discuss with
   the user.**

This prompt is read-only. It does not modify any YAML.

## Step 1 — Build the persona × component access map

Walk every file in `paths/` (and `examples/paths/`). For each path step,
record `(path.persona, step.component)` as an access edge.

A persona "has access to" a component if they appear in any path that
touches it. (v1 simplification — identity/role edges are not yet considered.)

## Step 2 — Build the required-actions set

For every file in `requirements/` (and `examples/requirements/`):

- For each id in `satisfiedBy:` that matches `^path-`, look up the path.
- Record every `(persona, component, action)` triple from that path's steps
  as REQUIRED.

## Step 3 — Build the forbidden-actions set

For every file in `standards/` (and `examples/standards/`):

- If the rule has a `forbidsAction:` clause, evaluate the `appliesTo`
  selector against every component.
- For each matching component, record each forbidden action as FORBIDDEN.

## Step 4 — Compute surplus per persona × component

For each `(persona, component)` access edge from Step 1:

- Look up the component's type in `components/` → `ontology/component-types/<type>.yaml`.
- The type's `actions:` list is the catalog.
- For each action in the catalog:
  - If `(persona, component, action)` is in REQUIRED → mark `required`.
  - Else if the action is in FORBIDDEN for this component → mark `forbidden`.
  - Else → mark `surplus`.

If a component overrides its catalog via `actionsOverride:` (always a
narrower subset), use the override.

## Step 5 — Emit the report

Output one markdown document. Structure:

```markdown
# Surplus capability report

_Generated against <N> requirements, <M> paths, <P> components._

## Summary

| Persona | Required | Surplus | Forbidden |
|---------|----------|---------|-----------|
| executive | 3 | 7 | 1 |
| analyst   | 5 | 12 | 0 |

## persona: executive

### report:fin-sales-report (type: Report)

| Action | Status | Source |
|--------|--------|--------|
| view | required | req-sales-monthly-view → path-exec-monthly-sales-review |
| export-to-pdf | required | req-export-must-be-labeled |
| share | **surplus** | — discuss: should executives reshare? |
| subscribe | **surplus** | — discuss: notification fatigue risk? |
| publish-to-web | forbidden | std-confidential-no-publish-to-web |

_… repeat per component …_

## Discussion prompts for the next stakeholder review

- **executive / report:fin-sales-report**: share, subscribe — confirm whether
  these are intentional or should be removed via a tightening standard.
- _… one bullet per (persona, component) with ≥ 1 surplus action …_
```

### Status column conventions

- `required` — lowercase, no emphasis.
- `**surplus**` — bold, to draw the eye.
- `forbidden` — lowercase italic if the standard is `severity: warn`,
  plain if `error`.

### Source column conventions

- For `required`: list the requirement id and the path id, separated by `→`.
  If multiple requirements demand the same action, comma-separate them.
- For `surplus`: leave a short discussion hook starting with `— discuss:`.
  Make it specific to the action (sharing, subscribing, exporting, etc.) —
  do not use a generic placeholder.
- For `forbidden`: name the standard id.

## Step 6 — Suggest follow-ups

After the report, emit two short sections:

### Tightening candidates

If a surplus action consistently appears for one persona × type combination
across many components (e.g. every executive can `share` every report),
suggest a candidate standard to formalise the discussion outcome:

```yaml
# Candidate — only add after stakeholder confirms intent
id: std-executive-no-reshare
appliesTo:
  type: [Report]
  where:
    audience: executive
rule:
  forbidsAction: [share]
```

### Loosening candidates

If a required action sits at the edge of a permission boundary (e.g. the
only persona using `certify` is one role away from losing that permission),
flag it so the design conversation surfaces the dependency.

## Edge cases

- **Persona walks a path that satisfies no requirement**: every action in
  that path is surplus. Note this in the summary.
- **Component appears in no path**: skip. (`validate-design` already flags
  unreferenced components.)
- **Action requires a permission the persona's identity does not grant**:
  still report it as surplus, but append `(blocked by permission: <perm>)`
  to the Source column.
- **Persona id does not resolve in `ontology/personas.yaml`**: include the
  persona but flag it at the top of the report.
