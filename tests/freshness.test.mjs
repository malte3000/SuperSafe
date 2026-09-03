import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDataDate, formatFetchTime, rankingDate } from '../lib/funds/freshness.ts';
import { rankPpmFunds } from '../lib/funds/ppm-ranking.ts';

test('observation date and retrieval timestamp remain distinct across Swedish midnight', () => {
  assert.equal(formatDataDate('2026-09-01'), '1 september 2026');
  assert.match(formatFetchTime('2026-09-01T22:30:00Z'), /2 september 2026.*00:30.*svensk tid/);
});
test('timestamps respect both Swedish daylight and standard time', () => {
  assert.match(formatFetchTime('2026-09-02T12:00:00Z'), /14:00/);
  assert.match(formatFetchTime('2026-12-02T12:00:00Z'), /13:00/);
  assert.equal(formatFetchTime('2026-09-02T14:00:00+02:00'), formatFetchTime('2026-09-02T12:00:00Z'));
});
test('missing and invalid dates never become today or a fabricated fetch time', () => {
  for (const input of [null, undefined, '', 'invalid', '2026-02-30', '2026-09-02T12:00:00Z']) assert.equal(formatDataDate(input), 'Okänt datum');
  for (const input of [null, undefined, '', 'invalid', '2026-09-02', '2026-09-02T12:00:00']) assert.equal(formatFetchTime(input), 'Hämtningstid saknas');
});
test('ready ranking labels the displayed date, not a newer unmatched quote', () => {
  assert.equal(rankingDate({ status: 'ready', date: '2026-09-01', latestQuoteDate: '2026-09-02' }), '2026-09-01');
  assert.equal(rankingDate({ status: 'waiting', date: null, latestQuoteDate: '2026-09-02' }), '2026-09-02');
  assert.equal(rankingDate({ status: 'waiting', date: null, latestQuoteDate: null }), null);
});
test('a fresh retrieval of old prices never makes them current', () => {
  const now = new Date('2026-09-03T12:00:00Z');
  const snapshots = ['2026-08-20', '2026-08-21'].map((date, day) => ({
    fetchedAt: `2026-09-03T${day === 0 ? '10' : '11'}:00:00Z`,
    quotes: Array.from({ length: 5 }, (_, i) => ({ id: String(100000 + i), name: `Fond ${i}`, date, nav: 100 + day })),
  }));
  const result = rankPpmFunds(snapshots, now);
  assert.equal(result.stale, true);
  assert.equal(result.status, 'waiting');
  assert.equal(rankingDate(result), '2026-08-21');
  assert.match(formatFetchTime(result.fetchedAt), /3 september 2026/);
});
