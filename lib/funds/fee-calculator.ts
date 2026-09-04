export type FeeCalculatorInput = {
  startCapital: string;
  monthlySaving: string;
  years: string;
  annualReturn: string;
  feeA: string;
  feeB: string;
};

export type FeeScenario = {
  fee: number;
  finalValue: number;
  feesPaid: number;
  feeEffect: number;
  currentAnnualCost: number;
};

type InvalidField = keyof FeeCalculatorInput | 'savings';

function parseUnsigned(value: string, maximum: number) {
  const normalized = value.trim().replace(/[ \u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

function parseReturn(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!/^-?\d{1,2}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= -20 && parsed <= 20 ? parsed : null;
}

function simulate(startCapital: number, monthlySaving: number, years: number, annualReturn: number, annualFee: number) {
  const months = years * 12;
  const monthlyReturn = Math.pow(1 + annualReturn / 100, 1 / 12) - 1;
  const monthlyFee = annualFee / 100 / 12;
  let balance = startCapital;
  let feesPaid = 0;
  for (let month = 0; month < months; month++) {
    balance *= 1 + monthlyReturn;
    const fee = balance * monthlyFee;
    balance -= fee;
    feesPaid += fee;
    balance += monthlySaving;
  }
  return { finalValue: balance, feesPaid };
}

export function calculateFeeComparison(input: FeeCalculatorInput) {
  const startCapital = parseUnsigned(input.startCapital, 100_000_000);
  if (startCapital === null) return { status: 'invalid' as const, field: 'startCapital' as InvalidField };
  const monthlySaving = parseUnsigned(input.monthlySaving, 1_000_000);
  if (monthlySaving === null) return { status: 'invalid' as const, field: 'monthlySaving' as InvalidField };
  if (startCapital === 0 && monthlySaving === 0) return { status: 'invalid' as const, field: 'savings' as InvalidField };
  const years = parseUnsigned(input.years, 50);
  if (years === null || !Number.isInteger(years) || years < 1) return { status: 'invalid' as const, field: 'years' as InvalidField };
  const annualReturn = parseReturn(input.annualReturn);
  if (annualReturn === null) return { status: 'invalid' as const, field: 'annualReturn' as InvalidField };
  const feeA = parseUnsigned(input.feeA, 10);
  if (feeA === null) return { status: 'invalid' as const, field: 'feeA' as InvalidField };
  const feeB = parseUnsigned(input.feeB, 10);
  if (feeB === null) return { status: 'invalid' as const, field: 'feeB' as InvalidField };

  const baseline = simulate(startCapital, monthlySaving, years, annualReturn, 0);
  const scenario = (fee: number): FeeScenario => {
    const value = simulate(startCapital, monthlySaving, years, annualReturn, fee);
    return {
      fee,
      finalValue: value.finalValue,
      feesPaid: value.feesPaid,
      feeEffect: Math.max(0, baseline.finalValue - value.finalValue),
      currentAnnualCost: startCapital * fee / 100,
    };
  };
  const a = scenario(feeA);
  const b = scenario(feeB);
  return {
    status: 'ready' as const,
    startCapital,
    monthlySaving,
    years,
    annualReturn,
    contributed: startCapital + monthlySaving * years * 12,
    noFeeFinalValue: baseline.finalValue,
    a,
    b,
    difference: a.finalValue - b.finalValue,
    better: Math.abs(a.finalValue - b.finalValue) < 0.005 ? null : a.finalValue > b.finalValue ? 'A' as const : 'B' as const,
  };
}
