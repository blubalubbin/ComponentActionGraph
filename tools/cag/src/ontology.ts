import { join } from "node:path";
import { readdir } from "node:fs/promises";
import YAML from "yaml";
import type { Ontology, ComponentType, EdgeDef, Persona, PermissionsFile } from "./types.js";
import { readText, exists } from "./fs-utils.js";

export function typeSlug(typeId: string): string {
  return typeId.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export async function loadOntology(root: string): Promise<Ontology> {
  const ontDir = join(root, "ontology");
  if (!exists(ontDir)) {
    throw new Error(`Missing ontology/ directory at ${ontDir}`);
  }

  // component types — one file per type
  const typesDir = join(ontDir, "component-types");
  const componentTypes = new Map<string, ComponentType>();
  if (exists(typesDir)) {
    const entries = await readdir(typesDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile() || !(e.name.endsWith(".yaml") || e.name.endsWith(".yml"))) continue;
      const raw = YAML.parse(await readText(join(typesDir, e.name))) as ComponentType;
      if (!raw?.id) throw new Error(`${e.name}: missing 'id'`);
      componentTypes.set(raw.id, raw);
    }
  }

  // edge types
  const edgeTypes = new Map<string, EdgeDef>();
  const edgesFile = join(ontDir, "edge-types.yaml");
  if (exists(edgesFile)) {
    const doc = YAML.parse(await readText(edgesFile)) as { edgeTypes: EdgeDef[] };
    for (const e of doc.edgeTypes ?? []) edgeTypes.set(e.id, e);
  }

  // permissions / roles / licenses / tenant settings — flattened into a single set of refs
  const permissions = new Set<string>();
  const permFile = join(ontDir, "permissions.yaml");
  if (exists(permFile)) {
    const doc = YAML.parse(await readText(permFile)) as PermissionsFile;
    for (const list of [doc.permissions, doc.roles, doc.licenses, doc.tenantSettings]) {
      for (const p of list ?? []) permissions.add(p.id);
    }
  }

  // personas
  const personas = new Map<string, Persona>();
  const personaFile = join(ontDir, "personas.yaml");
  if (exists(personaFile)) {
    const doc = YAML.parse(await readText(personaFile)) as { personas: Persona[] };
    for (const p of doc.personas ?? []) personas.set(p.id, p);
  }

  // sources (per type)
  const sources = new Map<string, string[]>();
  const srcFile = join(ontDir, "sources.yaml");
  if (exists(srcFile)) {
    const doc = YAML.parse(await readText(srcFile)) as { sources: Record<string, string[]> };
    for (const [k, v] of Object.entries(doc.sources ?? {})) sources.set(k, v);
  }

  return { componentTypes, edgeTypes, permissions, personas, sources };
}

/**
 * Resolve a component type's effective action catalog, honouring `extends`.
 * Parent actions come first; child actions override by id.
 */
export function effectiveActions(
  typeId: string,
  ont: Ontology,
): Map<string, import("./types.js").ActionDef> {
  const ct = ont.componentTypes.get(typeId);
  if (!ct) return new Map();
  const out = new Map<string, import("./types.js").ActionDef>();
  if (ct.extends) {
    for (const [k, v] of effectiveActions(ct.extends, ont)) out.set(k, v);
  }
  for (const a of ct.actions ?? []) out.set(a.id, a);
  return out;
}

export function effectiveAllowedEdges(typeId: string, ont: Ontology): Set<string> {
  const ct = ont.componentTypes.get(typeId);
  if (!ct) return new Set();
  const out = new Set<string>();
  if (ct.extends) for (const e of effectiveAllowedEdges(ct.extends, ont)) out.add(e);
  for (const e of ct.allowedEdges ?? []) out.add(e);
  return out;
}
