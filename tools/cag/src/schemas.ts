import { join } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readText, exists } from "./fs-utils.js";

export interface Schemas {
  component: ValidateFunction;
  path: ValidateFunction;
  standard: ValidateFunction;
  requirement: ValidateFunction;
  test: ValidateFunction;
  componentType: ValidateFunction;
}

export async function loadSchemas(root: string): Promise<Schemas> {
  const dir = join(root, "schemas");
  if (!exists(dir)) throw new Error(`Missing schemas/ at ${dir}`);

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);

  const load = async (file: string) => JSON.parse(await readText(join(dir, file)));

  const component = ajv.compile(await load("component.schema.json"));
  const path = ajv.compile(await load("path.schema.json"));
  const standard = ajv.compile(await load("standard.schema.json"));
  const requirement = ajv.compile(await load("requirement.schema.json"));
  const test = ajv.compile(await load("test.schema.json"));
  const componentType = ajv.compile(await load("component-type.schema.json"));

  return { component, path, standard, requirement, test, componentType };
}

export function formatErrors(errors: ValidateFunction["errors"]): string {
  if (!errors) return "";
  return errors
    .map((e) => `  - ${e.instancePath || "/"}: ${e.message}${
      e.params && Object.keys(e.params).length ? ` (${JSON.stringify(e.params)})` : ""
    }`)
    .join("\n");
}
