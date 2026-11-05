import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

const runsDir = 'runs'; // read-only fixtures; this test never writes here
const scratch = mkdtempSync(join(tmpdir(), 'digest-reader-'));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('readNight on the real night 2026-10-28', () => {
  const night = readNight(runsDir, '2026-10-28');

  it('finds the file and gives one row per job, sorted by job', () => {
    expect(night).not.toBeNull();
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts the one unparseable (cut-off) line as bad, not as an error', () => {
    expect(night!.badLines).toBe(1);
  });

  it('counts valid lines by status for the whole night', () => {
    // 15 valid lines: 10 ok, 4 retry, 1 fail (the cut-off last line is not counted)
    expect(night!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('counts failures per job', () => {
    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.fails).toBe(1);
    const fixtures = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures.fails).toBe(0);
  });

  it('counts runs and retries per job', () => {
    const sync = night!.rows.find((r) => r.job === 'lane/sync')!;
    expect(sync.runs).toBe(8);
    expect(sync.retries).toBe(1);
    expect(sync.owner).toBe('rook');
    expect(sync.lastStatus).toBe('ok');

    const fixtures = night!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fixtures.runs).toBe(4);
    expect(fixtures.retries).toBe(3);
    expect(fixtures.lastStatus).toBe('ok');
    expect(fixtures.lastError).toBe('upstream 503');
  });

  it('keeps a failing job with its error and owner', () => {
    const backup = night!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup.lastStatus).toBe('fail');
    expect(backup.lastError).toBe('quota exceeded');
    expect(backup.owner).toBe('lane-07');
  });

  it('keeps a row whose owner is null and shows it as null', () => {
    const render = night!.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
    expect(render.runs).toBe(1);
  });

  it('keeps first and last times as they were written', () => {
    const sync = night!.rows.find((r) => r.job === 'lane/sync')!;
    expect(sync.firstAt).toBe('2026-10-28T23:00:06+01:00');
    expect(sync.lastAt).toBe('2026-10-29T05:00:04+01:00');
  });
});

describe('readNight edge cases', () => {
  it('returns null for a night with no file', () => {
    expect(readNight(runsDir, '2001-01-01')).toBeNull();
  });

  it('refuses a night name that is not a plain date', () => {
    expect(readNight(runsDir, '../runs/2026-10-28')).toBeNull();
    expect(readNight(runsDir, '2026-10-28.jsonl')).toBeNull();
  });

  it('gives zero rows, not null, for an empty file', () => {
    writeFileSync(join(scratch, '2026-11-01.jsonl'), '');
    expect(readNight(scratch, '2026-11-01')).toEqual({
      night: '2026-11-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('counts lines that are valid JSON but the wrong shape as bad', () => {
    writeFileSync(
      join(scratch, '2026-11-02.jsonl'),
      [
        '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-11-02T01:00:00+01:00","job":"a","status":"weird","owner":"x"}',
        '[1,2,3]',
        'not json',
        '',
      ].join('\n'),
    );
    const night = readNight(scratch, '2026-11-02')!;
    expect(night.rows).toHaveLength(1);
    expect(night.badLines).toBe(3);
  });
});
