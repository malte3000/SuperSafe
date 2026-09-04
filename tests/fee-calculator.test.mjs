import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFeeComparison } from '../lib/funds/fee-calculator.ts';

const input = (overrides = {}) => ({
  startCapital: '100000', monthlySaving: '2000', years: '10', annualReturn: '5', feeA: '0,20', feeB: '1,20', ...overrides,
});
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('zero fee preserves an exact annual return when there are no contributions', () => {
  const result = calculateFeeComparison(input({ monthlySaving: '0', years: '1', feeA: '0', feeB: '0' }));
  assert.equal(result.status, 'ready');
  close(result.noFeeFinalValue, 105000);
  close(result.a.finalValue, 105000);
  assert.equal(result.a.feesPaid, 0);
  assert.equal(result.a.feeEffect, 0);
  assert.equal(result.better, null);
  assert.equal(result.difference, 0);
});

test('fees are deducted monthly from the changing balance and not just the initial capital', () => {
  const result = calculateFeeComparison(input({ monthlySaving: '0', years: '1', annualReturn: '0', feeA: '1', feeB: '0' }));
  assert.equal(result.status, 'ready');
  const expected = 100000 * Math.pow(1 - 0.01 / 12, 12);
  close(result.a.finalValue, expected);
  close(result.a.feesPaid, 100000 - expected);
  close(result.a.feeEffect, result.a.feesPaid);
  assert.equal(result.a.currentAnnualCost, 1000);
});

test('monthly saving is added at month end and included in total contributions', () => {
  const result = calculateFeeComparison(input({ startCapital: '0', monthlySaving: '1000', years: '1', annualReturn: '0', feeA: '0', feeB: '0' }));
  assert.equal(result.status, 'ready');
  assert.equal(result.contributed, 12000);
  assert.equal(result.a.finalValue, 12000);
});

test('lower fee gives higher value under otherwise identical positive or negative returns', () => {
  for (const annualReturn of ['8', '-8']) {
    const result = calculateFeeComparison(input({ annualReturn, feeA: '0,2', feeB: '1.2' }));
    assert.equal(result.status, 'ready');
    assert.equal(result.better, 'A');
    assert.ok(result.a.finalValue > result.b.finalValue);
    assert.ok(result.a.feesPaid < result.b.feesPaid);
    assert.ok(result.a.feeEffect < result.b.feeEffect);
    close(result.difference, result.a.finalValue - result.b.finalValue);
  }
});

test('Swedish separators and spaces in money are accepted without exponent notation', () => {
  const result = calculateFeeComparison(input({ startCapital: ' 1 000,50 ', monthlySaving: '2 000,25', annualReturn: '5,25', feeA: '0,00', feeB: '0.00' }));
  assert.equal(result.status, 'ready');
  assert.equal(result.startCapital, 1000.5);
  assert.equal(result.monthlySaving, 2000.25);
  assert.equal(result.annualReturn, 5.25);
});

test('each malformed or out-of-range value blocks results with the exact field', () => {
  for (const [field, value, expected] of [
    ['startCapital', '-1', 'startCapital'], ['startCapital', '1e6', 'startCapital'], ['startCapital', '100000000,01', 'startCapital'],
    ['monthlySaving', 'NaN', 'monthlySaving'], ['monthlySaving', '1000000.01', 'monthlySaving'],
    ['years', '0', 'years'], ['years', '1,5', 'years'], ['years', '51', 'years'],
    ['annualReturn', '-20,01', 'annualReturn'], ['annualReturn', '20.01', 'annualReturn'], ['annualReturn', '+5', 'annualReturn'],
    ['feeA', '-0,1', 'feeA'], ['feeA', '10,01', 'feeA'], ['feeA', '1,234', 'feeA'],
    ['feeB', '', 'feeB'], ['feeB', 'Infinity', 'feeB'],
  ]) {
    const result = calculateFeeComparison(input({ [field]: value }));
    assert.equal(result.status, 'invalid', `${field}=${value}`);
    assert.equal(result.field, expected);
    assert.equal(result.a, undefined);
  }
});

test('both saving inputs cannot be zero', () => {
  const result = calculateFeeComparison(input({ startCapital: '0', monthlySaving: '0' }));
  assert.equal(result.status, 'invalid');
  assert.equal(result.field, 'savings');
});

test('boundary inputs stay finite over the longest supported period', () => {
  const result = calculateFeeComparison(input({ startCapital: '100000000', monthlySaving: '1000000', years: '50', annualReturn: '20', feeA: '10', feeB: '0' }));
  assert.equal(result.status, 'ready');
  for (const value of [result.a.finalValue, result.a.feesPaid, result.a.feeEffect, result.b.finalValue, result.noFeeFinalValue]) assert.ok(Number.isFinite(value) && value >= 0);
  assert.ok(result.a.finalValue < result.b.finalValue);
  assert.equal(result.b.finalValue, result.noFeeFinalValue);
});
