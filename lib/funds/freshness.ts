// Calendar dates describe observations; timestamps describe retrieval events.
// Never turn a missing observation date into the retrieval date.
export function formatDataDate(value?: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Okänt datum';
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return 'Okänt datum';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }).format(date);
}

export function formatFetchTime(value?: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return 'Hämtningstid saknas';
  return `${new Intl.DateTimeFormat('sv-SE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Stockholm' }).format(new Date(value))} (svensk tid)`;
}

export function rankingDate(ranking: { status: 'ready' | 'waiting'; date: string | null; latestQuoteDate: string | null }): string | null {
  return ranking.status === 'ready' ? ranking.date : ranking.latestQuoteDate;
}
