import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePpmCsv, parsePpmCsv, previousWeekday, rankPpmFunds } from '../lib/funds/ppm-ranking.ts';

const now = new Date('2026-09-02T12:00:00Z');
const header = '\uFEFFFondnr;Fondnamn;Köpkurs;Säljkurs;Kursdatum \r\n';
const row = '123456;"Test; fond ""A""";101;100,50;2026-08-31';
test('Windows-1252 decoding works in the Workers runtime without legacy TextDecoder', () => {
  assert.equal(decodePpmCsv(Uint8Array.from([197,196,214,229,228,246,128,150]).buffer), 'ÅÄÖåäö€–');
});
const snapshot = (date, values, fetchedAt = `${date}T12:00:00Z`) => ({
  fetchedAt,
  quotes: values.map((nav, i) => ({ id: String(100000 + i), name: `Testfond ${i}`, date, nav })),
});

test('CSV handles Swedish numbers, BOM, spaces, quoted delimiters and escaped quotes', () => {
  assert.deepEqual(parsePpmCsv(header + row, now), [{ id: '123456', name: 'Test; fond "A"', nav: 100.5, date: '2026-08-31' }]);
});
test('CSV rejects empty, malformed, duplicate, nonpositive and future quotes', () => {
  for (const csv of ['', header, header + row + '\n' + row,
    header + row.replace('100,50', '0'), header + row.replace('2026-08-31', '2026-09-03'),
    header + row.replace('2026-08-31', '2026-02-30'), header + '"unfinished']) {
    assert.throws(() => parsePpmCsv(csv, now));
  }
});
test('one day and same-day repeated fetches never produce a daily ranking', () => {
  const first = snapshot('2026-08-31', [100, 100, 100, 100, 100]);
  assert.equal(rankPpmFunds([first], now).status, 'waiting');
  const later = snapshot('2026-08-31', [110, 110, 110, 110, 110], '2026-09-01T12:00:00Z');
  assert.equal(rankPpmFunds([first, later], now).status, 'waiting');
});
test('Monday compares Friday, ranks numerically and shows only five', () => {
  assert.equal(previousWeekday('2026-08-31'), '2026-08-28');
  const result = rankPpmFunds([
    snapshot('2026-08-28', [100, 100, 100, 100, 100, 100]),
    snapshot('2026-08-31', [101, 112, 99, 103, 102, 100]),
  ], now);
  assert.equal(result.status, 'ready');
  assert.equal(result.comparedFunds, 6);
  assert.equal(result.previousDate, '2026-08-28');
  assert.deepEqual(result.funds.map(f => f.id), ['100001', '100003', '100004', '100000', '100005']);
  assert.ok(Math.abs(result.funds[0].changePercent - 12) < 1e-10);
});
test('missing weekdays and fewer than five pairs do not become top five', () => {
  const first = snapshot('2026-08-27', [100, 100, 100, 100, 100]);
  const last = snapshot('2026-08-31', [105, 106, 107, 108, 109]);
  assert.equal(rankPpmFunds([first, last], now).status, 'waiting');
  assert.equal(rankPpmFunds([snapshot('2026-08-28', [100, 100, 100, 100]), last], now).status, 'waiting');
});
test('negative changes retain their signs and newest corrections win', () => {
  const result = rankPpmFunds([
    snapshot('2026-08-28', [100, 100, 100, 100, 100]),
    snapshot('2026-08-31', [99, 98, 97, 96, 95]),
    snapshot('2026-08-31', [90, 98, 97, 96, 95], '2026-09-01T12:00:00Z'),
  ], now);
  assert.equal(result.funds[0].id, '100001');
  assert.ok(result.funds.every(f => f.changePercent < 0));
  assert.equal(result.funds[4].nav, 90);
});
test('old rankings are not presented as recent daily performance', () => {
  const result = rankPpmFunds([snapshot('2026-08-20', [100,100,100,100,100]), snapshot('2026-08-21', [101,102,103,104,105])], now);
  assert.equal(result.status, 'waiting');
  assert.equal(result.stale, true);
});
