'use client';

import { useMemo, useState, type CSSProperties, type SubmitEvent } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Info,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getFundAnalysis } from '@/lib/funds/analysis';
import { defaultFund, demoFunds, findDemoFund } from '@/lib/funds/demo-funds';
import type { Fund } from '@/lib/funds/types';

const directionStyles = {
  positive: { label: 'Positiv', className: 'signal-positive', Icon: ArrowUpRight },
  neutral: { label: 'Neutral', className: 'signal-neutral', Icon: ArrowRight },
  negative: { label: 'Negativ', className: 'signal-negative', Icon: ArrowDownRight },
};

export default function Home() {
  const [query, setQuery] = useState(defaultFund.name);
  const [selectedFund, setSelectedFund] = useState(defaultFund);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { score, lossRisk, weightedConfidence, riskDrivers } = useMemo(
    () => getFundAnalysis(selectedFund),
    [selectedFund],
  );

  function runAnalysis(event?: SubmitEvent<HTMLFormElement>) {
    event?.preventDefault();
    const match = findDemoFund(query);
    setIsAnalyzing(true);
    window.setTimeout(() => {
      setSelectedFund(match ?? defaultFund);
      setQuery((match ?? defaultFund).name);
      setIsAnalyzing(false);
    }, 520);
  }

  function chooseFund(fund: Fund) {
    setQuery(fund.name);
    setSelectedFund(fund);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/8 bg-[#071410]/95 text-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="brand-mark"><ShieldCheck aria-hidden="true" /></span>
            <div>
              <p className="font-semibold tracking-[-0.03em]">SuperSafe</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-100/55">Fondanalys</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className="border-emerald-300/20 bg-emerald-200/10 text-emerald-100">MVP · Demoläge</Badge>
            <Button variant="ghost" className="hidden text-emerald-50 hover:bg-white/10 hover:text-white sm:inline-flex">Så fungerar det</Button>
          </div>
        </div>
      </header>

      <section className="search-stage">
        <div className="mx-auto max-w-[1440px] px-5 py-9 lg:px-8 lg:py-11">
          <div className="mb-6 max-w-3xl">
            <div className="eyebrow"><Sparkles aria-hidden="true" /> Viktad AI-analys av fondens innehav</div>
            <h1>Se risken bakom fondens etikett.</h1>
            <p>SuperSafe testar varje aktie i fonden och väger resultatet efter hur stor del av dina pengar som faktiskt exponeras.</p>
          </div>

          <form onSubmit={runAnalysis} className="search-shell">
            <Search className="size-5 text-emerald-900/45" aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Sök efter fond" className="h-12 border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0" placeholder="Skriv namnet på en fond..." />
            <Button type="submit" size="lg" disabled={isAnalyzing} className="h-11 rounded-xl bg-[#0f6b4f] px-5 text-white hover:bg-[#0b5b43]">
              {isAnalyzing ? 'Analyserar…' : 'Analysera fond'}
              {!isAnalyzing && <ArrowRight aria-hidden="true" />}
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-emerald-950/60">
            <span>Testa demo:</span>
            {demoFunds.map((fund) => (
              <button key={fund.name} type="button" className="demo-chip" onClick={() => chooseFund(fund)}>{fund.name.replace('SuperSafe ', '').replace(' Demo', '')}</button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-7 lg:px-8 lg:py-9">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.03em]">{selectedFund.name}</h2>
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">Demodata</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{selectedFund.category}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" aria-hidden="true" /> {selectedFund.updated}</div>
        </div>

        <section className="overview-grid" aria-label="Samlad fondbedömning">
          <article className="score-card">
            <div className="score-dial" style={{ '--score': `${score * 3.6}deg` } as CSSProperties}>
              <div><strong>{score}%</strong><span>positiv utveckling</span></div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2"><span className="status-dot" /><p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-800">Försiktigt positiv</p></div>
              <h3>Fondens viktade sannolikhetstest</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Starka kärninnehav ger stöd, men {riskDrivers[0].name} och {riskDrivers[1].name} drar ned helhetsbilden. Bedömningen gäller kommande sex månader.</p>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4">
                <Metric label="Kapitalrisk" value={`${lossRisk}%`} tone="amber" />
                <Metric label="AI-säkerhet" value={`${weightedConfidence}%`} tone="green" />
                <Metric label="Analyserat" value="100%" tone="green" />
              </div>
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-heading">
              <div><span className="panel-icon risk"><AlertTriangle /></span><div><h3>Största riskbidrag</h3><p>Vikt × aktierisk</p></div></div>
              <Info className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="space-y-4 pt-4">
              {riskDrivers.map((holding) => (
                <div key={holding.ticker}>
                  <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium">{holding.name}</span><span className="font-mono text-xs text-rose-700">{holding.weight}% vikt</span></div>
                  <Progress value={100 - holding.probability} className="risk-progress" aria-label={`${holding.name} riskbidrag`} />
                </div>
              ))}
            </div>
          </article>

          <article className="panel-card confidence-card">
            <div className="panel-heading"><div><span className="panel-icon safe"><CheckCircle2 /></span><div><h3>Datatäckning</h3><p>Underlag i bedömningen</p></div></div></div>
            <div className="coverage-number">100<span>%</span></div>
            <p className="text-sm leading-6 text-muted-foreground">Alla {selectedFund.holdings.length} demoinnehav är analyserade och viktade till fondens hela värde.</p>
          </article>
        </section>

        <section className="holdings-card" aria-labelledby="holdings-title">
          <div className="holdings-heading">
            <div>
              <div className="flex items-center gap-2"><h2 id="holdings-title">Innehavens sannolikhetstest</h2><Badge variant="secondary">{selectedFund.holdings.length} innehav</Badge></div>
              <p>Sorterat efter hur stor del av fonden varje aktie utgör.</p>
            </div>
            <div className="legend"><span><i className="bg-emerald-500" /> Positiv</span><span><i className="bg-amber-400" /> Neutral</span><span><i className="bg-rose-500" /> Negativ</span></div>
          </div>

          <Table>
            <TableHeader><TableRow className="hover:bg-transparent"><TableHead>Innehav</TableHead><TableHead>Fondvikt</TableHead><TableHead>Sannolikhet</TableHead><TableHead>Bedömning</TableHead><TableHead className="min-w-[300px]">AI:s huvudskäl</TableHead><TableHead className="text-right">Säkerhet</TableHead></TableRow></TableHeader>
            <TableBody>
              {selectedFund.holdings.map((holding) => {
                const signal = directionStyles[holding.direction];
                return (
                  <TableRow key={holding.ticker}>
                    <TableCell><div className="flex items-center gap-3"><span className="ticker-avatar">{holding.ticker.slice(0, 2)}</span><div><p className="font-semibold">{holding.name}</p><p className="text-xs text-muted-foreground">{holding.ticker}</p></div></div></TableCell>
                    <TableCell><strong className="font-mono text-sm">{holding.weight}%</strong></TableCell>
                    <TableCell><div className="flex items-center gap-3"><div className="probability-track"><span style={{ width: `${holding.probability}%` }} /></div><span className="font-mono text-xs font-semibold">{holding.probability}%</span></div></TableCell>
                    <TableCell><span className={`signal ${signal.className}`}><signal.Icon />{signal.label}</span></TableCell>
                    <TableCell className="whitespace-normal text-sm text-muted-foreground">{holding.reason}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{holding.confidence}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        <footer className="mt-5 flex flex-col gap-2 border-t py-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:justify-between">
          <p>Demonstration – inte investeringsrådgivning. Verkliga innehav och marknadsdata kopplas in i nästa steg.</p>
          <p>SuperSafe · Risk före avkastning</p>
        </footer>
      </div>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' }) {
  return <div><p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p><p className={`mt-1 font-mono text-lg font-semibold ${tone === 'green' ? 'text-emerald-800' : 'text-amber-700'}`}>{value}</p></div>;
}
