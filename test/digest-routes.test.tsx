import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';
import type { DigestRow } from '../src/digest/types.js';

// Plan morning-digest § 2d. Both routes are tested against the shared contract
// (/home/claude/s01e04/contract.md). Fixtures live in a temp dir; runs/ is never touched.

const CONFIG: RigConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

const NORMAL = '2026-10-28';
const EMPTY = '2026-10-27';
const BAD = '2026-10-26';
const MISSING = '2026-10-25';
const MALFORMED = 'nope';

// Two jobs: fixtures/refresh retries 3 times then ends ok; notes/backup fails once.
const NORMAL_LOG = [
  '{"at":"2026-10-28T01:00:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-28T01:01:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-28T01:02:00+01:00","job":"fixtures/refresh","status":"retry","owner":"rook","error":"upstream 503"}',
  '{"at":"2026-10-28T01:03:00+01:00","job":"fixtures/refresh","status":"ok","owner":"rook"}',
  '{"at":"2026-10-28T04:00:01+01:00","job":"notes/backup","status":"fail","owner":"lane-07","error":"quota exceeded"}',
].join('\n') + '\n';

// One good line and one line that does not parse.
const BAD_LOG = [
  '{"at":"2026-10-26T02:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
  'this is not json',
].join('\n') + '\n';

const NORMAL_ROWS: DigestRow[] = [
  {
    job: 'fixtures/refresh',
    owner: 'rook',
    runs: 4,
    retries: 3,
    lastStatus: 'ok',
    lastError: 'upstream 503',
    firstAt: '2026-10-28T01:00:00+01:00',
    lastAt: '2026-10-28T01:03:00+01:00',
  },
  {
    job: 'notes/backup',
    owner: 'lane-07',
    runs: 1,
    retries: 0,
    lastStatus: 'fail',
    lastError: 'quota exceeded',
    firstAt: '2026-10-28T04:00:01+01:00',
    lastAt: '2026-10-28T04:00:01+01:00',
  },
];

describe('digest routes', () => {
  let dir: string;
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
    writeFileSync(join(dir, `${NORMAL}.jsonl`), NORMAL_LOG);
    writeFileSync(join(dir, `${EMPTY}.jsonl`), '');
    writeFileSync(join(dir, `${BAD}.jsonl`), BAD_LOG);
    app = createApp({ ...CONFIG, runsDir: dir });
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe('GET /digest/:night', () => {
    it('renders a normal night: both jobs, retries and fail flagged', async () => {
      const res = await app.request(`/digest/${NORMAL}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain(`digest · ${NORMAL}`);
      expect(html).toContain('fixtures/refresh');
      expect(html).toContain('notes/backup');
      expect(html).toContain('class="warn"');
    });

    it('answers 404 with "no run log for" for a night with no file', async () => {
      const res = await app.request(`/digest/${MISSING}`);
      const html = await res.text();
      expect(res.status).toBe(404);
      expect(html).toContain('no run log for');
    });

    it('renders an empty night as "nothing ran"', async () => {
      const res = await app.request(`/digest/${EMPTY}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('nothing ran');
      expect(html).not.toContain('<table');
    });

    it('reports a bad line and still renders the good one', async () => {
      const res = await app.request(`/digest/${BAD}`);
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('1 line did not parse');
      expect(html).toContain('lane/sync');
    });

    it('answers 404 for a malformed night string', async () => {
      const res = await app.request(`/digest/${MALFORMED}`);
      const html = await res.text();
      expect(res.status).toBe(404);
      expect(html).toContain('no run log for');
    });
  });

  describe('GET /api/digest/:night', () => {
    it('returns the Night object for a normal night', async () => {
      const res = await app.request(`/api/digest/${NORMAL}`);
      const body: unknown = await res.json();
      expect(res.status).toBe(200);
      expect(body).toEqual({
        night: NORMAL,
        rows: NORMAL_ROWS,
        counts: { ok: 1, retry: 3, fail: 1 },
        badLines: 0,
      });
    });

    it('answers 404 with the error body for a night with no file', async () => {
      const res = await app.request(`/api/digest/${MISSING}`);
      const body: unknown = await res.json();
      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'no run log', night: MISSING });
    });

    it('returns no rows for an empty night', async () => {
      const res = await app.request(`/api/digest/${EMPTY}`);
      const body: unknown = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ night: EMPTY, rows: [], badLines: 0 });
    });

    it('counts a bad line and returns the good row', async () => {
      const res = await app.request(`/api/digest/${BAD}`);
      const body: unknown = await res.json();
      expect(res.status).toBe(200);
      expect(body).toMatchObject({ night: BAD, badLines: 1 });
      expect(body).toHaveProperty('rows', [
        expect.objectContaining({ job: 'lane/sync', owner: 'rook', runs: 1 }),
      ]);
    });

    it('answers 404 with the error body for a malformed night string', async () => {
      const res = await app.request(`/api/digest/${MALFORMED}`);
      const body: unknown = await res.json();
      expect(res.status).toBe(404);
      expect(body).toEqual({ error: 'no run log', night: MALFORMED });
    });
  });

  it('page and JSON list the jobs in the same order', async () => {
    const html = await (await app.request(`/digest/${NORMAL}`)).text();
    const body: unknown = await (await app.request(`/api/digest/${NORMAL}`)).json();
    const jobs = NORMAL_ROWS.map((r) => r.job);

    // The JSON is the source of truth for order.
    expect(body).toHaveProperty('rows', NORMAL_ROWS);

    const positions = jobs.map((job) => html.indexOf(job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
