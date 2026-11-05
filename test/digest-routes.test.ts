import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runsDir = 'runs'; // read-only fixtures; these tests never write here
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir };

const scratch = mkdtempSync(join(tmpdir(), 'digest-routes-'));
const scratchConfig = { ...config, runsDir: scratch };
writeFileSync(join(scratch, '2026-11-01.jsonl'), '');
writeFileSync(
  join(scratch, '2026-11-02.jsonl'),
  [
    '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
    'not json',
  ].join('\n'),
);
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// Text of the table rows, in order, as "job|..." strings: enough to compare page and JSON.
function pageJobs(html: string): string[] {
  const body = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
  return [...body.matchAll(/<tr>\s*<td>([^<]+)<\/td>/g)].map((m) => m[1]);
}

describe('status board links to digests (plan § 2c)', () => {
  it('links each night on disk to its digest, with ok / retry / fail counts', async () => {
    const html = await (await createApp(config).request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok 10');
    expect(html).toContain('retry 4');
    expect(html).toContain('fail 1');
  });

  it('both nights on disk link to a digest that renders', async () => {
    const app = createApp(config);
    expect((await app.request('/digest/2026-10-27')).status).toBe(200);
    expect((await app.request('/digest/2026-10-28')).status).toBe(200);
  });
});

describe('GET /api/digest/:night (JSON, plan § 2b)', () => {
  it('returns the real night 2026-10-28 with the same jobs, in the same order, as the page', async () => {
    const app = createApp(config);
    const json = await app.request('/api/digest/2026-10-28');
    expect(json.status).toBe(200);
    const body = (await json.json()) as { rows: { job: string }[] };
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(body.rows.map((r) => r.job)).toEqual(pageJobs(html));
  });

  it('returns 404 JSON for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2001-01-01');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'no run log for that night' });
  });
});

describe('GET /digest/:night (page, plan § 2a)', () => {
  it('renders the real night 2026-10-28 with one row per job', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(pageJobs(html)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('marks the failing job and the job with 3 or more retries', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-28')).text();
    expect(html).toContain('fail ×1');
    expect(html).toContain('retry ×3');
  });

  it('shows missing owner and error as the dash, not an empty cell', async () => {
    const html = await (await createApp(config).request('/digest/2026-10-28')).text();
    expect(html).toContain('<td>—</td>'); // digest/render has no owner
  });

  it('returns 404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2001-01-01');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty file', async () => {
    const res = await createApp(scratchConfig).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('renders a night with a bad line and says how many lines were skipped', async () => {
    const res = await createApp(scratchConfig).request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(pageJobs(html)).toEqual(['a']); // the good line still renders
    expect(html).toContain('1 unreadable line(s) skipped');
  });
});
