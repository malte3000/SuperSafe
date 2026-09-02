import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Run the actual Workers adapters with a fake bucket and fake outbound network.
// These hooks are scoped to this test process, not used by the application.
const memory = new Map();
let writes = 0;
globalThis.__fastReadBucket = {
  async get(key) { return memory.has(key) ? { json: async () => JSON.parse(memory.get(key)) } : null; },
  async put(key, body) { writes++; memory.set(key, body); },
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = { PPM_DATA: globalThis.__fastReadBucket };', shortCircuit: true };
    if (specifier.startsWith('./') && context.parentURL?.endsWith('.ts')) {
      const candidate = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/ppm-baseline.json') || url.endsWith('/watchlist-baseline.json'))
      return { format: 'module', source: `export default ${readFileSync(new URL(url), 'utf8')}`, shortCircuit: true };
    return next(url, context);
  },
});
const { getPpmRanking } = await import('../lib/funds/ppm-source.ts');
const { getWatchlists } = await import('../lib/funds/watchlist-source.ts');
const ppm = JSON.parse(readFileSync(new URL('../lib/funds/ppm-baseline.json', import.meta.url), 'utf8'));
const watch = JSON.parse(readFileSync(new URL('../lib/funds/watchlist-baseline.json', import.meta.url), 'utf8'));
const oldTime = hours => new Date(Date.now() - hours * 3600000).toISOString();

function seed() {
  memory.clear(); writes = 0;
  memory.set('ppm/latest.json', JSON.stringify({ ...ppm, fetchedAt: oldTime(2), sourceUnavailable: true }));
  memory.set('watchlist/latest.json', JSON.stringify({ ...watch, fetchedAt: oldTime(7), sourceUnavailable: true }));
}
test('fast paths make zero external requests or writes, preserving timestamps and warnings', async t => {
  seed();
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Network must not be used'); };
  const before = JSON.parse(memory.get('watchlist/latest.json')).fetchedAt;
  const lists = await getWatchlists(true);
  const daily = await getPpmRanking(true);
  assert.equal(calls, 0); assert.equal(writes, 0);
  assert.equal(lists.fetchedAt, before); assert.equal(lists.sourceUnavailable, true);
  assert.equal(daily.sourceUnavailable, true);
  assert.equal(lists.watch.length, 10);
});
test('fast read never waits for an in-flight watchlist refresh', { timeout: 2000 }, async t => {
  seed();
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let finish;
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  globalThis.fetch = () => { started(); return new Promise(resolve => { finish = resolve; }); };
  const pending = getWatchlists();
  await startedPromise;
  const read = await getWatchlists(true);
  assert.equal(read.watch.length, 10);
  finish(new Response('', { status: 503 }));
  const failed = await pending;
  assert.equal(failed.sourceUnavailable, true);
  assert.equal(failed.fetchedAt, read.fetchedAt);
  assert.equal((await getWatchlists(true)).sourceUnavailable, true);
});
test('daily saved data is readable while both upstream sources are slow', { timeout: 2000 }, async t => {
  seed();
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const finish = [];
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  globalThis.fetch = () => new Promise(resolve => { finish.push(resolve); if (finish.length === 2) started(); });
  const pending = getPpmRanking();
  await startedPromise;
  const fast = await getPpmRanking(true);
  assert.equal(fast.fetchedAt, JSON.parse(memory.get('ppm/latest.json')).fetchedAt);
  finish.forEach(resolve => resolve(new Response('', { status: 503 })));
  const failed = await pending;
  assert.equal(failed.sourceUnavailable, true);
  assert.equal((await getPpmRanking(true)).sourceUnavailable, true);
});
test('fast reads still expire old lists rather than labelling them current', async () => {
  seed();
  memory.set('watchlist/latest.json', JSON.stringify({ ...watch, fetchedAt: oldTime(8 * 24) }));
  const lists = await getWatchlists(true);
  assert.equal(lists.expired, true); assert.deepEqual(lists.watch, []);
  assert.deepEqual(lists.review, []); assert.deepEqual(lists.peers, []);
});
test('fast read works with empty storage and never fetches the source', async t => {
  memory.clear(); writes = 0;
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No network'); };
  const daily = await getPpmRanking(true);
  const lists = await getWatchlists(true);
  assert.equal(daily.fetchedAt, ppm.fetchedAt);
  assert.equal(lists.fetchedAt, watch.fetchedAt);
  assert.equal(calls, 0); assert.equal(writes, 0);
});
