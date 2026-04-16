export interface ActionDef {
  id: string;
  description?: string;
  requires?: string[];
  sideEffects?: string[];
  maxRecipientsPerAction?: number;
  notes?: string;
}

export interface ComponentType {
  id: string;
  extends?: string;
  description: string;
  sources?: string[];
  allowedEdges?: string[];
  actions: ActionDef[];
}

export interface EdgeDef {
  id: string;
  inverse?: string;
  description?: string;
}

export interface PermissionEntry {
  id: string;
  description?: string;
}

export interface PermissionsFile {
  permissions: PermissionEntry[];
  roles: PermissionEntry[];
  licenses: PermissionEntry[];
  tenantSettings: PermissionEntry[];
}

export interface Persona {
  id: string;
  description?: string;
  typicalLicense?: string;
  typicalRoles?: string[];
}

export interface SourcesFile {
  sources: Record<string, string[]>;
}

export interface Ontology {
  componentTypes: Map<string, ComponentType>;
  edgeTypes: Map<string, EdgeDef>;
  permissions: Set<string>;
  personas: Map<string, Persona>;
  sources: Map<string, string[]>;
}

export interface GraphFile {
  path: string;
  repoRel: string;
  raw: Record<string, unknown>;
  kind: "component" | "path" | "standard" | "requirement" | "test";
}

export interface ComponentNode extends GraphFile {
  kind: "component";
  id: string;
  type: string;
  name: string;
  owner?: string;
  environment?: "dev" | "test" | "prod";
  tier?: "bronze" | "silver" | "gold";
  sensitivity?: string;
  tags: string[];
  edges: Array<{ kind: string; to: string; notes?: string }>;
  actionsOverride: Record<string, "disabled">;
  requirementRefs: string[];
  standardRefs: string[];
  ref: string;
}

export interface PathStep {
  component: string;
  action: string;
  expects?: string;
  notes?: string;
}

export interface PathNode extends GraphFile {
  kind: "path";
  id: string;
  name: string;
  persona: string;
  preconditions: string[];
  steps: PathStep[];
  postconditions: string[];
  requirementRefs: string[];
}

export interface StandardNode extends GraphFile {
  kind: "standard";
  id: string;
  title?: string;
  severity: "error" | "warn" | "info";
  appliesTo: {
    type?: string[];
    where?: Record<string, unknown>;
    tagAny?: string[];
    tagAll?: string[];
  };
  rule: {
    requires?: string[];
    forbids?: string[];
    pattern?: Record<string, string>;
    edgeRequired?: string[];
    edgeForbidden?: string[];
    forbidsAction?: string[];
    requiresAction?: string[];
    customRuleId?: string;
  };
}

export interface RequirementNode extends GraphFile {
  kind: "requirement";
  id: string;
  title: string;
  priority: "must" | "should" | "could" | "wont";
  satisfiedBy: string[];
  verifiedBy: string[];
}

export interface TestNode extends GraphFile {
  kind: "test";
  id: string;
  title: string;
  type: "unit" | "integration" | "acceptance" | "negative";
  targets: {
    components?: string[];
    paths?: string[];
    standards?: string[];
    requirements?: string[];
  };
  given: string[];
  when: string[];
  then: string[];
}

export interface Graph {
  components: Map<string, ComponentNode>;   // key: `<type-slug>:<id>`
  paths: Map<string, PathNode>;             // key: id
  standards: Map<string, StandardNode>;
  requirements: Map<string, RequirementNode>;
  tests: Map<string, TestNode>;
  ontology: Ontology;
  root: string;
}

export interface Diagnostic {
  severity: "error" | "warn" | "info";
  code: string;
  message: string;
  file?: string;
  hint?: string;
}
