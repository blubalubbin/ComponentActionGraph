# Agent brief — ComponentActionGraph

This repository is a **typed graph of Power BI / M365 components plus the
user action paths that traverse them**. It exists so that you (Copilot,
Claude, or any coding agent) can:

1. Propose a design given a set of requirements.
2. Validate an existing design against requirements.
3. Enforce component standards.
4. Generate test cases that cover standards × requirements × paths.

## Repo map (read these first)

- `ontology/` — controlled vocabulary. **Never invent** a type, edge, action
  verb, permission, or persona that does not appear here.
  - `component-types/<type>.yaml` — each type's definition, including the
    **action catalog** (the verbs a user can perform on that type, and the
    `requires:` gating each action).
  - `edge-types.yaml`, `permissions.yaml`, `personas.yaml`, `sources.yaml`.
- `schemas/` — JSON Schema for every YAML file kind. The CLI validates
  against these.
- `components/` — component instances (one YAML per component, grouped by
  type). The `examples/` folder contains a reference graph.
- `paths/` — user action paths.
- `standards/` — declarative rules applied to components.
- `requirements/` — business / functional requirements.
- `tests/` — test cases linking requirements, standards, paths.
- `tools/cag/` — the `cag` CLI (validate / check-standards / graph / coverage / new).

## ID conventions

- Component instance ref: `<type-slug>:<instance-id>` — e.g.
  `report:fin-sales-report`, `semantic-model:fin-sales-model`,
  `workspace:ws-finance-prod`. `<type-slug>` is the kebab-case form of the
  PascalCase type id in `ontology/component-types/`.
- Path id: `path-<slug>`
- Standard id: `std-<slug>`
- Requirement id: `req-<slug>`
- Test id: `test-<slug>`

## Core grounding rule (do not violate)

**Every component type's action catalog is grounded in Microsoft Learn.**
When you add a new type or extend an existing catalog:

1. Call the Microsoft Learn MCP server first
   (configured in `.mcp.json` → `https://learn.microsoft.com/api/mcp`).
2. Add every URL you relied on to the type's `sources:` list.
3. Only then emit the YAML.

Never invent a verb that is not grounded in the docs. If in doubt, open a
discussion in the PR rather than making the change.

## Workflows

Six canonical prompts live in `.github/prompts/`:

| Prompt                            | When to use                                    |
| --------------------------------- | ---------------------------------------------- |
| `capture-requirements.prompt.md`  | Free text → requirement YAML files             |
| `propose-design.prompt.md`        | Given requirements → produce graph YAML        |
| `validate-design.prompt.md`       | Given a graph → check it against requirements  |
| `check-standards.prompt.md`       | Run standards over the graph                   |
| `generate-tests.prompt.md`        | Emit test cases for the graph                  |
| `analyze-surplus.prompt.md`       | Report actions personas can take beyond requirements |

Each prompt ends with an explicit output contract so your emissions validate
against the schemas on first shot.

## Validation

Always run `cag validate` after any YAML change. The CLI:

- JSON-Schema-validates every file.
- Resolves every typed ref (`<type>:<id>`) and fails on dangling refs.
- Rejects any path step whose `action` is not in the referenced component
  type's catalog.
- Rejects any `actionsOverride:` that widens the type's catalog.

For standards, run `cag check-standards`. For drift between the ontology
and MS Learn docs, run `cag check-standards --refresh-sources`.
