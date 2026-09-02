import { getPpmRanking } from '@/lib/funds/ppm-source';

export async function GET(request: Request) {
  try {
    const ranking = await getPpmRanking(new URL(request.url).searchParams.get('refresh') !== '1');
    return Response.json(ranking, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json({ error: 'Topplistan kunde inte hämtas just nu. Försök igen om en stund.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
