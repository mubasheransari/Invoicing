import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { getConfig } from "./config";
import type { SubmissionInfo } from "./types";

/**
 * Remembers which invoices FBR accepted so they can never be submitted twice
 * (by any user of this server). Records live in a small JSON file, separated
 * per FBR environment so staging tests never block production.
 *
 * NOTE: needs a writable disk (local server, VM, Docker volume). On read-only
 * / serverless hosts, replace these functions with a database table - nothing
 * else in the app needs to change.
 */
type Records = Record<string, SubmissionInfo>;
type FileShape = Record<string, Records>; // environment -> key -> record

function filePath(): string {
  return (
    process.env.SUBMISSIONS_FILE?.trim() ||
    path.join(process.cwd(), "data", "submissions.json")
  );
}

async function readAll(): Promise<FileShape> {
  let raw: string;
  try {
    raw = await fs.readFile(/*turbopackIgnore: true*/ filePath(), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw e;
  }
  if (!raw.trim()) return {};
  // A corrupt file must NOT be treated as "nothing submitted".
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("submissions file is not a JSON object");
  }
  return parsed as FileShape;
}

const norm = (key: string) => key.trim().toUpperCase();

export async function getSubmissions(keys: string[]): Promise<Map<string, SubmissionInfo>> {
  const env = getConfig().environment;
  const records = (await readAll())[env] ?? {};
  const out = new Map<string, SubmissionInfo>();
  for (const key of keys) {
    const hit = records[norm(key)];
    if (hit) out.set(key, hit);
  }
  return out;
}

export async function getSubmission(key: string): Promise<SubmissionInfo | null> {
  return (await getSubmissions([key])).get(key) ?? null;
}

// Serialise writes within this process (globalThis survives route bundling).
const g = globalThis as unknown as { __fbrWriteChain?: Promise<unknown> };

export function markSubmitted(key: string, fbrNumber: string): Promise<void> {
  const run = async () => {
    const env = getConfig().environment;
    const all = await readAll();
    const records = (all[env] ??= {});
    records[norm(key)] = { fbrNumber, at: new Date().toISOString() };

    const target = filePath();
    await fs.mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(all, null, 2), "utf8");
    await fs.rename(/*turbopackIgnore: true*/ tmp, /*turbopackIgnore: true*/ target); // atomic replace
  };

  const next = (g.__fbrWriteChain ?? Promise.resolve()).then(run, run);
  g.__fbrWriteChain = next.catch(() => undefined);
  return next;
}

// ---- in-flight guard: blocks double-clicks / parallel tabs on this server ----
const f = globalThis as unknown as { __fbrInflight?: Set<string> };
const inflight = () => (f.__fbrInflight ??= new Set<string>());

export function tryLock(key: string): boolean {
  const set = inflight();
  const k = norm(key);
  if (set.has(k)) return false;
  set.add(k);
  return true;
}

export function unlock(key: string): void {
  inflight().delete(norm(key));
}
