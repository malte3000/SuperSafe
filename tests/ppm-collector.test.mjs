import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectPpm } from '../scripts/collect-ppm.mjs';
import { appendPpmSnapshot, parsePpmArchive, rankPpmFunds } from '../lib/funds/ppm-ranking.ts';

const now = new Date('2026-09-02T12:00:00.000Z');
const snapshot = (time = now.toISOString(), date = '2026-09-01', nav = 100) => ({
  fetchedAt: time, quotes: Array.from({ length: 100 }, (_, i) => ({ id: String(100000 + i), name: 'Testfond', date, nav })),
});
const csv = (date = '2026-09-01', nav = 100) => 'Fondnr;Fondnamn;Köpkurs;Säljkurs;Kursdatum\n' +
  Array.from({ length: 100 }, (_, i) => `${100000 + i};Testfond;${nav};${nav};${date}`).join('\n');
const archive = () => appendPpmSnapshot(null, snapshot(), now);
const responseCsv = (...args) => new Response(Buffer.from(csv(...args), 'latin1'));

test('archive validates all records, currency, source and collection provenance', () => {
  assert.equal(parsePpmArchive(archive(), now).snapshots.length, 1);
  for (const mutate of [a => a.currency = 'USD', a => a.source = 'https://example.com',
    a => a.schemaVersion = 2, a => a.lastSuccessAt = 'invalid', a => a.snapshots = [],
    a => a.snapshots[0].quotes.pop(), a => a.snapshots[0].quotes[1].id = '100000',
    a => a.snapshots[0].quotes[0].nav = -1, a => a.snapshots[0].quotes[0].date = '2026-09-03',
    a => a.snapshots[0].quotes[0] = null, a => a.snapshots[0].fetchedAt = 'invalid']) {
    const value = archive(); mutate(value); assert.throws(() => parsePpmArchive(value, now));
  }
  assert.throws(() => parsePpmArchive(archive(), new Date(now.getTime() - 1)));
});
test('new snapshots preserve history and corrections, repeated timestamps fail', () => {
  const first = appendPpmSnapshot(null, snapshot('2026-09-01T12:00:00.000Z', '2026-08-31'), now);
  const second = appendPpmSnapshot(first, snapshot(), now);
  assert.equal(second.snapshots.length, 2);
  assert.equal(rankPpmFunds(second.snapshots, now).comparedFunds, 100);
  assert.throws(() => appendPpmSnapshot(second, snapshot(), now));
  const correctedTime = new Date('2026-09-02T13:00:00Z');
  const corrected = appendPpmSnapshot(second, snapshot(correctedTime.toISOString(), '2026-09-01', 101), correctedTime);
  assert.ok(Math.abs(rankPpmFunds(corrected.snapshots, correctedTime).funds[0].changePercent - 1) < 1e-10);
});
test('recent bundle is bounded to 48 snapshots and ten days', () => {
  let recent = null;
  for (let i = 0; i < 60; i++) {
    const date = new Date(now.getTime() + i * 60000);
    recent = appendPpmSnapshot(recent, snapshot(date.toISOString()), date);
  }
  assert.equal(recent.snapshots.length, 48);
  const later = new Date('2026-09-15T12:00:00Z');
  assert.equal(appendPpmSnapshot(recent, snapshot(later.toISOString(), '2026-09-14'), later).snapshots.length, 1);
});
test('collector archives original bytes and parsed data, preserving previous collections', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'supersafe-ppm-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = await collectPpm({ directory, now: () => now, fetcher: async () => responseCsv(), attempts: 1 });
  assert.equal(first.funds, 100);
  const later = new Date('2026-09-03T12:00:00Z');
  await collectPpm({ directory, now: () => later, fetcher: async () => responseCsv('2026-09-02', 102), attempts: 1 });
  const recent = JSON.parse(await readFile(join(directory, 'recent.json'), 'utf8'));
  assert.equal(recent.snapshots.length, 2);
  assert.equal((await readdir(join(directory, 'snapshots'))).length, 2);
  assert.equal(await readFile(join(directory, 'snapshots', '2026-09-02', '2026-09-02T12-00-00.000Z.csv'), 'latin1'), csv());
  assert.equal(rankPpmFunds(recent.snapshots, later).comparedFunds, 100);
});
test('failed or malformed sources never overwrite last good archive', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'supersafe-ppm-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await collectPpm({ directory, now: () => now, fetcher: async () => responseCsv(), attempts: 1 });
  const before = await readFile(join(directory, 'recent.json'), 'utf8');
  for (const fetcher of [async () => new Response('', { status: 503 }), async () => new Response('invalid'),
    async () => responseCsv('2026-08-31'),
    async () => new Response(csv().replaceAll(/100\d{3}/g, id => String(Number(id) + 1000))),
    async () => new Response(csv().split('\n').slice(0, 10).join('\n')), async () => { throw new Error('offline'); }]) {
    await assert.rejects(collectPpm({ directory, now: () => new Date('2026-09-03T12:00:00Z'), fetcher, attempts: 1 }));
    assert.equal(await readFile(join(directory, 'recent.json'), 'utf8'), before);
    assert.deepEqual(await readdir(join(directory, 'snapshots')), ['2026-09-02']);
  }
  await writeFile(join(directory, 'recent.json'), 'broken');
  await assert.rejects(collectPpm({ directory, now: () => now, fetcher: async () => responseCsv(), attempts: 1 }));
  assert.equal(await readFile(join(directory, 'recent.json'), 'utf8'), 'broken');
});
