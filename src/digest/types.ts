import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Shared contract for the morning digest (plan.md § 1).
// Section 2 (page, JSON, board link, route tests) builds against these types.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One valid line of runs/<night>.jsonl.
export type RunLine = {
  at: string;
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

// One row per job for one night.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: JobStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  // Lines that did not parse or did not match RunLine. Counted, never thrown.
  badLines: number;
};

// Reads runs/<night>.jsonl. Returns null when the file does not exist (the page
// answers 404). An empty file gives zero rows, not null.
export function readNight(runsDir: string, night: string): NightDigest | null {
  // The night comes from a URL later on, so only a plain date may name a file.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;

  const path = join(runsDir, `${night}.jsonl`);
  if (!existsSync(path)) return null;

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;

  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const text = raw.trim();
    if (text === '') continue; // blank lines are not bad lines

    const line = parseLine(text);
    if (!line) {
      badLines++;
      continue;
    }

    const row = byJob.get(line.job);
    if (!row) {
      byJob.set(line.job, {
        job: line.job,
        owner: line.owner,
        runs: 1,
        retries: line.status === 'retry' ? 1 : 0,
        lastStatus: line.status,
        lastError: line.error ?? null,
        firstAt: line.at,
        lastAt: line.at,
      });
      continue;
    }

    row.runs++;
    if (line.status === 'retry') row.retries++;
    row.lastStatus = line.status;
    if (line.owner !== null) row.owner = line.owner; // keep the latest known owner
    if (line.error !== undefined) row.lastError = line.error; // keep the latest error
    if (Date.parse(line.at) < Date.parse(row.firstAt)) row.firstAt = line.at;
    if (Date.parse(line.at) >= Date.parse(row.lastAt)) row.lastAt = line.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
}

const STATUSES: ReadonlySet<string> = new Set(['ok', 'retry', 'fail']);

// Returns a RunLine, or null when the text is not a valid run line.
function parseLine(text: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const o = value as Record<string, unknown>;
  if (typeof o.at !== 'string' || typeof o.job !== 'string') return null;
  if (typeof o.status !== 'string' || !STATUSES.has(o.status)) return null;
  if (o.owner !== undefined && o.owner !== null && typeof o.owner !== 'string') return null;
  if (o.error !== undefined && typeof o.error !== 'string') return null;

  return {
    at: o.at,
    job: o.job,
    status: o.status as JobStatus,
    owner: typeof o.owner === 'string' ? o.owner : null,
    ...(typeof o.error === 'string' ? { error: o.error } : {}),
  };
}
