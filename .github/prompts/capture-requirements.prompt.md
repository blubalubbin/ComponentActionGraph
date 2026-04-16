---
mode: agent
description: >
  Turn free-text requirement statements into validated requirement YAML files
  in requirements/. Handles single or batch input. Feeds directly into
  propose-design.
---

# Task

The user has provided one or more requirement statements in plain English.
Produce one `requirement` YAML file per distinct requirement, each conforming
to `schemas/requirement.schema.json`.

## Step 1 — Parse the input

Segment the user's free text into individual requirements. Signals that
separate requirements include: conjunctions introducing a new subject
("also", "in addition", "separately"), a change of actor or stakeholder,
a new MoSCoW signal word, or numbered/bulleted items.

When in doubt, keep related ideas together in one requirement rather than
splitting them.

## Step 2 — Extract structured fields

### `title`
One imperative sentence (≤ 15 words) capturing the core need. Use the actor
and verb: "Finance managers can view monthly regional sales." Do not use
"The system shall" boilerplate.

### `description`
Plain-language elaboration. Include context and qualifying conditions. Use a
YAML block scalar (`>`). Omit if the title is already self-explanatory.

### `stakeholder`
Map the actor to the closest persona id in `ontology/personas.yaml` (use
the bare id, e.g. `executive`, `analyst`). If no match, use a lowercase
hyphenated free-text role (e.g. `finance-manager`) and flag it in the
Step 5 summary table.

### `priority`
Map urgency signals to MoSCoW:

| User signal                                       | priority |
| ------------------------------------------------- | -------- |
| "critical", "must", "required", "non-negotiable"  | must     |
| "should", "important", "expected"                 | should   |
| "nice to have", "could", "if possible", "low pri" | could    |
| "won't", "out of scope", "not now", "future"      | wont     |

Default to `should` when no signal is present; note the assumption.

### `id`
Generate a slug from the title:
1. Lowercase.
2. Drop stop words: a, an, the, to, for, of, in, on, at, by, with, and,
   or, that, this, is, are, be, can, will, must, should.
3. Replace spaces and punctuation with hyphens. Collapse consecutive hyphens.
4. Truncate to 48 characters at a word boundary if necessary.
5. Prefix with `req-`.

Example: "Finance managers can view monthly regional sales"
→ `req-finance-managers-view-monthly-regional-sales`

Append `-2`, `-3`, etc. to disambiguate duplicates within the same batch.

### `satisfiedBy`
Always emit as an empty list (`[]`). Do not guess at component or path refs
— they don't exist yet and dangling refs fail `cag validate`.

**Exception**: if the user names an existing component by exact typed ref
(e.g. `report:fin-sales-report`), confirm it exists in `components/` before
including it.

### `verifiedBy`
Always emit as an empty list (`[]`). Tests are created later via
`generate-tests.prompt.md`.

## Step 3 — Emit the files

Precede each file with an HTML comment naming the target path, then emit
the YAML:

```
<!-- file: requirements/<id>.yaml -->
id: req-...
kind: requirement
title: ...
description: >
  ...
stakeholder: ...
priority: ...
satisfiedBy: []
verifiedBy: []
```

Emit all files before any prose commentary. Omit `description` only if
genuinely absent; always include `satisfiedBy: []` and `verifiedBy: []`.

## Step 4 — Validate

After emitting all files, instruct the caller:

```bash
cag validate
```

## Step 5 — Summary and next step

Emit a markdown table:

| id | title | priority | stakeholder | Assumptions |

List defaulted priorities, unmapped stakeholders, or contradictions in the
Assumptions column.

Then prompt the caller:

> **Next step**: open `propose-design.prompt.md` — it reads every file in
> `requirements/` and proposes the component graph that satisfies them.

## Edge cases

- **Contradictory signals** ("must have this but it's not critical"): use the
  higher priority; flag in Assumptions.
- **Multiple actors, same need**: use the higher-authority stakeholder;
  mention the other in `description`.
- **Not a requirement** (question, command, file path): do not emit YAML;
  ask a clarifying question.
- **Non-English input**: translate to English; note the language in
  Assumptions.
