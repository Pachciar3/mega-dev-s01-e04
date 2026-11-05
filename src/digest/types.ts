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
  throw new Error('readNight: not implemented yet');
}
