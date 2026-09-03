export const FAVORITES_KEY = 'supersafe:favorite-funds:v1';
export const MAX_FAVORITES = 100;
export type FavoriteFund = { source: 'fi' | 'ppm'; id: string; name: string };
type FavoriteStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const favoriteKey = (fund: Pick<FavoriteFund, 'source' | 'id'>) => `${fund.source}:${fund.id}`;

function validFavorite(value: unknown): value is FavoriteFund {
  if (!value || typeof value !== 'object') return false;
  const fund = value as FavoriteFund;
  return typeof fund.id === 'string' && typeof fund.name === 'string'
    && fund.name.trim().length > 0 && fund.name.length <= 300
    && (fund.source === 'fi' ? /^[A-Z]{2}[A-Z0-9]{10}$/.test(fund.id)
      : fund.source === 'ppm' && /^\d{6}$/.test(fund.id));
}

export function readFavorites(storage: FavoriteStorage): FavoriteFund[] {
  const raw = storage.getItem(FAVORITES_KEY);
  if (raw === null) return [];
  if (raw.length > 100000) throw new Error('Favoritlistan kunde inte läsas. Ingen ändring har sparats.');
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.funds) || data.funds.length > MAX_FAVORITES || !data.funds.every(validFavorite))
    throw new Error('Favoritlistan har ett okänt format. Ingen ändring har sparats.');
  const seen = new Set<string>();
  return data.funds.filter((fund: FavoriteFund) => {
    const key = favoriteKey(fund);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map((fund: FavoriteFund) => ({ source: fund.source, id: fund.id, name: fund.name.trim() }));
}

// Read at the moment of the user's action, so another tab's recent change is
// preserved. Never announce success or update the UI before setItem succeeds.
export function setFavorite(storage: FavoriteStorage, fund: FavoriteFund, saved: boolean): FavoriteFund[] {
  if (!validFavorite(fund)) throw new Error('Fonden saknar en giltig identifierare.');
  const current = readFavorites(storage);
  const key = favoriteKey(fund);
  const rest = current.filter(item => favoriteKey(item) !== key);
  if (saved && rest.length >= MAX_FAVORITES) throw new Error(`Du kan spara högst ${MAX_FAVORITES} fonder. Ta bort en favorit först.`);
  const next = saved ? [{ source: fund.source, id: fund.id, name: fund.name.trim() }, ...rest] : rest;
  storage.setItem(FAVORITES_KEY, JSON.stringify({ version: 1, funds: next }));
  return next;
}
