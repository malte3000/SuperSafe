'use client';

import { useMemo, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { calculateFeeComparison, type FeeCalculatorInput, type FeeScenario } from '@/lib/funds/fee-calculator';

const initialInput: FeeCalculatorInput = {
  startCapital: '100000', monthlySaving: '2000', years: '10', annualReturn: '5', feeA: '0,20', feeB: '1,20',
};
const money = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });

const errorMessages: Record<string, string> = {
  startCapital: 'Startkapitalet ska vara 0–100 000 000 kr, med högst två decimaler.',
  monthlySaving: 'Månadssparandet ska vara 0–1 000 000 kr, med högst två decimaler.',
  savings: 'Ange ett startkapital eller ett månadssparande större än 0 kr.',
  years: 'Spartiden ska vara ett helt antal år mellan 1 och 50.',
  annualReturn: 'Antagen avkastning ska vara mellan −20 och 20 %, med högst två decimaler.',
  feeA: 'Avgift A ska vara mellan 0 och 10 %, med högst två decimaler.',
  feeB: 'Avgift B ska vara mellan 0 och 10 %, med högst två decimaler.',
};

function Field({ id, label, suffix, value, help, invalid, onChange }: { id: keyof FeeCalculatorInput; label: string; suffix: string; value: string; help?: string; invalid: boolean; onChange: (value: string) => void }) {
  const describedBy = [help ? `fee-${id}-help` : '', invalid ? 'fee-error' : ''].filter(Boolean).join(' ') || undefined;
  return <div className="fee-field"><label htmlFor={`fee-${id}`}>{label}</label><div className="fee-input"><Input id={`fee-${id}`} value={value} onChange={event => onChange(event.target.value)} type="text" inputMode="decimal" autoComplete="off" aria-invalid={invalid} aria-describedby={describedBy} /><span>{suffix}</span></div>{help && <small id={`fee-${id}-help`}>{help}</small>}</div>;
}

function ResultCard({ name, scenario, maxValue }: { name: string; scenario: FeeScenario; maxValue: number }) {
  const width = maxValue > 0 ? Math.max(2, scenario.finalValue / maxValue * 100) : 0;
  return <article className="fee-result-card"><div className="fee-result-title"><h3>{name}</h3><Badge variant="outline">{percent.format(scenario.fee)} % avgift</Badge></div>
    <strong className="fee-final-value">{money.format(scenario.finalValue)}</strong><span>uppskattat slutvärde</span>
    <div className="fee-bar" aria-hidden="true"><i style={{ width: `${width}%` }} /></div>
    <dl><div><dt>Uppskattade avgiftsavdrag</dt><dd>{money.format(scenario.feesPaid)}</dd></div><div><dt>Total avgiftseffekt</dt><dd>{money.format(scenario.feeEffect)}</dd></div><div><dt>Årlig avgift × startkapital</dt><dd>{money.format(scenario.currentAnnualCost)}</dd></div></dl>
  </article>;
}

export function FeeCalculator() {
  const [input, setInput] = useState(initialInput);
  const result = useMemo(() => calculateFeeComparison(input), [input]);
  const set = (key: keyof FeeCalculatorInput, value: string) => setInput(current => ({ ...current, [key]: value }));
  const invalid = result.status === 'invalid' ? result.field : null;
  return <section id="avgiftskalkyl" className="fee-card" aria-labelledby="fee-title">
    <div className="fee-heading"><div><Badge variant="secondary"><Calculator aria-hidden="true" /> Avgiftskalkyl</Badge><h2 id="fee-title">Se vad fondavgiften kan kosta över tid</h2><p>Jämför två årliga avgifter med exakt samma sparande och antagna avkastning. Resultatet uppdateras direkt.</p></div><span>Räkneexempel · inte prognos</span></div>
    <div className="fee-layout">
      <form className="fee-controls" onSubmit={event => event.preventDefault()}>
        <h3>Ditt räkneexempel</h3>
        <div className="fee-fields">
          <Field id="startCapital" label="Startkapital" suffix="kr" value={input.startCapital} invalid={invalid === 'startCapital' || invalid === 'savings'} onChange={value => set('startCapital', value)} />
          <Field id="monthlySaving" label="Månadssparande" suffix="kr" value={input.monthlySaving} invalid={invalid === 'monthlySaving' || invalid === 'savings'} onChange={value => set('monthlySaving', value)} help="Insättningen räknas i slutet av varje månad." />
          <Field id="years" label="Spartid" suffix="år" value={input.years} invalid={invalid === 'years'} onChange={value => set('years', value)} />
          <Field id="annualReturn" label="Antagen årlig avkastning före avgifter" suffix="%" value={input.annualReturn} invalid={invalid === 'annualReturn'} onChange={value => set('annualReturn', value)} help="Samma antagande används för båda alternativen." />
        </div>
        <fieldset className="fee-options"><legend>Avgifter att jämföra</legend><div>
          <Field id="feeA" label="Fondalternativ A" suffix="%" value={input.feeA} invalid={invalid === 'feeA'} onChange={value => set('feeA', value)} />
          <Field id="feeB" label="Fondalternativ B" suffix="%" value={input.feeB} invalid={invalid === 'feeB'} onChange={value => set('feeB', value)} />
        </div></fieldset>
        <p className="fee-local">Dina värden används bara i webbläsaren och sparas inte.</p>
        {result.status === 'invalid' && <p id="fee-error" className="fee-error" role="alert">{errorMessages[result.field]}</p>}
      </form>
      <div className="fee-results" aria-live="polite">
        {result.status === 'ready' && <>
          <div className="fee-answer"><span>Skillnad i uppskattat slutvärde</span><strong>{money.format(Math.abs(result.difference))}</strong><p>{result.better ? `Fondalternativ ${result.better} ger det högre slutvärdet i just detta räkneexempel.` : 'Alternativen ger samma uppskattade slutvärde med de angivna avgifterna.'}</p></div>
          <div className="fee-result-grid"><ResultCard name="Alternativ A" scenario={result.a} maxValue={result.noFeeFinalValue} /><ResultCard name="Alternativ B" scenario={result.b} maxValue={result.noFeeFinalValue} /></div>
          <div className="fee-baseline"><Info aria-hidden="true" /><p>Totalt insatt: <strong>{money.format(result.contributed)}</strong>. Utan fondavgift blir det förenklade slutvärdet <strong>{money.format(result.noFeeFinalValue)}</strong>. Total avgiftseffekt är skillnaden mot detta och inkluderar både uppskattade avgifter och den avkastning de pengarna annars hade kunnat ge.</p></div>
        </>}
      </div>
    </div>
    <details className="fee-method"><summary>Så räknar vi och vad som inte ingår</summary>
      <p>Avkastningen omvandlas till en motsvarande månadsutveckling. Därefter räknas fondavgiften som en tolftedel av den angivna årliga procentsatsen på kapitalet varje månad. Månadssparandet läggs till sist i månaden. Verkliga fondavgifter beräknas normalt dagligen, så utfallet blir inte exakt samma som hos ett fondbolag.</p>
      <p>Avkastningen är ett antagande före avgifter och blir jämn i beräkningen. Verklig avkastning varierar och kan bli negativ. Skatt, valutaväxling, köp- och säljkostnader, plattformsavgifter, prestationsbaserade avgifter, rabatter och ändrade avgifter eller insättningar ingår inte. ”Uppskattat uttaget” är modellens löpande avgiftsavdrag; ”total avgiftseffekt” inkluderar även utebliven värdeutveckling.</p>
      <p>Ange den avgift som gäller för rätt konto. Premiepensionens rabatterade avgift kan skilja sig från samma fonds avgift på den öppna marknaden. Kontrollera fondens faktablad och villkor.</p>
      <a href="https://www.pensionsmyndigheten.se/forsta-din-pension/valj-och-byt-fonder/avgifter-och-rabatter-inom-premiepensionen" target="_blank" rel="noopener noreferrer">Läs om avgifter och ränta-på-ränta hos Pensionsmyndigheten</a>
    </details>
  </section>;
}
