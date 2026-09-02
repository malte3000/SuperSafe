export const WATCHLIST_SOURCE = 'https://www.pensionsmyndigheten.se/service/fondtorg/';
export const WATCHLIST_FEES_SOURCE = 'https://www.pensionsmyndigheten.se/forsta-din-pension/valj-och-byt-fonder/avgifter-och-rabatter-inom-premiepensionen';
export const WATCHLIST_API = 'https://www.pensionsmyndigheten.se/service/fondtorg/api/searchFunds?resultSize=1000';
export type WatchFund = {
  id: string; name: string; categoryId: number; category: string; type: string;
  fee: number | null; status: string | null;
};
export type WatchSnapshot = { fetchedAt: string; funds: WatchFund[] };
export type WatchCandidate = WatchFund & { fee: number; median: number; peerCount: number; difference: number };
export type WatchlistData = {
  fetchedAt: string; expired: boolean; sourceUnavailable: boolean; totalFunds: number;
  eligibleFunds: number; watch: WatchCandidate[]; review: WatchCandidate[]; peers: WatchCandidate[];
};

export function parseWatchSource(value: unknown): WatchFund[] {
  if (!value || typeof value !== 'object') throw new Error('Invalid fund source');
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.fondLista) || data.fondLista.length !== data.numberOfHits
    || data.numberOfHits !== data.totalNumberOfFunds || data.fondLista.length < 100) throw new Error('Incomplete fund source');
  const seen = new Set<string>();
  return data.fondLista.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid fund');
    const row = item as Record<string, unknown>;
    if (typeof row.fondId !== 'string' || !/^\d{6}$/.test(row.fondId) || seen.has(row.fondId)
      || typeof row.fondNamn !== 'string' || !row.fondNamn.trim() || row.fondNamn.length > 300
      || !Number.isInteger(row.kategoriId) || typeof row.fondKategoriNamn !== 'string'
      || typeof row.fondTypNamn !== 'string' || !('subtitle' in row)
      || (row.subtitle !== null && typeof row.subtitle !== 'string')) throw new Error('Invalid fund metadata');
    seen.add(row.fondId);
    const feeText = typeof row.forvaltningsArvode === 'string' ? row.forvaltningsArvode.trim() : '';
    const parsed = /^\d+(?:[.,]\d+)?$/.test(feeText) ? Number(feeText.replace(',', '.')) : NaN;
    return {
      id: row.fondId, name: row.fondNamn.trim(), categoryId: row.kategoriId as number,
      category: row.fondKategoriNamn.trim(), type: row.fondTypNamn.trim(),
      fee: Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : null,
      status: typeof row.subtitle === 'string' && row.subtitle.trim() ? row.subtitle.trim() : null,
    };
  });
}

export function watchCategoryKey(fund: WatchFund) {
  return `${fund.type}:${fund.categoryId}`;
}

export function buildWatchlists(snapshot: WatchSnapshot, now = new Date()): WatchlistData {
  const age = now.getTime() - Date.parse(snapshot.fetchedAt);
  const expired = !Number.isFinite(age) || age < 0 || age > 7 * 86400000;
  const result: WatchlistData = { fetchedAt: snapshot.fetchedAt, expired, sourceUnavailable: false,
    totalFunds: snapshot.funds.length, eligibleFunds: 0, watch: [], review: [], peers: [] };
  if (expired) return result;
  const groups = new Map<string, WatchFund[]>();
  const ids = new Set<string>();
  for (const fund of snapshot.funds) {
    if (ids.has(fund.id)) throw new Error('Duplicate fund in snapshot');
    ids.add(fund.id);
    if (fund.status !== null || fund.fee === null || !Number.isFinite(fund.fee) || fund.fee < 0 || fund.fee > 10
      || !fund.type || !fund.category || !Number.isInteger(fund.categoryId)) continue;
    const key = watchCategoryKey(fund);
    const group = groups.get(key) ?? [];
    group.push(fund);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 5) continue;
    const fees = group.map(fund => fund.fee!).sort((a, b) => a - b);
    const middle = Math.floor(fees.length / 2);
    const median = fees.length % 2 ? fees[middle] : (fees[middle - 1] + fees[middle]) / 2;
    for (const fund of group) result.peers.push({ ...fund, fee: fund.fee!, median, peerCount: group.length, difference: fund.fee! - median });
  }
  result.eligibleFunds = result.peers.length;
  const choose = (direction: 'watch' | 'review') => {
    const candidates = result.peers.filter(fund => fund.median > 0 && (direction === 'watch'
      ? fund.difference <= -0.05 + 1e-9 && fund.fee <= fund.median * 0.75 + 1e-9
      : fund.difference >= 0.05 - 1e-9 && fund.fee >= fund.median * 1.25 - 1e-9));
    candidates.sort((a, b) => Math.abs(b.difference / b.median) - Math.abs(a.difference / a.median) || a.id.localeCompare(b.id));
    const categoryCount = new Map<string, number>();
    const selected: WatchCandidate[] = [];
    for (const fund of candidates) {
      const key = watchCategoryKey(fund);
      const count = categoryCount.get(key) ?? 0;
      if (count >= 2) continue;
      categoryCount.set(key, count + 1);
      selected.push(fund);
      if (selected.length === 10) break;
    }
    return selected;
  };
  result.watch = choose('watch');
  result.review = choose('review');
  return result;
}
