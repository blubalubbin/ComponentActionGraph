import type { Graph } from "./types.js";

export interface CoverageRow {
  requirementId: string;
  title: string;
  priority: string;
  satisfyingComponents: string[];
  satisfyingPaths: string[];
  verifyingTests: string[];
  covered: boolean;
}

export function buildCoverage(graph: Graph): CoverageRow[] {
  const rows: CoverageRow[] = [];
  for (const r of graph.requirements.values()) {
    const comps = r.satisfiedBy.filter((s) => s.includes(":") && graph.components.has(s));
    const paths = r.satisfiedBy.filter((s) => s.startsWith("path-") && graph.paths.has(s));
    // also include paths that explicitly reference this requirement
    for (const p of graph.paths.values()) {
      if (p.requirementRefs.includes(r.id) && !paths.includes(p.id)) paths.push(p.id);
    }
    const verifying = r.verifiedBy.filter((t) => graph.tests.has(t));
    // also tests that target this requirement directly
    for (const t of graph.tests.values()) {
      if ((t.targets.requirements ?? []).includes(r.id) && !verifying.includes(t.id)) verifying.push(t.id);
    }
    // Coverage = at least one satisfying artifact (component OR path) AND at least one verifying test.
    const covered = (comps.length + paths.length) > 0 && verifying.length > 0;
    rows.push({
      requirementId: r.id,
      title: r.title,
      priority: r.priority,
      satisfyingComponents: comps,
      satisfyingPaths: paths,
      verifyingTests: verifying,
      covered,
    });
  }
  return rows;
}

export function formatCoverage(rows: CoverageRow[]): string {
  if (rows.length === 0) return "No requirements defined.\n";
  const head = "| Requirement | Priority | Components | Paths | Tests | Covered |";
  const sep  = "| ----------- | -------- | ---------- | ----- | ----- | ------- |";
  const body = rows.map(
    (r) =>
      `| ${r.requirementId} | ${r.priority} | ${r.satisfyingComponents.length} | ${r.satisfyingPaths.length} | ${r.verifyingTests.length} | ${r.covered ? "yes" : "NO"} |`,
  );
  return [head, sep, ...body].join("\n") + "\n";
}
