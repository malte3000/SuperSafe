import type { FiFund } from './fi-funds';
import { formatDataDate } from './freshness';
import { indexHoldings, type compareFunds } from './overlap';
import type { analyzePortfolio } from './portfolio';

export type FundExplanation = {
  context: string;
  items: { title: string; text: string }[];
  limitation: string;
};

const number = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });
const amount = (value: number) => value < 1e-8 ? '0 kr'
  : value < 0.005 ? 'mindre än 0,01 kr' : `cirka ${number.format(value)} kr`;
const isWeight = (value: number) => Number.isFinite(value) && value >= 0 && value <= 100 + 1e-8;
const limitation = 'Kronorna är räkneexempel utifrån procentandelar, inte ditt faktiska saldo. Siffrorna visar innehav, inte uppgång, nedgång eller framtida avkastning. Ingen köp- eller säljrekommendation ges.';

function context(reportDate: string) {
  const date = formatDataDate(reportDate);
  return date === 'Okänt datum' ? null : `Baserat på FI-innehav som avser ${date}, inte dagens innehav.`;
}

function missingCoverage(unknown: number, scope: string) {
  return unknown < 1e-8
    ? { title: 'Alla 100 kr kan kopplas till innehav', text: `Hela ${scope} kan kopplas till värdepapper med användbart ISIN i underlaget. Det gör inte uppgifterna dagsaktuella och säger inte att risken är låg.` }
    : { title: 'En del av bilden saknas', text: `Av varje 100 kr i ${scope} kan ${amount(unknown)} inte kopplas till identifierade innehav i vårt utdrag. Det är inte samma sak som kontanter. Den delen kan också innehålla värdepapper som redan finns i den synliga delen.` };
}

// Deterministic explanations only: no model calls, guessed data or qualitative risk scores.
export function explainFund(fund: FiFund | null | undefined): FundExplanation | null {
  if (!fund) return null;
  const dateContext = context(fund.reportDate);
  const indexed = indexHoldings(fund);
  if (!dateContext || !indexed.validWeights || !isWeight(fund.holdings.reduce((sum, holding) => sum + holding.weight, 0))) return null;
  const positions = [...indexed.positions.values()].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'sv-SE'));
  const largest = positions[0];
  const count = Math.min(10, positions.length);
  const topWeight = positions.slice(0, count).reduce((sum, holding) => sum + holding.weight, 0);
  return {
    context: `${fund.name}. ${dateContext}`,
    items: largest ? [
      { title: 'Så läser du fondvikten', text: `Av varje 100 kr i fonden motsvarar ${amount(largest.weight)} ${largest.name}, det största identifierade innehavet. Det är hur stor plats innehavet tar i fonden, inte hur mycket det har stigit.` },
      { title: 'Vad koncentrationen betyder', text: `${count === 1 ? 'Det största identifierade värdepapperet' : `De ${count} största identifierade värdepapperen`} motsvarar ${count === 1 ? '' : 'tillsammans '}${amount(topWeight)} av varje 100 kr i fonden. ${topWeight > 50 ? 'Det är mer än hälften av fondens värde på rapportdagen. ' : ''}Detta beskriver fördelningen mellan innehav, inte fondens totala risk.` },
      missingCoverage(Math.max(0, 100 - indexed.identifiedWeight), 'fonden'),
    ] : [
      { title: 'Vi kan inte beskriva fördelningen', text: 'Inga innehav med användbart ISIN finns i utdraget. Därför kan vi varken peka ut ett största identifierat innehav eller dra slutsatser om hur pengarna är fördelade.' },
      missingCoverage(100, 'fonden'),
    ],
    limitation,
  };
}

export function explainComparison(result: ReturnType<typeof compareFunds> | null, reportDate: string): FundExplanation | null {
  const dateContext = context(reportDate);
  if (!result || result.status !== 'ready' || !dateContext || ![result.overlapWeight, result.left.identifiedWeight, result.right.identifiedWeight].every(isWeight)) return null;
  const largest = result.shared[0];
  return {
    context: dateContext,
    items: [
      { title: result.shared.length ? 'En gemensam del i båda fonderna' : 'Ingen gemensam del hittad', text: result.shared.length
        ? `Tänk dig 100 kr i vardera fonden. Då kan ${amount(result.overlapWeight)} i var och en matchas till samma värdepapper. Vi räknar den mindre vikten för varje match. Det är inte en sammanlagd andel av din portfölj.`
        : 'Vi hittar inga matchande värdepapper i de identifierade innehaven. Det bevisar inte att hela fonderna är olika eller att de ger god riskspridning.' },
      ...(largest ? [{ title: 'Ett konkret exempel', text: `${largest.name} motsvarar ${amount(largest.leftWeight)} per 100 kr i fond 1 och ${amount(largest.rightWeight)} per 100 kr i fond 2. Den gemensamma delen blir därför ${amount(largest.sharedWeight)} per 100 kr i vardera fonden.` }] : []),
      { title: 'Jämförelsen har gränser', text: `Vi kan identifiera ${amount(result.left.identifiedWeight)} av varje 100 kr i fond 1 och ${amount(result.right.identifiedWeight)} i fond 2. Saknade innehav kan öka den verkliga överlappningen. Vi matchar samma värdepapperskod (ISIN), inte olika aktieslag i samma bolag.` },
    ],
    limitation,
  };
}

export function explainPortfolio(result: ReturnType<typeof analyzePortfolio>): FundExplanation | null {
  if (result.status !== 'ready') return null;
  const dateContext = context(result.reportDate);
  if (!dateContext || ![result.coverage, result.unknownWeight, result.topTenWeight].every(isWeight)) return null;
  const largest = result.positions[0];
  return {
    context: `${dateContext} Beräkningen använder dina angivna fondandelar.`,
    items: [
      largest ? { title: 'Så stor blir den största kända positionen', text: `Av varje 100 kr i din angivna portfölj motsvarar ${amount(largest.weight)} ${largest.name}. Det kommer via ${largest.contributors.length} av dina valda fonder. Andelen gäller hela portföljen, inte bara den del vi kan se.` }
        : { title: 'Inga kända positioner att summera', text: 'Vi saknar identifierbara innehav för de valda fonderna. Därför kan vi inte bedöma fördelningen mellan värdepapper, trots att du har fördelat 100 % mellan fonderna.' },
      { title: result.shared.length ? 'Flera fonder kan innehålla samma sak' : 'Inga återkommande värdepapper hittade', text: result.shared.length
        ? `${result.shared.length} värdepapper finns i minst två av dina valda fonder. Flera fondnamn betyder därför inte lika många separata uppsättningar innehav. Varje fond bidrar med sin vikt till det gemensamma värdepappret.`
        : 'Vi hittar inga värdepapper med samma ISIN i flera av fonderna. Saknade innehav och olika aktieslag kan ändå dölja gemensamma bolag. Detta är inget besked om låg risk.' },
      missingCoverage(result.unknownWeight, 'din angivna portfölj'),
    ],
    limitation,
  };
}
