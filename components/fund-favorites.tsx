'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, ExternalLink, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { FAVORITES_KEY, favoriteKey, readFavorites, setFavorite, type FavoriteFund } from '@/lib/funds/favorites';
import { formatDataDate } from '@/lib/funds/freshness';
import type { FiFund, FiFundDataset } from '@/lib/funds/fi-funds';

type FavoritesState = {
  funds: FavoriteFund[]; ready: boolean; error: string; message: string;
  save: (fund: FavoriteFund, saved: boolean) => void;
};
const FavoritesContext = createContext<FavoritesState | null>(null);

export function FundFavoritesProvider({ children }: { children: ReactNode }) {
  const [funds, setFunds] = useState<FavoriteFund[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    const load = () => {
      try { setFunds(readFavorites(window.localStorage)); setError(''); setReady(true); }
      catch { setReady(false); setError('Favoriterna kunde inte läsas. Tillåt webbplatslagring och ladda om sidan. Befintliga favoriter skrivs inte över.'); }
    };
    const timer = window.setTimeout(load, 0);
    const onStorage = (event: StorageEvent) => { if (event.key === FAVORITES_KEY || event.key === null) { load(); setMessage(''); } };
    window.addEventListener('storage', onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener('storage', onStorage); };
  }, []);
  function save(fund: FavoriteFund, saved: boolean) {
    if (!ready) return;
    try {
      const next = setFavorite(window.localStorage, fund, saved);
      setFunds(next); setError('');
      setMessage(`${fund.name} ${saved ? 'har sparats i Mina fonder.' : 'har tagits bort från Mina fonder.'}`);
    } catch (cause) {
      setMessage('');
      setError(cause instanceof Error && cause.message.startsWith('Du kan spara högst') ? cause.message
        : 'Ändringen kunde inte sparas. Kontrollera att webbplatslagring är tillåten och att det finns ledigt utrymme.');
    }
  }
  return <FavoritesContext value={{ funds, ready, error, message, save }}>{children}</FavoritesContext>;
}

export function useFavorites() {
  const state = useContext(FavoritesContext);
  if (!state) throw new Error('Favorites provider missing');
  return state;
}

export function FavoriteButton({ fund, compact = false }: { fund: FavoriteFund; compact?: boolean }) {
  const { funds, ready, save } = useFavorites();
  const saved = funds.some(item => favoriteKey(item) === favoriteKey(fund));
  return <Button type="button" variant="ghost" disabled={!ready} aria-pressed={saved}
    aria-label={`${saved ? 'Ta bort' : 'Spara'} ${fund.name} ${saved ? 'från' : 'i'} Mina fonder`}
    title={saved ? 'Ta bort från Mina fonder' : 'Spara i Mina fonder'}
    className={`favorite-button ${saved ? 'is-saved' : ''} ${compact ? 'is-compact' : ''}`}
    onClick={() => save(fund, !saved)}>
    <Star aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />{!compact && (saved ? 'Sparad' : 'Spara fond')}
  </Button>;
}

export function MyFunds({ dataset, dataState, onOpen }: { dataset: FiFundDataset | null; dataState: 'loading' | 'ready' | 'error'; onOpen: (fund: FiFund) => void }) {
  const { funds, ready, error, message } = useFavorites();
  return <section id="mina-fonder" className="my-funds" aria-labelledby="my-funds-title">
    <div className="my-funds-heading"><h2 id="my-funds-title"><Star aria-hidden="true" /> Mina fonder <span>{ready ? funds.length : '–'}</span></h2>
      <span className="my-funds-local">Bara i den här webbläsaren</span></div>
    <p className="my-funds-privacy">Sparade genvägar, inte registrerade fondinnehav. Inget konto behövs. Listan synkas inte mellan enheter och försvinner om du rensar webbplatsdata. I privat läge kan den försvinna när fönstret stängs.</p>
    <output className="sr-only" aria-live="polite">{message}</output>
    {error && <p className="my-funds-error" role="alert">{error}</p>}
    {!ready && !error && <p className="my-funds-loading">Läser dina sparade fonder…</p>}
    {ready && funds.length === 0 && <Empty className="my-funds-empty"><EmptyHeader><EmptyTitle className="text-base">Dina favoriter börjar här</EmptyTitle><EmptyDescription>Tryck på stjärnan vid en fond i sökresultaten, analysen eller fondlistorna.</EmptyDescription></EmptyHeader></Empty>}
    {funds.length > 0 && <ul className="my-funds-list">{funds.map(favorite => {
      const fund = favorite.source === 'fi' ? dataset?.funds.find(item => item.id === favorite.id) : undefined;
      return <li key={favoriteKey(favorite)}>
        <div className="my-funds-info"><strong>{fund?.name ?? favorite.name}</strong>
          <small>{favorite.source === 'fi' ? `FI-innehav · ${favorite.id}` : `PPM-fondfakta · Fondnummer ${favorite.id}`}</small>
          {fund && <small>Innehav avser {formatDataDate(fund.reportDate)}</small>}
          {favorite.source === 'fi' && !fund && <small>{dataState === 'loading' ? 'Läser fondunderlaget…' : dataState === 'error' ? 'Fondunderlaget kunde inte laddas. Favoriten finns kvar.' : 'Fonden saknas i nuvarande FI-underlag. Favoriten finns kvar.'}</small>}
        </div>
        <div className="my-funds-actions">
          {favorite.source === 'ppm' ? <Button variant="outline" nativeButton={false} render={<a href={`https://www.pensionsmyndigheten.se/service/fondtorg/fond/${favorite.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Öppna fondfakta för ${favorite.name} hos Pensionsmyndigheten`} />}>Fondfakta <ExternalLink aria-hidden="true" /></Button>
            : <Button variant="outline" disabled={!fund} onClick={() => { if (fund) onOpen(fund); }} aria-label={`Visa innehav för ${fund?.name ?? favorite.name}`}>Visa innehav <ArrowRight aria-hidden="true" /></Button>}
          <FavoriteButton fund={favorite} compact />
        </div>
      </li>;
    })}</ul>}
  </section>;
}
