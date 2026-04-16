---
mode: agent
description: Given a set of requirements, propose a component graph and user action paths that satisfy them.
---

# Task

You have been given one or more `requirement` YAML files in `/requirements/`.
Produce a minimal component graph (components, edges, paths) that satisfies
every `must` requirement and ideally the `should` ones too.

## Rules

1. Read `ontology/index.md`, `ontology/component-types/*`, and
   `ontology/personas.yaml` before writing anything. Do not invent types,
   edges, actions, or personas.
2. Follow the ID conventions in `.github/copilot-instructions.md`.
3. For every component you introduce:
   - Fill `owner`, `environment`, `sensitivity` if the type accepts them
     (they may be required by active standards).
   - Set `requirementRefs:` to every requirement id your component helps
     satisfy.
4. For every path:
   - Pick a persona from `ontology/personas.yaml`.
   - Every step's `action:` MUST be in the referenced component's type catalog.
   - Reference the requirements the path satisfies via `requirementRefs:`.
5. If a requirement cannot be satisfied without extending the ontology,
   **do not extend it inline**. Instead, list the missing vocabulary at the
   end of your response and stop.

## Output contract

Emit one YAML document per file, each preceded by an HTML comment with the
target path, e.g.:

```
<!-- file: components/reports/<id>.yaml -->
id: <id>
kind: component
...
```

Finish with a short table mapping `requirement id → components & path that
satisfy it`.

After you emit the files, remind the caller to run:
`cag validate && cag check-standards`
