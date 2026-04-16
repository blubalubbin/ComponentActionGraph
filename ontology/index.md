# Ontology index

This folder defines the controlled vocabulary of the ComponentActionGraph.
Nothing in the repo may reference a type, edge, permission, or persona that
is not declared here. Extending the ontology is an intentional, reviewable
change — see `.github/copilot-instructions.md` for the grounding rule.

## Files

| File                          | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `component-types/*.yaml`      | One file per component type, each carrying its action catalog |
| `edge-types.yaml`             | The edge (relationship) kinds components may share            |
| `permissions.yaml`            | Permission, role, license, tenant-setting facets              |
| `personas.yaml`               | Abstract personas used in path definitions                    |
| `sources.yaml`                | Canonical MS Learn URLs per component type                    |

## Component types (current)

| Type              | File                                    |
| ----------------- | --------------------------------------- |
| Report            | `component-types/report.yaml`           |
| Dashboard         | `component-types/dashboard.yaml`        |
| SemanticModel     | `component-types/semantic-model.yaml`   |
| Workspace         | `component-types/workspace.yaml`        |
| App               | `component-types/app.yaml`              |
| Dataflow          | `component-types/dataflow.yaml`         |
| Gateway           | `component-types/gateway.yaml`          |
| SensitivityLabel  | `component-types/sensitivity-label.yaml`|
| Identity          | `component-types/identity.yaml`         |
| Team              | `component-types/team.yaml`             |
| SharePointSite    | `component-types/sharepoint-site.yaml`  |

## ID conventions

- **Component instance ref**: `<type-slug>:<instance-id>`, where `type-slug` is
  the kebab-case form of the PascalCase type id. Examples:
  `report:fin-sales-report`, `semantic-model:fin-sales-model`,
  `workspace:ws-finance-prod`, `sensitivity-label:confidential`.
- **Path id**: `path-<slug>`
- **Standard id**: `std-<slug>`
- **Requirement id**: `req-<slug>`
- **Test id**: `test-<slug>`

## Action-requires grammar

Every action's `requires:` entry is `<facet>:<slug>`, where `facet` is one of:

- `permission` — Power BI item-level permission
- `role` — role-based grant (workspace role, RLS role, certifier)
- `license` — user license tier
- `tenant-setting` — tenant-level admin toggle

Slugs are defined in `permissions.yaml`.
