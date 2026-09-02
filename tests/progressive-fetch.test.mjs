import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFundProgressively } from '../lib/funds/progressive-fetch.ts';

test('publishes saved data before a slow update completes', async () => {
  const seen = [];
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const run = fetchFundProgressively({ url: '/api/funds/watchlists', signal: new AbortController().signal,
    onData: data => seen.push(data), fetcher: async (url, options) => {
      assert.equal(options.cache, 'no-store');
      if (url.endsWith('refresh=1')) { assert.deepEqual(seen, [{ version: 'saved' }]); return pending; }
      return Response.json({ version: 'saved' });
    } });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(seen, [{ version: 'saved' }]);
  finish(Response.json({ version: 'updated' }));
  await run;
  assert.deepEqual(seen, [{ version: 'saved' }, { version: 'updated' }]);
});
test('failed update preserves displayed data and propagates the error', async () => {
  const seen = [];
  await assert.rejects(fetchFundProgressively({ url: '/api/funds/top-daily', signal: new AbortController().signal,
    onData: data => seen.push(data), fetcher: async url => url.endsWith('refresh=1')
      ? new Response('', { status: 503 }) : Response.json({ fetchedAt: 'original' }) }));
  assert.deepEqual(seen, [{ fetchedAt: 'original' }]);
});
test('update recovers if the initial saved read failed', async () => {
  const seen = [];
  await fetchFundProgressively({ url: '/api/funds/top-daily', signal: new AbortController().signal,
    onData: data => seen.push(data), fetcher: async url => url.endsWith('refresh=1')
      ? Response.json({ version: 'updated' }) : new Response('', { status: 503 }) });
  assert.deepEqual(seen, [{ version: 'updated' }]);
});
test('aborted or superseded requests never publish late data', async () => {
  const controller = new AbortController();
  const seen = [];
  let calls = 0;
  await assert.rejects(fetchFundProgressively({ url: '/api/funds/top-daily', signal: controller.signal,
    onData: data => seen.push(data), fetcher: async () => { calls++; controller.abort(); return Response.json({ version: 'late' }); } }));
  assert.deepEqual(seen, []);
  assert.equal(calls, 1);
});
test('aborting an update keeps the already published saved value', async () => {
  const controller = new AbortController();
  const seen = [];
  await assert.rejects(fetchFundProgressively({ url: '/api/funds/top-daily', signal: controller.signal,
    onData: data => seen.push(data), fetcher: async url => {
      if (url.endsWith('refresh=1')) { controller.abort(); return Response.json({ version: 'late' }); }
      return Response.json({ version: 'saved' });
    } }));
  assert.deepEqual(seen, [{ version: 'saved' }]);
});
