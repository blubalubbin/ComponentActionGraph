import type { Graph, Diagnostic, ComponentNode, StandardNode } from "./types.js";
import { effectiveActions } from "./ontology.js";

/** Evaluate all standards against the graph. */
export function checkStandards(graph: Graph): Diagnostic[] {
  const diags: Diagnostic[] = [];

  for (const std of graph.standards.values()) {
    const matches = selectComponents(graph, std);
    for (const c of matches) {
      for (const d of evaluate(std, c, graph)) diags.push(d);
    }
  }
  return diags;
}

function selectComponents(graph: Graph, std: StandardNode): ComponentNode[] {
  const out: ComponentNode[] = [];
  for (const c of graph.components.values()) {
    if (std.appliesTo.type && std.appliesTo.type.length > 0 && !std.appliesTo.type.includes(c.type)) continue;

    if (std.appliesTo.where) {
      let ok = true;
      for (const [k, v] of Object.entries(std.appliesTo.where)) {
        if ((c.raw as Record<string, unknown>)[k] !== v) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
    }

    if (std.appliesTo.tagAny && std.appliesTo.tagAny.length > 0) {
      if (!c.tags.some((t) => std.appliesTo.tagAny!.includes(t))) continue;
    }
    if (std.appliesTo.tagAll && std.appliesTo.tagAll.length > 0) {
      if (!std.appliesTo.tagAll.every((t) => c.tags.includes(t))) continue;
    }

    out.push(c);
  }
  return out;
}

function evaluate(std: StandardNode, c: ComponentNode, graph: Graph): Diagnostic[] {
  const out: Diagnostic[] = [];
  const rule = std.rule;
  const raw = c.raw as Record<string, unknown>;

  const push = (msg: string, hint?: string) =>
    out.push({
      severity: std.severity,
      code: "standard-violation",
      file: c.repoRel,
      message: `[${std.id}] ${c.ref}: ${msg}`,
      hint,
    });

  if (rule.requires) {
    for (const field of rule.requires) {
      const v = raw[field];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
        push(`missing required field '${field}'.`);
      }
    }
  }

  if (rule.forbids) {
    for (const field of rule.forbids) {
      if (raw[field] !== undefined && raw[field] !== null && raw[field] !== "") {
        push(`must not set field '${field}'.`);
      }
    }
  }

  if (rule.pattern) {
    for (const [field, pat] of Object.entries(rule.pattern)) {
      const v = raw[field];
      if (typeof v === "string" && !new RegExp(pat).test(v)) {
        push(`field '${field}'='${v}' does not match /${pat}/.`);
      }
    }
  }

  if (rule.edgeRequired) {
    const kinds = new Set(c.edges.map((e) => e.kind));
    for (const k of rule.edgeRequired) {
      if (!kinds.has(k)) push(`missing required edge kind '${k}'.`);
    }
  }
  if (rule.edgeForbidden) {
    for (const e of c.edges) {
      if (rule.edgeForbidden.includes(e.kind)) {
        push(`edge kind '${e.kind}' is forbidden for this component.`);
      }
    }
  }

  if (rule.forbidsAction) {
    const catalog = effectiveActions(c.type, graph.ontology);
    for (const act of rule.forbidsAction) {
      if (catalog.has(act) && c.actionsOverride[act] !== "disabled") {
        push(
          `action '${act}' must be disabled on this component but is not.`,
          `Add actionsOverride: { ${act}: disabled } to ${c.repoRel}.`,
        );
      }
    }
  }
  if (rule.requiresAction) {
    const catalog = effectiveActions(c.type, graph.ontology);
    for (const act of rule.requiresAction) {
      if (!catalog.has(act) || c.actionsOverride[act] === "disabled") {
        push(`action '${act}' must be available but is missing or disabled.`);
      }
    }
  }

  return out;
}
