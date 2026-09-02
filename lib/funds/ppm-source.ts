import { env } from 'cloudflare:workers';
import baseline from './ppm-baseline.json';
import { loadPpmArchive } from './ppm-archive-source';
import { PPM_QUOTES_URL, decodePpmCsv, parsePpmCsv, rankPpmFunds, stockholmDate, type PpmRanking, type PpmSnapshot } from './ppm-ranking';

const CACHE_MS = 60 * 60 * 1000;
const seed: PpmSnapshot = baseline;
let inFlight: Promise<PpmRanking> | undefined;

function getStorage(): R2Bucket {
  const bucket = (env as unknown as { PPM_DATA?: R2Bucket }).PPM_DATA;
  if (!bucket) throw new Error('PPM storage is unavailable');
  return bucket;
}

async function loadRanking(): Promise<PpmRanking> {
  const now = new Date();
  const bucket = getStorage();
  const archiveRequest = loadPpmArchive(bucket, now);
  const cached = await bucket.get('ppm/latest.json');
  let latest = cached ? await cached.json<PpmSnapshot>() : seed;
  let sourceUnavailable = false;

  if (!cached || now.getTime() - Date.parse(latest.fetchedAt) >= CACHE_MS) {
    try {
      const response = await fetch(PPM_QUOTES_URL, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`PPM source returned ${response.status}`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 2_000_000) throw new Error('PPM feed is unexpectedly large');
      const quotes = parsePpmCsv(decodePpmCsv(buffer), now);
      // Fail closed for truncated feeds; the normal feed contains hundreds of funds.
      if (quotes.length < 100) throw new Error('PPM feed is incomplete');
      latest = { fetchedAt: now.toISOString(), quotes };
    } catch {
      sourceUnavailable = true;
    }
    if (!sourceUnavailable) {
      const date = latest.quotes.reduce((max, quote) => quote.date > max ? quote.date : max, '');
      const body = JSON.stringify(latest);
      // Only successful complete feeds replace the last known good snapshot.
      await bucket.put(`ppm/days/${date}.json`, body, { httpMetadata: { contentType: 'application/json' } });
      await bucket.put('ppm/latest.json', body, { httpMetadata: { contentType: 'application/json' } });
    }
  }

  const snapshots: PpmSnapshot[] = [seed, latest];
  const today = stockholmDate(now);
  const history = await Promise.all(Array.from({ length: 9 }, async (_, index) => {
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - index);
    const object = await bucket.get(`ppm/days/${date.toISOString().slice(0, 10)}.json`);
    return object ? object.json<PpmSnapshot>() : null;
  }));
  for (const snapshot of history) if (snapshot) snapshots.push(snapshot);
  const archive = await archiveRequest;
  snapshots.push(...archive.snapshots);
  return { ...rankPpmFunds(snapshots, now), sourceUnavailable, collection: archive.collection };
}

export async function getPpmRanking(): Promise<PpmRanking> {
  if (!inFlight) inFlight = loadRanking().finally(() => { inFlight = undefined; });
  return inFlight;
}
