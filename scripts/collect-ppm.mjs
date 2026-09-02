import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PPM_QUOTES_URL, decodePpmCsv, parsePpmCsv, parsePpmArchive, appendPpmSnapshot } from '../lib/funds/ppm-ranking.ts';

export async function collectPpm({ directory = resolve('data/ppm'), fetcher = fetch, now = () => new Date(), attempts = 3 } = {}) {
  let previous = null;
  try { previous = parsePpmArchive(JSON.parse(await readFile(join(directory, 'recent.json'), 'utf8')), now()); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let snapshot;
  let raw;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetcher(PPM_QUOTES_URL, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`PPM HTTP ${response.status}`);
      raw = await response.arrayBuffer();
      if (raw.byteLength > 2_000_000) throw new Error('PPM feed exceeds size limit');
      const fetched = now();
      const quotes = parsePpmCsv(decodePpmCsv(raw), fetched);
      if (quotes.length < 100 || quotes.length > 2000) throw new Error('Incomplete PPM feed');
      snapshot = { fetchedAt: fetched.toISOString(), quotes };
      break;
    } catch (error) {
      if (attempt === attempts) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
  const archive = appendPpmSnapshot(previous, snapshot, now());
  const stamp = snapshot.fetchedAt.replaceAll(':', '-');
  const dayDirectory = join(directory, 'snapshots', snapshot.fetchedAt.slice(0, 10));
  await mkdir(dayDirectory, { recursive: true });
  // Immutable raw and parsed snapshots; failed runs never replace recent.json.
  await writeFile(join(dayDirectory, `${stamp}.csv`), new Uint8Array(raw), { flag: 'wx' });
  await writeFile(join(dayDirectory, `${stamp}.json`), JSON.stringify(snapshot) + '\n', { flag: 'wx' });
  const temporary = join(directory, 'recent.json.tmp');
  await writeFile(temporary, JSON.stringify(archive) + '\n');
  await rename(temporary, join(directory, 'recent.json'));
  return { fetchedAt: snapshot.fetchedAt, funds: snapshot.quotes.length, snapshots: archive.snapshots.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await collectPpm({ directory: process.argv[2] ? resolve(process.argv[2]) : undefined }))); }
  catch (error) { console.error(`Collection failed: ${error.message}`); process.exitCode = 1; }
}
