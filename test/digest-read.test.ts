import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('reads 5 jobs and counts 1 bad line', () => {
    expect(night).not.toBeNull();
    expect(night!.rows).toHaveLength(5);
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('fills retries, last status and last error', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a null owner', () => {
    expect(row('digest/render')?.owner).toBeNull();
  });

  it('keeps the offset from the log', () => {
    expect(row('lane/sync')?.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(row('fixtures/refresh')?.firstAt.endsWith('+01:00')).toBe(true);
    expect(row('fixtures/refresh')?.lastAt).toBe('2026-10-29T01:37:00+01:00');
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('returns null for a night with no file', () => {
    expect(readNight(dir, '2026-01-01')).toBeNull();
  });

  it('returns no rows for an empty file', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '\n  \n');
    expect(readNight(dir, '2026-01-02')).toEqual({
      night: '2026-01-02',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    expect(readNight(dir, '../runs/2026-10-28')).toBeNull();
    expect(readNight(dir, 'latest')).toBeNull();
  });

  it('counts a line with an unknown status as bad', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-03T02:00:00+01:00","job":"a","status":"done","owner":"x"}',
      ].join('\n'),
    );
    const n = readNight(dir, '2026-01-03');
    expect(n?.badLines).toBe(1);
    expect(n?.rows).toHaveLength(1);
    expect(n?.counts).toEqual({ ok: 1, retry: 0, fail: 0 });
  });

  it('orders by instant, not by string, and keeps each offset', () => {
    writeFileSync(
      join(dir, '2026-01-04.jsonl'),
      [
        '{"at":"2026-01-04T01:30:00+01:00","job":"b","status":"fail","owner":"x","error":"late"}',
        '{"at":"2026-01-04T01:00:00Z","job":"b","status":"ok","owner":"y"}',
      ].join('\n'),
    );
    const r = readNight(dir, '2026-01-04')?.rows[0];
    expect(r).toMatchObject({
      firstAt: '2026-01-04T01:30:00+01:00',
      lastAt: '2026-01-04T01:00:00Z',
      lastStatus: 'ok',
      owner: 'y',
      lastError: 'late',
    });
  });
});
