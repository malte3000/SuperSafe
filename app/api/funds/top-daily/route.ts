import { getPpmRanking } from '@/lib/funds/ppm-source';

export async function GET() {
  try {
    const ranking = await getPpmRanking();
    return Response.json(ranking, {
      headers: { 'Cache-Control': ranking.sourceUnavailable ? 'no-store' : 'public, max-age=300' },
    });
  } catch {
    return Response.json({ error: 'Topplistan kunde inte hämtas just nu. Försök igen om en stund.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
