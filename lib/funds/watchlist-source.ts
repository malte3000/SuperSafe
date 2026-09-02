import { env } from 'cloudflare:workers';
import baseline from './watchlist-baseline.json';
import { WATCHLIST_API, buildWatchlists, parseWatchSource, type WatchSnapshot, type WatchlistData } from './watchlists';

let inFlight: Promise<WatchlistData> | undefined;
async function loadWatchlists(): Promise<WatchlistData> {
  const now = new Date();
  const bucket = (env as unknown as { PPM_DATA?: R2Bucket }).PPM_DATA;
  if (!bucket) throw new Error('Watchlist storage is unavailable');
  const cached = await bucket.get('watchlist/latest.json');
  let snapshot: WatchSnapshot = cached ? await cached.json<WatchSnapshot>() : baseline;
  let sourceUnavailable = false;
  if (!cached || now.getTime() - Date.parse(snapshot.fetchedAt) > 6 * 3600000) {
    try {
      const response = await fetch(WATCHLIST_API, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Fund source unavailable');
      const body = await response.text();
      if (body.length > 2_000_000) throw new Error('Fund source too large');
      const next = { fetchedAt: now.toISOString(), funds: parseWatchSource(JSON.parse(body)) };
      buildWatchlists(next, now);
      await bucket.put('watchlist/latest.json', JSON.stringify(next), { httpMetadata: { contentType: 'application/json' } });
      snapshot = next;
    } catch { sourceUnavailable = true; }
  }
  return { ...buildWatchlists(snapshot, now), sourceUnavailable };
}

export function getWatchlists(): Promise<WatchlistData> {
  if (!inFlight) inFlight = loadWatchlists().finally(() => { inFlight = undefined; });
  return inFlight;
}
