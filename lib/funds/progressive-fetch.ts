// Publish stored data before starting an independent update request. The caller
// keeps the displayed value if updating fails. Never persist fund data in a browser.
export async function fetchFundProgressively<T>({ url, signal, onData, fetcher = fetch }: {
  url: string; signal: AbortSignal; onData: (data: T) => void; fetcher?: typeof fetch;
}) {
  const read = async (target: string) => {
    signal.throwIfAborted();
    const response = await fetcher(target, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Fund data unavailable');
    const data = await response.json() as T;
    signal.throwIfAborted();
    onData(data);
  };
  try { await read(url); }
  catch { signal.throwIfAborted(); /* A refresh can recover from a failed stored read. */ }
  await read(`${url}${url.includes('?') ? '&' : '?'}refresh=1`);
}
