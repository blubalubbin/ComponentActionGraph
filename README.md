# ComponentActionGraph

A typed graph of **Power BI / M365 components** and the **user action paths**
that traverse them — structured so GitHub Copilot (or any agent given the
repo) can:

1. **Propose a design** from a set of requirements.
2. **Validate a design** against requirements.
3. Enforce **component standards** (naming, security, governance, lineage).
4. **Generate test cases** that exercise standards × requirements × paths.

The action catalog for each component type is **grounded in Microsoft Learn**
via the official [Microsoft Learn MCP server][mcp], so the vocabulary stays
aligned with the real product.

[mcp]: https://github.com/MicrosoftDocs/mcp

## Repo layout

```
.github/
  copilot-instructions.md     # primary agent brief
  prompts/                    # four reusable playbooks
.mcp.json                     # wires Microsoft Learn MCP
ontology/
  component-types/            # one YAML per type (Report, SemanticModel, …)
                              # each carrying its OWN action catalog
  edge-types.yaml
  permissions.yaml
  personas.yaml
  sources.yaml                # canonical MS Learn URLs per type
  index.md
schemas/                      # JSON Schema (draft 2020-12) for every file kind
components/ paths/ standards/ requirements/ tests/
                              # v1 is authored; v2 can be populated by importers
examples/                     # end-to-end reference graph
tools/cag/                    # the CLI
```

## The core idea

> **The set of actions a user can perform is a property of the component type.**

Every file in `ontology/component-types/` looks like:

```yaml
id: Report
sources:
  - https://learn.microsoft.com/power-bi/collaborate-share/collaborate-share-overview
  - https://learn.microsoft.com/power-bi/collaborate-share/service-share-reports
allowedEdges: [reads-from, surfaced-in, contained-by, labeled, depends-on]
actions:
  - id: view                    ; requires: [permission:read]
  - id: share                   ; requires: [permission:reshare, license:pro-or-ppu]
  - id: export-to-pdf           ; requires: [permission:read, tenant-setting:export-reports]
  - id: endorse-promoted        ; requires: [role:workspace-contributor-or-above]
  - id: certify                 ; requires: [role:certifier]
  - ...
```

A **path** is a persona walking through components using actions from those
catalogs:

```yaml
id: path-exec-monthly-sales-review
persona: persona:executive
steps:
  - { component: app:finance-app,        action: open }
  - { component: report:fin-sales-report, action: view }
  - { component: report:fin-sales-report, action: export-to-pdf }
```

The CLI rejects any step that uses an action not in the target type's
catalog. That's what makes the graph trustworthy for design, validation, and
test generation.

## Using it with Copilot / Claude Code

1. `.github/copilot-instructions.md` is the primary agent brief.
2. `.github/prompts/*.prompt.md` contains four reusable playbooks:
   `propose-design`, `validate-design`, `check-standards`, `generate-tests`.
3. `.mcp.json` wires the Microsoft Learn MCP server so the agent can ground
   new action catalogs in the real docs.

Claude Code users can also install the official plugin:

```bash
/plugin install microsoft-docs@claude-plugins-official
```

## CLI

```bash
# one-time build
(cd tools/cag && npm install && npm run build)

# from the repo root — the CLI scans every YAML under the repo
# (ontology/ and schemas/ are loaded separately)
node tools/cag/dist/cli.js validate
node tools/cag/dist/cli.js check-standards
node tools/cag/dist/cli.js coverage
node tools/cag/dist/cli.js graph --format mermaid
node tools/cag/dist/cli.js graph --format mermaid --out graph.mmd

# Drift check — fetches MS Learn pages via the MCP server and warns when
# the live docs mention an action the ontology hasn't captured.
node tools/cag/dist/cli.js check-standards --refresh-sources

# Use --root <dir> to validate a different copy of the repo (e.g. a sandbox).
```

Scaffolding new files:

```bash
node tools/cag/dist/cli.js new component    > components/reports/my-report.yaml
node tools/cag/dist/cli.js new path         > paths/my-journey.yaml
node tools/cag/dist/cli.js new standard     > standards/my-standard.yaml
node tools/cag/dist/cli.js new requirement  > requirements/my-req.yaml
node tools/cag/dist/cli.js new test         > tests/my-test.yaml
```

## What the example graph demonstrates

`examples/` contains a small but complete graph:

- 1 workspace, 1 app, 1 semantic model, 1 report, 1 sensitivity label, 2 identities
- 1 persona (`executive`) + 1 path (monthly sales review with a PDF export)
- 3 standards (prod-must-have-owner, report-naming, confidential-no-publish-to-web)
- 3 requirements (sales monthly view, export must be labeled, dedicated prod workspace)
- 3 tests covering every requirement

Run `node tools/cag/dist/cli.js validate` from the repo root to see it all
resolve cleanly.

## Extending the ontology

1. Add or modify a file under `ontology/component-types/` — PR-reviewed.
2. Every new or changed action must be backed by an MS Learn URL in
   `sources:`.
3. Run `cag check-standards --refresh-sources` to have the Microsoft Learn
   MCP diff your catalog against the live docs.

## Out of scope (for now)

- Importers that populate the graph from live tenants (Power BI REST,
  Microsoft Graph, Purview). The schema is importer-ready; tooling can
  come later.
- Policy-as-code (OPA / Rego). The declarative rule grammar covers v1.
- A web UI. Mermaid + the CLI cover v1.
