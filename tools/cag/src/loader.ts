import YAML from "yaml";
import { walkYaml, readText, toRepoRel } from "./fs-utils.js";
import { loadOntology, typeSlug } from "./ontology.js";
import { loadSchemas, formatErrors } from "./schemas.js";
import type {
  Graph,
  ComponentNode,
  PathNode,
  StandardNode,
  RequirementNode,
  TestNode,
  Diagnostic,
} from "./types.js";

export interface LoadResult {
  graph: Graph;
  diagnostics: Diagnostic[];
}

export async function loadGraph(root: string): Promise<LoadResult> {
  const ontology = await loadOntology(root);
  const schemas = await loadSchemas(root);
  const files = await walkYaml(root);

  const components = new Map<string, ComponentNode>();
  const paths = new Map<string, PathNode>();
  const standards = new Map<string, StandardNode>();
  const requirements = new Map<string, RequirementNode>();
  const tests = new Map<string, TestNode>();
  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    // Skip ontology files: they live under ontology/ and don't have a `kind`.
    if (file.includes("/ontology/") || file.includes("\\ontology\\")) continue;

    let raw: Record<string, unknown>;
    try {
      raw = YAML.parse(await readText(file)) ?? {};
    } catch (err) {
      diagnostics.push({
        severity: "error",
        code: "yaml-parse",
        file: toRepoRel(root, file),
        message: `YAML parse error: ${(err as Error).message}`,
      });
      continue;
    }

    const kind = raw["kind"];
    if (kind === undefined) continue; // not a graph file

    const repoRel = toRepoRel(root, file);
    const common = { path: file, repoRel, raw };

    switch (kind) {
      case "component": {
        if (!schemas.component(raw)) {
          diagnostics.push({
            severity: "error",
            code: "schema",
            file: repoRel,
            message: `Component schema violation:\n${formatErrors(schemas.component.errors)}`,
          });
          continue;
        }
        const c = raw as Record<string, unknown>;
        const node: ComponentNode = {
          ...common,
          kind: "component",
          id: c["id"] as string,
          type: c["type"] as string,
          name: c["name"] as string,
          owner: c["owner"] as string | undefined,
          environment: c["environment"] as ComponentNode["environment"],
          tier: c["tier"] as ComponentNode["tier"],
          sensitivity: c["sensitivity"] as string | undefined,
          tags: (c["tags"] as string[] | undefined) ?? [],
          edges: (c["edges"] as ComponentNode["edges"] | undefined) ?? [],
          actionsOverride: (c["actionsOverride"] as Record<string, "disabled"> | undefined) ?? {},
          requirementRefs: (c["requirementRefs"] as string[] | undefined) ?? [],
          standardRefs: (c["standardRefs"] as string[] | undefined) ?? [],
          ref: "",
        };
        node.ref = `${typeSlug(node.type)}:${node.id}`;
        if (components.has(node.ref)) {
          diagnostics.push({
            severity: "error",
            code: "duplicate-id",
            file: repoRel,
            message: `Duplicate component ref ${node.ref} (already declared in ${components.get(node.ref)!.repoRel})`,
          });
          continue;
        }
        components.set(node.ref, node);
        break;
      }
      case "path": {
        if (!schemas.path(raw)) {
          diagnostics.push({
            severity: "error",
            code: "schema",
            file: repoRel,
            message: `Path schema violation:\n${formatErrors(schemas.path.errors)}`,
          });
          continue;
        }
        const p = raw as Record<string, unknown>;
        const node: PathNode = {
          ...common,
          kind: "path",
          id: p["id"] as string,
          name: p["name"] as string,
          persona: p["persona"] as string,
          preconditions: (p["preconditions"] as string[] | undefined) ?? [],
          steps: p["steps"] as PathNode["steps"],
          postconditions: (p["postconditions"] as string[] | undefined) ?? [],
          requirementRefs: (p["requirementRefs"] as string[] | undefined) ?? [],
        };
        paths.set(node.id, node);
        break;
      }
      case "standard": {
        if (!schemas.standard(raw)) {
          diagnostics.push({
            severity: "error",
            code: "schema",
            file: repoRel,
            message: `Standard schema violation:\n${formatErrors(schemas.standard.errors)}`,
          });
          continue;
        }
        const s = raw as Record<string, unknown>;
        standards.set(s["id"] as string, {
          ...common,
          kind: "standard",
          id: s["id"] as string,
          title: s["title"] as string | undefined,
          severity: s["severity"] as StandardNode["severity"],
          appliesTo: s["appliesTo"] as StandardNode["appliesTo"],
          rule: s["rule"] as StandardNode["rule"],
        });
        break;
      }
      case "requirement": {
        if (!schemas.requirement(raw)) {
          diagnostics.push({
            severity: "error",
            code: "schema",
            file: repoRel,
            message: `Requirement schema violation:\n${formatErrors(schemas.requirement.errors)}`,
          });
          continue;
        }
        const r = raw as Record<string, unknown>;
        requirements.set(r["id"] as string, {
          ...common,
          kind: "requirement",
          id: r["id"] as string,
          title: r["title"] as string,
          priority: r["priority"] as RequirementNode["priority"],
          satisfiedBy: (r["satisfiedBy"] as string[] | undefined) ?? [],
          verifiedBy: (r["verifiedBy"] as string[] | undefined) ?? [],
        });
        break;
      }
      case "test": {
        if (!schemas.test(raw)) {
          diagnostics.push({
            severity: "error",
            code: "schema",
            file: repoRel,
            message: `Test schema violation:\n${formatErrors(schemas.test.errors)}`,
          });
          continue;
        }
        const t = raw as Record<string, unknown>;
        tests.set(t["id"] as string, {
          ...common,
          kind: "test",
          id: t["id"] as string,
          title: t["title"] as string,
          type: t["type"] as TestNode["type"],
          targets: (t["targets"] as TestNode["targets"] | undefined) ?? {},
          given: t["given"] as string[],
          when: t["when"] as string[],
          then: t["then"] as string[],
        });
        break;
      }
      default:
        diagnostics.push({
          severity: "warn",
          code: "unknown-kind",
          file: repoRel,
          message: `Unknown kind: ${String(kind)}`,
        });
    }
  }

  const graph: Graph = { components, paths, standards, requirements, tests, ontology, root };
  return { graph, diagnostics };
}
