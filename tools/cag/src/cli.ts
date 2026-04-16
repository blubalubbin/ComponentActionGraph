#!/usr/bin/env node
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { loadGraph } from "./loader.js";
import { validateGraph, findOrphans } from "./validate.js";
import { checkStandards } from "./check-standards.js";
import { buildCoverage, formatCoverage } from "./coverage.js";
import { renderMermaid, renderDot, renderJson } from "./render.js";
import { scaffolds } from "./scaffold.js";
import type { Diagnostic } from "./types.js";
import { connectLearnMcp, extractCandidateActions } from "./learn-mcp.js";

interface Args {
  command: string;
  rest: string[];
  flags: Map<string, string | true>;
}

function parseArgs(argv: string[]): Args {
  const [, , command = "help", ...rest] = argv;
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq >= 0) flags.set(a.slice(2, eq), a.slice(eq + 1));
      else if (i + 1 < rest.length && !rest[i + 1].startsWith("--")) flags.set(a.slice(2), rest[++i]);
      else flags.set(a.slice(2), true);
    } else {
      positional.push(a);
    }
  }
  return { command, rest: positional, flags };
}

function rootFrom(flags: Map<string, string | true>): string {
  const r = flags.get("root");
  return resolve(typeof r === "string" ? r : process.cwd());
}

function colour(s: string, c: number): string {
  return process.stdout.isTTY ? `\x1b[${c}m${s}\x1b[0m` : s;
}
const red = (s: string) => colour(s, 31);
const yellow = (s: string) => colour(s, 33);
const green = (s: string) => colour(s, 32);
const dim = (s: string) => colour(s, 2);

function printDiag(d: Diagnostic): void {
  const tag = d.severity === "error" ? red("error") : d.severity === "warn" ? yellow("warn ") : dim("info ");
  const where = d.file ? dim(` ${d.file}`) : "";
  console.log(`${tag} [${d.code}]${where}\n  ${d.message.replace(/\n/g, "\n  ")}`);
  if (d.hint) console.log(dim(`  hint: ${d.hint}`));
}

function exitCodeFor(diags: Diagnostic[]): number {
  return diags.some((d) => d.severity === "error") ? 1 : 0;
}

async function cmdValidate(args: Args): Promise<number> {
  const root = rootFrom(args.flags);
  const { graph, diagnostics: loadDiags } = await loadGraph(root);
  const semDiags = validateGraph(graph);
  const orphans = findOrphans(graph);

  const all = [...loadDiags, ...semDiags];
  all.forEach(printDiag);
  if (orphans.length > 0) {
    console.log(yellow(`\n${orphans.length} orphan component(s) (not referenced by any path/requirement/edge):`));
    for (const o of orphans) console.log(`  ${o.ref} ${dim(o.repoRel)}`);
  }

  const errorCount = all.filter((d) => d.severity === "error").length;
  const warnCount = all.filter((d) => d.severity === "warn").length;

  console.log(
    `\n${errorCount === 0 ? green("OK") : red("FAIL")}: ${graph.components.size} components, ${graph.paths.size} paths, ${graph.standards.size} standards, ${graph.requirements.size} requirements, ${graph.tests.size} tests — ${errorCount} error(s), ${warnCount} warn(s).`,
  );
  return exitCodeFor(all);
}

async function cmdCheckStandards(args: Args): Promise<number> {
  const root = rootFrom(args.flags);
  const { graph } = await loadGraph(root);
  const diags = checkStandards(graph);
  diags.forEach(printDiag);

  let extraDiags: Diagnostic[] = [];
  if (args.flags.get("refresh-sources")) {
    extraDiags = await refreshSources(graph);
    extraDiags.forEach(printDiag);
  }

  const all = [...diags, ...extraDiags];
  const errorCount = all.filter((d) => d.severity === "error").length;
  console.log(
    `\n${errorCount === 0 ? green("OK") : red("FAIL")}: ${graph.standards.size} standards evaluated — ${errorCount} error(s).`,
  );
  return exitCodeFor(all);
}

async function refreshSources(graph: import("./types.js").Graph): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  const endpoint = process.env["CAG_MCP_URL"] ?? "https://learn.microsoft.com/api/mcp";
  let client;
  try {
    client = await connectLearnMcp(endpoint);
  } catch (err) {
    out.push({
      severity: "warn",
      code: "mcp-unavailable",
      message: `Could not connect to MS Learn MCP (${endpoint}): ${(err as Error).message}`,
    });
    return out;
  }

  for (const [typeId, urls] of graph.ontology.sources) {
    const ct = graph.ontology.componentTypes.get(typeId);
    if (!ct) continue;
    const known = new Set(ct.actions.map((a) => a.id));
    const candidates = new Set<string>();
    for (const url of urls) {
      try {
        const md = await client.fetchDoc(url);
        for (const v of extractCandidateActions(md)) candidates.add(v);
      } catch (err) {
        out.push({
          severity: "warn",
          code: "mcp-fetch",
          message: `Failed to fetch ${url}: ${(err as Error).message}`,
        });
      }
    }
    for (const c of candidates) {
      if (!known.has(c)) {
        out.push({
          severity: "info",
          code: "source-drift",
          message: `${typeId}: candidate action '${c}' appears in MS Learn but is not in the catalog. Consider grounding it explicitly.`,
        });
      }
    }
  }
  return out;
}

async function cmdCoverage(args: Args): Promise<number> {
  const root = rootFrom(args.flags);
  const { graph } = await loadGraph(root);
  const rows = buildCoverage(graph);
  process.stdout.write(formatCoverage(rows));
  const uncovered = rows.filter((r) => !r.covered && r.priority === "must");
  if (uncovered.length > 0) {
    console.log(yellow(`\n${uncovered.length} MUST requirement(s) are not fully covered:`));
    for (const r of uncovered) {
      console.log(
        `  ${r.requirementId} — components=${r.satisfyingComponents.length}, paths=${r.satisfyingPaths.length}, tests=${r.verifyingTests.length}`,
      );
    }
    return 1;
  }
  return 0;
}

async function cmdGraph(args: Args): Promise<number> {
  const root = rootFrom(args.flags);
  const { graph } = await loadGraph(root);
  const format = (args.flags.get("format") as string) ?? "mermaid";
  let out: string;
  switch (format) {
    case "mermaid":
      out = renderMermaid(graph);
      break;
    case "dot":
      out = renderDot(graph);
      break;
    case "json":
      out = renderJson(graph);
      break;
    default:
      console.error(`Unknown --format=${format}. Use mermaid | dot | json.`);
      return 2;
  }
  const outFile = args.flags.get("out") as string | undefined;
  if (outFile) {
    await writeFile(outFile, out);
    console.log(`Wrote ${outFile} (${format}).`);
  } else {
    process.stdout.write(out);
  }
  return 0;
}

async function cmdNew(args: Args): Promise<number> {
  const kind = args.rest[0];
  if (!kind || !(kind in scaffolds)) {
    console.error("Usage: cag new <component|path|standard|requirement|test> [> out.yaml]");
    return 2;
  }
  process.stdout.write(scaffolds[kind]);
  return 0;
}

function cmdHelp(): number {
  console.log(`cag — ComponentActionGraph CLI

Usage:
  cag validate          [--root <path>]
  cag check-standards   [--root <path>] [--refresh-sources]
  cag coverage          [--root <path>]
  cag graph             [--root <path>] [--format mermaid|dot|json] [--out <file>]
  cag new               <component|path|standard|requirement|test>

Environment:
  CAG_MCP_URL     Override the Microsoft Learn MCP endpoint used by --refresh-sources.
                  Default: https://learn.microsoft.com/api/mcp
`);
  return 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);
  let code: number;
  try {
    switch (args.command) {
      case "validate":         code = await cmdValidate(args); break;
      case "check-standards":  code = await cmdCheckStandards(args); break;
      case "coverage":         code = await cmdCoverage(args); break;
      case "graph":            code = await cmdGraph(args); break;
      case "new":              code = await cmdNew(args); break;
      case "help":
      case "--help":
      case "-h":               code = cmdHelp(); break;
      default:
        console.error(`Unknown command: ${args.command}`);
        code = cmdHelp() || 2;
    }
  } catch (err) {
    console.error(red("fatal: ") + (err as Error).message);
    code = 1;
  }
  process.exit(code);
}

main();
