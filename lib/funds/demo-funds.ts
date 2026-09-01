import type { Fund } from './types';

export const demoFunds: Fund[] = [
  {
    source: 'demo',
    name: 'SuperSafe Global Demo',
    category: 'Global aktiefond · Demodata',
    riskClass: 4,
    updated: 'Demodata · 31 aug 2026',
    holdings: [
      { name: 'Microsoft', ticker: 'MSFT', weight: 14, probability: 72, confidence: 82, direction: 'positive', reason: 'Starka kassaflöden och fortsatt AI-efterfrågan.' },
      { name: 'NVIDIA', ticker: 'NVDA', weight: 13, probability: 64, confidence: 75, direction: 'positive', reason: 'Hög tillväxt, men värderingen ökar fallhöjden.' },
      { name: 'Apple', ticker: 'AAPL', weight: 12, probability: 54, confidence: 70, direction: 'neutral', reason: 'Stabil lönsamhet men dämpad försäljningstillväxt.' },
      { name: 'Visa', ticker: 'V', weight: 11, probability: 69, confidence: 78, direction: 'positive', reason: 'Motståndskraftig affärsmodell och stabila marginaler.' },
      { name: 'Novo Nordisk', ticker: 'NOVO B', weight: 10, probability: 47, confidence: 68, direction: 'negative', reason: 'Konkurrens och prispress väger mot strukturell efterfrågan.' },
      { name: 'ASML', ticker: 'ASML', weight: 10, probability: 58, confidence: 72, direction: 'neutral', reason: 'Marknadsledare med tydlig konjunktur- och geopolitisk risk.' },
      { name: 'Atlas Copco', ticker: 'ATCO A', weight: 9, probability: 63, confidence: 74, direction: 'positive', reason: 'Hög kvalitet och god eftermarknad, trots cyklisk exponering.' },
      { name: 'Eli Lilly', ticker: 'LLY', weight: 8, probability: 61, confidence: 69, direction: 'positive', reason: 'Stark produktportfölj, men höga förväntningar är inprisade.' },
      { name: 'Hexagon', ticker: 'HEXA B', weight: 7, probability: 44, confidence: 65, direction: 'negative', reason: 'Svagare momentum och osäker återhämtning.' },
      { name: 'Epiroc', ticker: 'EPI A', weight: 6, probability: 56, confidence: 67, direction: 'neutral', reason: 'Stabil serviceaffär balanserar råvarucykeln.' },
    ],
  },
  {
    source: 'demo',
    name: 'SuperSafe Sverige Demo',
    category: 'Svensk aktiefond · Demodata',
    riskClass: 4,
    updated: 'Demodata · 31 aug 2026',
    holdings: [
      { name: 'Investor', ticker: 'INVE B', weight: 18, probability: 68, confidence: 80, direction: 'positive', reason: 'Bred kvalitetsexponering och substansrabatt ger stöd.' },
      { name: 'Atlas Copco', ticker: 'ATCO A', weight: 16, probability: 63, confidence: 74, direction: 'positive', reason: 'Hög kvalitet och god eftermarknad, trots cyklisk exponering.' },
      { name: 'Volvo', ticker: 'VOLV B', weight: 14, probability: 51, confidence: 71, direction: 'neutral', reason: 'Stark balansräkning men tydlig konjunkturkänslighet.' },
      { name: 'SEB', ticker: 'SEB A', weight: 13, probability: 57, confidence: 70, direction: 'neutral', reason: 'God kapitalisering, men räntemedvinden avtar.' },
      { name: 'Saab', ticker: 'SAAB B', weight: 12, probability: 66, confidence: 72, direction: 'positive', reason: 'Historisk orderbok ger stöd, värderingen begränsar uppsidan.' },
      { name: 'Essity', ticker: 'ESSITY B', weight: 10, probability: 60, confidence: 73, direction: 'positive', reason: 'Defensiv efterfrågan och förbättrad kostnadskontroll.' },
      { name: 'Hexagon', ticker: 'HEXA B', weight: 9, probability: 44, confidence: 65, direction: 'negative', reason: 'Svagare momentum och osäker återhämtning.' },
      { name: 'Nibe', ticker: 'NIBE B', weight: 8, probability: 42, confidence: 69, direction: 'negative', reason: 'Svag slutmarknad och pressad lönsamhet på kort sikt.' },
    ],
  },
];

export const defaultFund = demoFunds[0];

export function findDemoFund(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return demoFunds.find((fund) => fund.name.toLowerCase().includes(normalizedQuery));
}
