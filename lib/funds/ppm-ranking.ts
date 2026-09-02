export const PPM_SOURCE_URL = 'https://www.pensionsmyndigheten.se/statistik-och-rapporter/statistik/statistik-for-premiepension';
export const PPM_QUOTES_URL = 'https://static.pensionsmyndigheten.se/fond/kurser.csv';

export type PpmQuote = { id: string; name: string; date: string; nav: number };

// Workers only implements UTF-8 TextDecoder; the official CSV is Windows-1252.
export function decodePpmCsv(buffer: ArrayBuffer): string {
  const special = '\u20ac\u0081\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u008d\u017d\u008f\u0090\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u009d\u017e\u0178';
  return Array.from(new Uint8Array(buffer), byte => byte >= 128 && byte <= 159 ? special[byte - 128] : String.fromCharCode(byte)).join('');
}
export type PpmSnapshot = { fetchedAt: string; quotes: PpmQuote[] };
export type PpmWinner = PpmQuote & { previousNav: number; changePercent: number };
export const MAX_DAILY_CHANGE_PERCENT = 25;
export type PpmSourceIssue = 'coverage_drop' | 'date_regression' | 'invalid_data' | 'unavailable';
export type PpmQuality = {
  date: string | null; matchedFunds: number; missingPrevious: number;
  excluded: { id: string; name: string; reason: 'large_change' | 'identity_change'; changePercent: number | null }[];
};
export class PpmDataError extends Error {
  code: PpmSourceIssue;
  constructor(code: PpmSourceIssue) { super(code); this.code = code; }
}
export type PpmRanking = {
  status: 'ready' | 'waiting';
  date: string | null;
  previousDate: string | null;
  latestQuoteDate: string | null;
  comparedFunds: number;
  totalFunds: number;
  fetchedAt: string | null;
  stale: boolean;
  sourceUnavailable: boolean;
  funds: PpmWinner[];
  collection?: { lastSuccessAt: string | null; stale: boolean; unavailable: boolean };
  sourceIssue?: PpmSourceIssue;
  quality?: PpmQuality;
};

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function stockholmDate(now: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(now);
}

// Deliberately conservative on holidays: a missing weekday is not treated as
// a one-day change. We never label a multi-day move as daily performance.
export function previousWeekday(date: string): string {
  const previous = new Date(`${date}T00:00:00Z`);
  do { previous.setUTCDate(previous.getUTCDate() - 1); }
  while (previous.getUTCDay() === 0 || previous.getUTCDay() === 6);
  return previous.toISOString().slice(0, 10);
}

function validQuote(quote: PpmQuote, today: string): boolean {
  return !!quote && typeof quote.id === 'string' && typeof quote.date === 'string'
    && /^\d{6}$/.test(quote.id) && typeof quote.name === 'string'
    && quote.name.trim().length > 0 && quote.name.length <= 300
    && isIsoDate(quote.date) && quote.date <= today
    && Number.isFinite(quote.nav) && quote.nav > 0;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ';' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = '';
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else field += char;
  }
  if (quoted) throw new Error('Incomplete CSV');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parsePpmCsv(text: string, now = new Date()): PpmQuote[] {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const header = rows[0];
  if (!header || header[0] !== 'Fondnr' || header[1] !== 'Fondnamn'
    || header[3] !== 'Säljkurs' || header[4] !== 'Kursdatum') {
    throw new Error('Unexpected PPM CSV format');
  }
  const quotes: PpmQuote[] = [];
  const seen = new Set<string>();
  const today = stockholmDate(now);
  for (const row of rows.slice(1)) {
    const navText = (row[3] ?? '').replace(/\s/g, '');
    const nav = /^\d+(?:[.,]\d+)?$/.test(navText) ? Number(navText.replace(',', '.')) : NaN;
    const quote = { id: row[0] ?? '', name: row[1] ?? '', nav, date: row[4] ?? '' };
    if (row.length !== 5 || !validQuote(quote, today) || seen.has(quote.id)) {
      throw new Error('Invalid or duplicate PPM quote');
    }
    seen.add(quote.id);
    quotes.push(quote);
  }
  if (quotes.length === 0) throw new Error('Empty PPM feed');
  return quotes;
}

export function assertPpmUpdate(previous: PpmSnapshot | null, next: PpmSnapshot, now = new Date()) {
  const time = Date.parse(next.fetchedAt);
  if (!Number.isFinite(time) || time > now.getTime() || (previous && time <= Date.parse(previous.fetchedAt))
    || !Array.isArray(next.quotes) || next.quotes.length < 100 || next.quotes.length > 2000) throw new PpmDataError('invalid_data');
  const ids = new Set<string>();
  const today = stockholmDate(new Date(time));
  for (const quote of next.quotes) {
    if (!validQuote(quote, today) || ids.has(quote.id)) throw new PpmDataError('invalid_data');
    ids.add(quote.id);
  }
  if (!previous) return;
  const prior = new Map(previous.quotes.map(quote => [quote.id, quote]));
  const retained = next.quotes.filter(quote => prior.has(quote.id)).length;
  if (retained < prior.size * 0.8) throw new PpmDataError('coverage_drop');
  if (next.quotes.some(quote => prior.has(quote.id) && quote.date < prior.get(quote.id)!.date)) throw new PpmDataError('date_regression');
}

const comparableName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv-SE');

export function rankPpmFunds(snapshots: PpmSnapshot[], now = new Date()): PpmRanking {
  const today = stockholmDate(now);
  const days = new Map<string, Map<string, PpmQuote>>();
  const allIds = new Set<string>();
  let fetchedAt: string | null = null;
  // A later successful fetch supersedes corrections to an earlier quote.
  for (const snapshot of [...snapshots].sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt))) {
    if (!Number.isFinite(Date.parse(snapshot.fetchedAt)) || Date.parse(snapshot.fetchedAt) > now.getTime()) continue;
    fetchedAt = snapshot.fetchedAt;
    for (const quote of snapshot.quotes) {
      if (!validQuote(quote, today)) continue;
      allIds.add(quote.id);
      if (!days.has(quote.date)) days.set(quote.date, new Map());
      days.get(quote.date)!.set(quote.id, quote);
    }
  }
  const dates = [...days.keys()].sort().reverse();
  const latestQuoteDate = dates[0] ?? null;
  const result: PpmRanking = {
    status: 'waiting', date: null, previousDate: null, latestQuoteDate,
    comparedFunds: 0, totalFunds: allIds.size, fetchedAt,
    stale: latestQuoteDate ? Date.parse(`${today}T00:00:00Z`) - Date.parse(`${latestQuoteDate}T00:00:00Z`) > 4 * 86400000 : false,
    sourceUnavailable: false, funds: [],
    quality: { date: latestQuoteDate, matchedFunds: 0, missingPrevious: latestQuoteDate ? days.get(latestQuoteDate)!.size : 0, excluded: [] },
  };
  for (const date of dates) {
    // Do not resurrect an old historical ranking as the latest daily result.
    if (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`) > 7 * 86400000) break;
    const previousDate = previousWeekday(date);
    const previous = days.get(previousDate);
    if (!previous) continue;
    const candidates: PpmWinner[] = [];
    const quality: PpmQuality = { date, matchedFunds: 0, missingPrevious: 0, excluded: [] };
    for (const quote of days.get(date)!.values()) {
      const prior = previous.get(quote.id);
      if (!prior) { quality.missingPrevious++; continue; }
      quality.matchedFunds++;
      const changePercent = (quote.nav / prior.nav - 1) * 100;
      const reason = comparableName(quote.name) !== comparableName(prior.name) ? 'identity_change'
        : !Number.isFinite(changePercent) || Math.abs(changePercent) > MAX_DAILY_CHANGE_PERCENT + 1e-9 ? 'large_change' : null;
      if (reason) {
        quality.excluded.push({ id: quote.id, name: quote.name, reason, changePercent: Number.isFinite(changePercent) ? changePercent : null });
        continue;
      }
      if (Number.isFinite(changePercent)) candidates.push({ ...quote, previousNav: prior.nav, changePercent });
    }
    // Never hide a blocked comparison by falling back to older winners.
    if (candidates.length < 5 && quality.excluded.length) return { ...result, quality };
    if (candidates.length < 5) { if (date === latestQuoteDate) result.quality = quality; continue; }
    candidates.sort((a, b) => b.changePercent - a.changePercent || a.id.localeCompare(b.id));
    return {
      ...result, status: 'ready', date, previousDate,
      comparedFunds: candidates.length, funds: candidates.slice(0, 5),
      stale: result.stale || date !== latestQuoteDate, quality,
    };
  }
  return result;
}

export const PPM_ARCHIVE_URL = 'https://raw.githubusercontent.com/malte3000/SuperSafe/main/data/ppm/recent.json';
export const PPM_COLLECTION_URL = 'https://github.com/malte3000/SuperSafe/actions/workflows/collect-ppm.yml';
export type PpmArchive = { schemaVersion: 1; source: string; currency: 'SEK'; lastSuccessAt: string; snapshots: PpmSnapshot[] };

// Validate every record before an external archive can enter the ranking.
export function parsePpmArchive(value: unknown, now = new Date()): PpmArchive {
  if (!value || typeof value !== 'object') throw new Error('Invalid archive');
  const archive = value as PpmArchive;
  if (archive.schemaVersion !== 1 || archive.source !== PPM_QUOTES_URL || archive.currency !== 'SEK'
    || !Array.isArray(archive.snapshots) || archive.snapshots.length < 1 || archive.snapshots.length > 48) throw new Error('Invalid archive metadata');
  let previousTime = -Infinity;
  const snapshots = archive.snapshots.map(snapshot => {
    if (!snapshot || typeof snapshot.fetchedAt !== 'string') throw new Error('Invalid snapshot');
    const time = Date.parse(snapshot.fetchedAt);
    if (!Number.isFinite(time) || snapshot.fetchedAt !== new Date(time).toISOString() || time <= previousTime || time > now.getTime()
      || !Array.isArray(snapshot.quotes) || snapshot.quotes.length < 100 || snapshot.quotes.length > 2000) throw new Error('Invalid snapshot metadata');
    previousTime = time;
    const seen = new Set<string>();
    const collectionDate = stockholmDate(new Date(time));
    const quotes = snapshot.quotes.map(quote => {
      if (!quote || typeof quote.id !== 'string' || typeof quote.date !== 'string'
        || !validQuote(quote, collectionDate) || seen.has(quote.id)) throw new Error('Invalid archive quote');
      seen.add(quote.id);
      return { id: quote.id, name: quote.name, date: quote.date, nav: quote.nav };
    });
    return { fetchedAt: snapshot.fetchedAt, quotes };
  });
  if (archive.lastSuccessAt !== snapshots.at(-1)!.fetchedAt) throw new Error('Invalid collection timestamp');
  for (let index = 1; index < snapshots.length; index++) assertPpmUpdate(snapshots[index - 1], snapshots[index], now);
  return { schemaVersion: 1, source: PPM_QUOTES_URL, currency: 'SEK', lastSuccessAt: archive.lastSuccessAt, snapshots };
}

export function appendPpmSnapshot(previous: PpmArchive | null, snapshot: PpmSnapshot, now = new Date()): PpmArchive {
  if (previous) parsePpmArchive(previous, now);
  if (previous && Date.parse(snapshot.fetchedAt) <= Date.parse(previous.lastSuccessAt)) throw new Error('Collection did not advance');
  assertPpmUpdate(previous?.snapshots.at(-1) ?? null, snapshot, now);
  const snapshots = [...(previous?.snapshots ?? []), snapshot]
    .filter(item => Date.parse(item.fetchedAt) >= now.getTime() - 10 * 86400000).slice(-48);
  return parsePpmArchive({ schemaVersion: 1, source: PPM_QUOTES_URL, currency: 'SEK', lastSuccessAt: snapshot.fetchedAt, snapshots }, now);
}
