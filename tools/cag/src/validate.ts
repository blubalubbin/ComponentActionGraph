import type { Graph, Diagnostic, ComponentNode, PathNode } from "./types.js";
import { effectiveActions, effectiveAllowedEdges, typeSlug } from "./ontology.js";

/**
 * Cross-ref and semantic validation on top of JSON Schema.
 */
export function validateGraph(graph: Graph): Diagnostic[] {
  const diags: Diagnostic[] = [];

  // Build a set of slugs → type ids so refs can be resolved.
  const slugToType = new Map<string, string>();
  for (const typeId of graph.ontology.componentTypes.keys()) {
    slugToType.set(typeSlug(typeId), typeId);
  }

  // --- Components ---
  for (const c of graph.components.values()) {
    // 1. Unknown type.
    if (!graph.ontology.componentTypes.has(c.type)) {
      diags.push({
        severity: "error",
        code: "unknown-type",
        file: c.repoRel,
        message: `Unknown component type '${c.type}'. Not declared in ontology/component-types/.`,
      });
      continue;
    }

    // 2. Edge kinds against type's allowed edges.
    const allowedEdges = effectiveAllowedEdges(c.type, graph.ontology);
    for (const edge of c.edges) {
      if (!graph.ontology.edgeTypes.has(edge.kind)) {
        diags.push({
          severity: "error",
          code: "unknown-edge",
          file: c.repoRel,
          message: `Unknown edge kind '${edge.kind}'. Not declared in ontology/edge-types.yaml.`,
        });
        continue;
      }
      if (allowedEdges.size > 0 && !allowedEdges.has(edge.kind)) {
        diags.push({
          severity: "error",
          code: "edge-not-allowed",
          file: c.repoRel,
          message: `Edge kind '${edge.kind}' is not in type ${c.type}'s allowedEdges (${[...allowedEdges].join(", ")}).`,
        });
      }

      // 3. Dangling edge target.
      if (!graph.components.has(edge.to)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: c.repoRel,
          message: `Edge target '${edge.to}' does not resolve to any component.`,
        });
      }
    }

    // 4. owner / sensitivity refs resolve.
    if (c.owner && !graph.components.has(c.owner)) {
      diags.push({
        severity: "error",
        code: "dangling-ref",
        file: c.repoRel,
        message: `owner '${c.owner}' does not resolve to any component.`,
      });
    }
    if (c.sensitivity && !graph.components.has(c.sensitivity)) {
      diags.push({
        severity: "error",
        code: "dangling-ref",
        file: c.repoRel,
        message: `sensitivity '${c.sensitivity}' does not resolve to a SensitivityLabel component.`,
      });
    }

    // 5. actionsOverride must only narrow: every key must exist in type's catalog.
    const catalog = effectiveActions(c.type, graph.ontology);
    for (const overrideKey of Object.keys(c.actionsOverride)) {
      if (!catalog.has(overrideKey)) {
        diags.push({
          severity: "error",
          code: "override-widens",
          file: c.repoRel,
          message: `actionsOverride tried to reference action '${overrideKey}' which is not in ${c.type}'s catalog.`,
          hint: "Overrides may only disable existing actions, never add new ones.",
        });
      }
    }

    // 6. requirementRefs and standardRefs resolve.
    for (const ref of c.requirementRefs) {
      if (!graph.requirements.has(ref)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: c.repoRel,
          message: `requirementRefs: '${ref}' does not resolve to a requirement.`,
        });
      }
    }
    for (const ref of c.standardRefs) {
      if (!graph.standards.has(ref)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: c.repoRel,
          message: `standardRefs: '${ref}' does not resolve to a standard.`,
        });
      }
    }
  }

  // --- Paths ---
  for (const p of graph.paths.values()) {
    if (!graph.ontology.personas.has(p.persona)) {
      diags.push({
        severity: "error",
        code: "unknown-persona",
        file: p.repoRel,
        message: `Unknown persona '${p.persona}'. Not declared in ontology/personas.yaml.`,
      });
    }

    for (const [i, step] of p.steps.entries()) {
      const target = graph.components.get(step.component);
      if (!target) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: p.repoRel,
          message: `step[${i}].component '${step.component}' does not resolve to any component.`,
        });
        continue;
      }
      const catalog = effectiveActions(target.type, graph.ontology);
      const disabled = target.actionsOverride[step.action] === "disabled";
      if (!catalog.has(step.action)) {
        const known = [...catalog.keys()].join(", ");
        diags.push({
          severity: "error",
          code: "action-not-in-catalog",
          file: p.repoRel,
          message: `step[${i}] uses action '${step.action}' on ${target.type} '${target.id}', but the type's catalog is [${known}].`,
          hint: `Extend ontology/component-types/${typeSlug(target.type)}.yaml (grounded in MS Learn) if this action is genuinely supported.`,
        });
      } else if (disabled) {
        diags.push({
          severity: "error",
          code: "action-disabled",
          file: p.repoRel,
          message: `step[${i}] uses action '${step.action}' on ${target.ref}, but that component has disabled it via actionsOverride.`,
        });
      }
    }

    for (const ref of p.requirementRefs) {
      if (!graph.requirements.has(ref)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: p.repoRel,
          message: `requirementRefs: '${ref}' does not resolve to a requirement.`,
        });
      }
    }
  }

  // --- Requirements ---
  for (const r of graph.requirements.values()) {
    for (const s of r.satisfiedBy) {
      if (s.startsWith("path-")) {
        if (!graph.paths.has(s)) {
          diags.push({
            severity: "error",
            code: "dangling-ref",
            file: r.repoRel,
            message: `satisfiedBy: '${s}' does not resolve to a path.`,
          });
        }
      } else if (s.includes(":")) {
        if (!graph.components.has(s)) {
          diags.push({
            severity: "error",
            code: "dangling-ref",
            file: r.repoRel,
            message: `satisfiedBy: '${s}' does not resolve to a component.`,
          });
        }
      } else {
        diags.push({
          severity: "warn",
          code: "unknown-ref-shape",
          file: r.repoRel,
          message: `satisfiedBy: '${s}' is neither a path- id nor a typed component ref.`,
        });
      }
    }
    for (const t of r.verifiedBy) {
      if (!graph.tests.has(t)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: r.repoRel,
          message: `verifiedBy: '${t}' does not resolve to a test.`,
        });
      }
    }
  }

  // --- Tests ---
  for (const t of graph.tests.values()) {
    const { targets } = t;
    for (const c of targets.components ?? []) {
      if (!graph.components.has(c)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: t.repoRel,
          message: `targets.components '${c}' does not resolve.`,
        });
      }
    }
    for (const p of targets.paths ?? []) {
      if (!graph.paths.has(p)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: t.repoRel,
          message: `targets.paths '${p}' does not resolve.`,
        });
      }
    }
    for (const s of targets.standards ?? []) {
      if (!graph.standards.has(s)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: t.repoRel,
          message: `targets.standards '${s}' does not resolve.`,
        });
      }
    }
    for (const r of targets.requirements ?? []) {
      if (!graph.requirements.has(r)) {
        diags.push({
          severity: "error",
          code: "dangling-ref",
          file: t.repoRel,
          message: `targets.requirements '${r}' does not resolve.`,
        });
      }
    }
  }

  return diags;
}

/** Orphans: components that no path touches and no requirement references. */
export function findOrphans(graph: Graph): ComponentNode[] {
  const touched = new Set<string>();
  for (const p of graph.paths.values()) {
    for (const s of p.steps) touched.add(s.component);
  }
  for (const r of graph.requirements.values()) {
    for (const s of r.satisfiedBy) if (s.includes(":")) touched.add(s);
  }
  for (const c of graph.components.values()) {
    for (const e of c.edges) touched.add(e.to);
  }
  const orphans: ComponentNode[] = [];
  for (const c of graph.components.values()) {
    if (!touched.has(c.ref)) orphans.push(c);
  }
  return orphans;
}
