import type { Graph } from "./types.js";

export function renderMermaid(graph: Graph): string {
  const lines = ["graph LR"];
  for (const c of graph.components.values()) {
    const label = `${c.type}<br/>${c.name}`;
    lines.push(`  ${sanitize(c.ref)}["${label}"]`);
  }
  for (const c of graph.components.values()) {
    for (const e of c.edges) {
      if (graph.components.has(e.to)) {
        lines.push(`  ${sanitize(c.ref)} -->|${e.kind}| ${sanitize(e.to)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

export function renderDot(graph: Graph): string {
  const lines = ["digraph G {", '  rankdir="LR";', '  node [shape=box, style="rounded,filled", fillcolor="#f5f5f5"];'];
  for (const c of graph.components.values()) {
    lines.push(`  "${c.ref}" [label="${c.type}\\n${c.name.replace(/"/g, '\\"')}"];`);
  }
  for (const c of graph.components.values()) {
    for (const e of c.edges) {
      if (graph.components.has(e.to)) {
        lines.push(`  "${c.ref}" -> "${e.to}" [label="${e.kind}"];`);
      }
    }
  }
  lines.push("}");
  return lines.join("\n") + "\n";
}

export function renderJson(graph: Graph): string {
  const nodes = [...graph.components.values()].map((c) => ({
    id: c.ref,
    type: c.type,
    name: c.name,
    owner: c.owner,
    environment: c.environment,
    sensitivity: c.sensitivity,
    tags: c.tags,
  }));
  const edges = [...graph.components.values()].flatMap((c) =>
    c.edges
      .filter((e) => graph.components.has(e.to))
      .map((e) => ({ from: c.ref, to: e.to, kind: e.kind })),
  );
  return JSON.stringify({ nodes, edges }, null, 2) + "\n";
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}
