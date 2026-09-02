import { PPM_ARCHIVE_URL, assertPpmUpdate, parsePpmArchive, type PpmArchive } from './ppm-ranking';

type CachedArchive = { checkedAt: string; unavailable: boolean; archive: PpmArchive | null };

export async function loadPpmArchive(bucket: R2Bucket, now: Date, readOnly = false) {
  let state: CachedArchive = { checkedAt: '', unavailable: true, archive: null };
  try {
    const cached = await bucket.get('ppm/collector.json');
    if (cached) {
      const saved = await cached.json<CachedArchive>();
      state = { ...saved, archive: saved.archive ? parsePpmArchive(saved.archive, now) : null };
    }
    const age = now.getTime() - Date.parse(state.checkedAt);
    if (!readOnly && (!Number.isFinite(age) || age < 0 || age >= 3600000)) {
      try {
        const response = await fetch(PPM_ARCHIVE_URL, { signal: AbortSignal.timeout(12000) });
        if (!response.ok) throw new Error('Collector archive unavailable');
        const body = await response.text();
        if (body.length > 6_000_000) throw new Error('Collector archive exceeds size limit');
        const archive = parsePpmArchive(JSON.parse(body), now);
        if (state.archive && archive.lastSuccessAt < state.archive.lastSuccessAt) throw new Error('Collector archive moved backwards');
        if (state.archive && archive.lastSuccessAt > state.archive.lastSuccessAt) assertPpmUpdate(state.archive.snapshots.at(-1)!, archive.snapshots.at(-1)!, now);
        state = { checkedAt: now.toISOString(), unavailable: false, archive };
      } catch {
        state = { ...state, checkedAt: now.toISOString(), unavailable: true };
      }
      await bucket.put('ppm/collector.json', JSON.stringify(state), { httpMetadata: { contentType: 'application/json' } });
    }
  } catch { state.unavailable = true; }
  const lastSuccessAt = state.archive?.lastSuccessAt ?? null;
  return {
    snapshots: state.archive?.snapshots ?? [],
    collection: { lastSuccessAt, unavailable: state.unavailable,
      stale: lastSuccessAt ? now.getTime() - Date.parse(lastSuccessAt) > 18 * 3600000 : true },
  };
}
