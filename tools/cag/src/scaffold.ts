export const scaffolds: Record<string, string> = {
  component: `id: <kebab-slug>
kind: component
type: <PascalTypeId>         # one of ontology/component-types/
name: <human readable name>
owner: identity:<owner-slug>
environment: dev             # dev | test | prod
sensitivity: label:<label-slug>
tags: []
edges:
  - kind: contained-by
    to: <type-slug>:<id>
requirementRefs: []
standardRefs: []
`,
  path: `id: path-<slug>
kind: path
name: <human readable name>
persona: persona:<persona-slug>
preconditions: []
steps:
  - component: <type-slug>:<id>
    action: <verb-from-type-catalog>
    expects: <postcondition>
postconditions: []
requirementRefs: []
`,
  standard: `id: std-<slug>
kind: standard
title: <summary>
rationale: <why this matters>
severity: error              # error | warn | info
appliesTo:
  type: [Report]
  where: { environment: prod }
rule:
  requires: [owner, sensitivity]
`,
  requirement: `id: req-<slug>
kind: requirement
title: <imperative summary>
description: <detail>
stakeholder: <role>
priority: must               # must | should | could | wont
satisfiedBy: []
verifiedBy: []
`,
  test: `id: test-<slug>
kind: test
title: <what this verifies>
type: acceptance             # unit | integration | acceptance | negative
targets:
  components: []
  paths: []
  standards: []
  requirements: []
given: []
when: []
then: []
`,
};
