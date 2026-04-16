/**
 * Minimal client for the official Microsoft Learn MCP server
 * (https://learn.microsoft.com/api/mcp — repo MicrosoftDocs/mcp).
 *
 * We only need one tool: fetching a doc URL to re-ground an action catalog.
 * The server speaks Streamable HTTP; requests are plain JSON-RPC 2.0 POSTs
 * that return SSE-style bodies we parse line-by-line.
 *
 * This is a best-effort helper — `--refresh-sources` is an optional workflow
 * and the CLI degrades gracefully if the server is unreachable.
 */

const DEFAULT_URL = "https://learn.microsoft.com/api/mcp";

let nextId = 1;

async function rpc(url: string, method: string, params: unknown): Promise<unknown> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params });
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body,
  });
  if (!res.ok) throw new Error(`MS Learn MCP ${method} ${res.status}: ${await res.text()}`);
  const text = await res.text();
  // The server returns either an SSE stream (`data: {...}`) or a plain JSON body.
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const obj = JSON.parse(trimmed);
    if (obj.error) throw new Error(`MCP error: ${JSON.stringify(obj.error)}`);
    return obj.result;
  }
  // SSE — pick the last data: line.
  const lines = trimmed.split(/\r?\n/).filter((l) => l.startsWith("data:"));
  if (lines.length === 0) throw new Error(`Unrecognised MS Learn MCP response:\n${trimmed.slice(0, 200)}`);
  const last = lines[lines.length - 1].replace(/^data:\s*/, "");
  const obj = JSON.parse(last);
  if (obj.error) throw new Error(`MCP error: ${JSON.stringify(obj.error)}`);
  return obj.result;
}

export interface LearnClient {
  fetchDoc(url: string): Promise<string>;
}

/** Create a Microsoft Learn MCP client. Caller owns retry/timeout strategy. */
export async function connectLearnMcp(endpoint: string = DEFAULT_URL): Promise<LearnClient> {
  // Negotiate minimal handshake; many MCP HTTP servers accept calls without it,
  // but we do it to stay protocol-compliant.
  await rpc(endpoint, "initialize", {
    protocolVersion: "2024-11-05",
    clientInfo: { name: "cag", version: "0.1.0" },
    capabilities: {},
  }).catch(() => undefined);

  return {
    async fetchDoc(url: string): Promise<string> {
      const result = (await rpc(endpoint, "tools/call", {
        name: "microsoft_docs_fetch",
        arguments: { url },
      })) as { content?: Array<{ type: string; text?: string }> };
      const text = (result?.content ?? [])
        .filter((c) => c.type === "text" && typeof c.text === "string")
        .map((c) => c.text!)
        .join("\n");
      return text;
    },
  };
}

/**
 * Heuristic: extract candidate action verbs from a MS Learn page.
 * We look for imperative headings like "Share a dashboard", "Export to PDF",
 * etc., then slugify them. Produces a list we can diff against the ontology.
 */
export function extractCandidateActions(markdown: string): string[] {
  const actions = new Set<string>();
  const rx = /^#{2,4}\s+(?:How to\s+)?([A-Z][A-Za-z0-9 -]+?)(?:\s+(?:a|an|the|your)\s+.*)?$/gm;
  for (const m of markdown.matchAll(rx)) {
    const verb = m[1]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (verb.length > 2 && verb.length < 40) actions.add(verb);
  }
  return [...actions];
}
