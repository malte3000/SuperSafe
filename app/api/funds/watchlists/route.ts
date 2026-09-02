import { getWatchlists } from '@/lib/funds/watchlist-source';

export async function GET(request: Request) {
  try {
    const data = await getWatchlists(new URL(request.url).searchParams.get('refresh') !== '1');
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Bevakningslistorna kunde inte hämtas.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
