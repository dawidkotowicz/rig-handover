// Plan morning-digest § 1. The contract every part of § 2 builds against: the reader fills it,
// the page, the JSON and the board link only read it.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string; // ISO 8601 with the log's own offset, kept as written
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as "—"
  runs: number; // every parsed line for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus; // status of the latest line (by `at`)
  lastError: string | null; // error of the latest line that had one, else null
  firstAt: string; // earliest `at`, offset kept
  lastAt: string; // latest `at`, offset kept
};

export type StatusCounts = Record<RunStatus, number>;

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; page and JSON use this order as is
  counts: StatusCounts; // parsed lines per status, for the board
  badLines: number; // non-empty lines that did not parse; counted, never thrown
};

// Reads <runsDir>/<night>.jsonl. Returns null when the night has no file (→ 404).
// An empty file returns a Night with no rows (→ "nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
