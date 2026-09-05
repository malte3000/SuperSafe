import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FAVORITES_KEY, MAX_FAVORITES, favoriteKey, readFavorites, setFavorite } from '../lib/funds/favorites.ts';
import { fiFundToFund } from '../lib/funds/fi-funds.ts';

const fi = { source: 'fi', id: 'SE0002801290', name: 'Sensor Sverige Select' };
const ppm = { source: 'ppm', id: '303701', name: 'Sensor Sverige Select' };
function storage(initial = null) {
  let raw = initial;
  return { getItem(key) { assert.equal(key, FAVORITES_KEY); return raw; }, setItem(key, value) { assert.equal(key, FAVORITES_KEY); raw = value; } };
}

test('empty storage starts empty and saving survives a new read', () => {
  const db = storage(); assert.deepEqual(readFavorites(db), []);
  assert.deepEqual(setFavorite(db, fi, true), [fi]);
  assert.deepEqual(readFavorites(db), [fi]);
});
test('save and removal are idempotent and do not duplicate the same fund', () => {
  const db = storage(); setFavorite(db, fi, true); setFavorite(db, fi, true);
  assert.equal(readFavorites(db).length, 1);
  setFavorite(db, fi, false); setFavorite(db, fi, false);
  assert.deepEqual(readFavorites(db), []);
});
test('same name across PPM and FI remains two separate source identities', () => {
  const db = storage(); setFavorite(db, fi, true); setFavorite(db, ppm, true);
  assert.notEqual(favoriteKey(fi), favoriteKey(ppm));
  assert.equal(readFavorites(db).length, 2);
  assert.deepEqual(setFavorite(db, ppm, false), [fi]);
});
test('a changed name updates the same identity and no financial fields are retained', () => {
  const db = storage(); setFavorite(db, fi, true);
  setFavorite(db, { ...fi, name: ' Nytt namn ', nav: 99, holdings: ['private'] }, true);
  assert.deepEqual(readFavorites(db), [{ ...fi, name: 'Nytt namn' }]);
  assert.doesNotMatch(db.getItem(FAVORITES_KEY), /nav|holdings|private/);
});
test('reads latest storage on every action, preserving another tabs existing changes', () => {
  const db = storage(); const staleUi = readFavorites(db);
  setFavorite(db, fi, true); // another tab
  assert.deepEqual(staleUi, []);
  assert.deepEqual(setFavorite(db, ppm, true), [ppm, fi]);
});
test('invalid format, unknown versions and invalid IDs are not overwritten', () => {
  for (const raw of ['broken', 'null', JSON.stringify({ version: 2, funds: [fi] }),
    JSON.stringify({ version: 1, funds: [{ ...fi, source: 'demo' }] }),
    JSON.stringify({ version: 1, funds: [{ ...ppm, id: '123/evil' }] }),
    JSON.stringify({ version: 1, funds: [{ ...fi, name: '' }] })]) {
    const db = storage(raw);
    assert.throws(() => setFavorite(db, fi, true));
    assert.equal(db.getItem(FAVORITES_KEY), raw);
  }
});
test('storage permission and quota failures surface without pretending to save', () => {
  assert.throws(() => readFavorites({ getItem() { throw new Error('denied'); } }), /denied/);
  const db = storage(JSON.stringify({ version: 1, funds: [fi] }));
  assert.throws(() => setFavorite({ getItem: key => db.getItem(key), setItem() { throw new Error('quota'); } }, ppm, true), /quota/);
  assert.deepEqual(readFavorites(db), [fi]);
});
test('limit prevents new favorites but never blocks removal', () => {
  const funds = Array.from({ length: MAX_FAVORITES }, (_, i) => ({ ...ppm, id: String(100000 + i) }));
  const db = storage(JSON.stringify({ version: 1, funds }));
  assert.throws(() => setFavorite(db, fi, true), /högst 100/);
  assert.equal(setFavorite(db, funds[0], true).length, MAX_FAVORITES);
  assert.equal(setFavorite(db, funds[0], false).length, MAX_FAVORITES - 1);
  assert.equal(setFavorite(db, fi, true).length, MAX_FAVORITES);
});
test('all FI dataset IDs are supported and remain exact through analysis conversion', () => {
  const dataset = JSON.parse(readFileSync(new URL('../public/data/fi-funds-latest.json', import.meta.url), 'utf8'));
  for (const fund of dataset.funds) {
    assert.equal(fiFundToFund(fund).sourceId, fund.id);
    assert.equal(setFavorite(storage(), { source: 'fi', id: fund.id, name: fund.name }, true)[0].id, fund.id);
  }
});
