import { env } from 'cloudflare:workers';
import baseline from './ppm-baseline.json';
import { loadPpmArchive } from './ppm-archive-source';
import { PPM_QUOTES_URL, PpmDataError, assertPpmUpdate, decodePpmCsv, parsePpmCsv, rankPpmFunds, stockholmDate, type PpmRanking, type PpmSnapshot, type PpmSourceIssue } from './ppm-ranking';

const CACHE_MS = 60 * 60 * 1000;
const seed: PpmSnapshot = baseline;
let inFlight: Promise<PpmRanking> | undefined;

function getStorage(): R2Bucket {
  const bucket = (env as unknown as { PPM_DATA?: R2Bucket }).PPM_DATA;
  if (!bucket) throw new Error('PPM storage is unavailable');
  return bucket;
}

async function loadRanking(readOnly = false): Promise<PpmRanking> {
  const now = new Date();
  const bucket = getStorage();
  const archiveRequest = loadPpmArchive(bucket, now, readOnly);
  const cached = await bucket.get('ppm/latest.json');
  let latest: PpmSnapshot & { sourceUnavailable?: boolean; sourceIssue?: PpmSourceIssue } = cached ? await cached.json() : seed;
  let sourceUnavailable = 'sourceUnavailable' in latest && latest.sourceUnavailable === true;
  let sourceIssue = latest.sourceIssue;

  if (!readOnly && (!cached || now.getTime() - Date.parse(latest.fetchedAt) >= CACHE_MS)) {
    let received = false;
    try {
      const response = await fetch(PPM_QUOTES_URL, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`PPM source returned ${response.status}`);
      received = true;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 2_000_000) throw new Error('PPM feed is unexpectedly large');
      const quotes = parsePpmCsv(decodePpmCsv(buffer), now);
      // Fail closed for truncated feeds; the normal feed contains hundreds of funds.
      if (quotes.length < 100) throw new Error('PPM feed is incomplete');
      const next = { fetchedAt: now.toISOString(), quotes };
      assertPpmUpdate(latest, next, now);
      latest = next;
      sourceUnavailable = false;
      sourceIssue = undefined;
    } catch (error) {
      sourceUnavailable = true;
      sourceIssue = error instanceof PpmDataError ? error.code : received ? 'invalid_data' : 'unavailable';
    }
    if (!sourceUnavailable) {
      const date = latest.quotes.reduce((max, quote) => quote.date > max ? quote.date : max, '');
      const body = JSON.stringify(latest);
      // Only successful complete feeds replace the last known good snapshot.
      await bucket.put(`ppm/days/${date}.json`, body, { httpMetadata: { contentType: 'application/json' } });
      await bucket.put('ppm/latest.json', body, { httpMetadata: { contentType: 'application/json' } });
    } else {
      // Preserve both the last good prices and the failure warning for fast reads.
      await bucket.put('ppm/latest.json', JSON.stringify({ ...latest, sourceUnavailable: true, sourceIssue }), { httpMetadata: { contentType: 'application/json' } });
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
  return { ...rankPpmFunds(snapshots, now), sourceUnavailable, sourceIssue, collection: archive.collection };
}

export async function getPpmRanking(readOnly = false): Promise<PpmRanking> {
  // A fast read must never join an in-flight external refresh.
  if (readOnly) return loadRanking(true);
  if (!inFlight) inFlight = loadRanking().finally(() => { inFlight = undefined; });
  return inFlight;
}
