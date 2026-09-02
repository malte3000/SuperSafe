import { env } from 'cloudflare:workers';
import baseline from './watchlist-baseline.json';
import { WATCHLIST_API, assertWatchUpdate, buildWatchlists, parseWatchSource, type WatchSnapshot, type WatchlistData } from './watchlists';

let inFlight: Promise<WatchlistData> | undefined;
async function loadWatchlists(readOnly = false): Promise<WatchlistData> {
  const now = new Date();
  const bucket = (env as unknown as { PPM_DATA?: R2Bucket }).PPM_DATA;
  if (!bucket) throw new Error('Watchlist storage is unavailable');
  const cached = await bucket.get('watchlist/latest.json');
  let snapshot: WatchSnapshot & { sourceUnavailable?: boolean; qualityRejected?: boolean } = cached ? await cached.json<WatchSnapshot>() : baseline;
  let sourceUnavailable = snapshot.sourceUnavailable === true;
  let qualityRejected = snapshot.qualityRejected === true;
  if (!readOnly && (!cached || now.getTime() - Date.parse(snapshot.fetchedAt) > 6 * 3600000)) {
    let received = false;
    let validated = false;
    try {
      const response = await fetch(WATCHLIST_API, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Fund source unavailable');
      received = true;
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error('Fund source too large');
      const next = { fetchedAt: now.toISOString(), funds: parseWatchSource(JSON.parse(body)) };
      assertWatchUpdate(snapshot, next);
      buildWatchlists(next, now);
      validated = true;
      await bucket.put('watchlist/latest.json', JSON.stringify(next), { httpMetadata: { contentType: 'application/json' } });
      snapshot = next;
      sourceUnavailable = false;
      qualityRejected = false;
    } catch {
      sourceUnavailable = true;
      qualityRejected = received && !validated;
      await bucket.put('watchlist/latest.json', JSON.stringify({ ...snapshot, sourceUnavailable: true, qualityRejected }), { httpMetadata: { contentType: 'application/json' } });
    }
  }
  return { ...buildWatchlists(snapshot, now), sourceUnavailable, qualityRejected };
}

export function getWatchlists(readOnly = false): Promise<WatchlistData> {
  if (readOnly) return loadWatchlists(true);
  if (!inFlight) inFlight = loadWatchlists().finally(() => { inFlight = undefined; });
  return inFlight;
}
