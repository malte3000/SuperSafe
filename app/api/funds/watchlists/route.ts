import { getWatchlists } from '@/lib/funds/watchlist-source';

export async function GET() {
  try {
    const data = await getWatchlists();
    return Response.json(data, { headers: { 'Cache-Control': data.sourceUnavailable ? 'no-store' : 'public, max-age=300' } });
  } catch {
    return Response.json({ error: 'Bevakningslistorna kunde inte hämtas.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
