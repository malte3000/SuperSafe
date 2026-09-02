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
  return /^\d{6}$/.test(quote.id) && typeof quote.name === 'string'
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
  for (const row of rows.slice(1)) {
    const nav = Number((row[3] ?? '').replace(/\s/g, '').replace(',', '.'));
    const quote = { id: row[0] ?? '', name: row[1] ?? '', nav, date: row[4] ?? '' };
    if (row.length !== 5 || !validQuote(quote, stockholmDate(now)) || seen.has(quote.id)) {
      throw new Error('Invalid or duplicate PPM quote');
    }
    seen.add(quote.id);
    quotes.push(quote);
  }
  if (quotes.length === 0) throw new Error('Empty PPM feed');
  return quotes;
}

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
  };
  for (const date of dates) {
    // Do not resurrect an old historical ranking as the latest daily result.
    if (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`) > 7 * 86400000) break;
    const previousDate = previousWeekday(date);
    const previous = days.get(previousDate);
    if (!previous) continue;
    const candidates: PpmWinner[] = [];
    for (const quote of days.get(date)!.values()) {
      const prior = previous.get(quote.id);
      if (!prior) continue;
      const changePercent = (quote.nav / prior.nav - 1) * 100;
      if (Number.isFinite(changePercent)) candidates.push({ ...quote, previousNav: prior.nav, changePercent });
    }
    if (candidates.length < 5) continue;
    candidates.sort((a, b) => b.changePercent - a.changePercent || a.id.localeCompare(b.id));
    return {
      ...result, status: 'ready', date, previousDate,
      comparedFunds: candidates.length, funds: candidates.slice(0, 5),
      stale: result.stale || date !== latestQuoteDate,
    };
  }
  return result;
}
