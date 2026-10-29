import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('answers 200 with the night, rows in page order', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string }[]; badLines: number };
    expect(body.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(body.badLines).toBe(1);
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/1999-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log', night: '1999-01-01' });
  });
});
