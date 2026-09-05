import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isFiFundDataset,
  isFiFundSource,
  isNewerFiSource,
} from '../lib/funds/fi-funds.ts';

const datasetUrl = new URL(
  '../public/data/fi-funds-latest.json',
  import.meta.url,
);
const manifestUrl = new URL(
  '../public/data/fi-funds-latest.meta.json',
  import.meta.url,
);

test('bundled FI dataset and public update manifest describe the same validated archive', async () => {
  const dataset = JSON.parse(await readFile(datasetUrl, 'utf8'));
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));

  assert.equal(isFiFundDataset(dataset), true);
  assert.equal(isFiFundSource(manifest), true);
  assert.deepEqual(manifest, dataset.source);
  assert.match(dataset.source.fetchedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(dataset.source.archiveName, /^Fondinnehav_\d{4}Q[1-4]_/);
});

test('remote FI metadata only wins when the report or archive is actually newer', () => {
  const current = {
    name: 'Finansinspektionen',
    period: '2026 Q2',
    reportDate: '2026-06-30',
    publishedAt: '2026-08-20',
    archiveName: 'q2-a.zip',
    url: 'https://www.fi.se/',
  };

  assert.equal(isNewerFiSource({ ...current }, current), false);
  assert.equal(
    isNewerFiSource(
      { ...current, archiveName: 'q2-b.zip', publishedAt: '2026-08-21' },
      current,
    ),
    true,
  );
  assert.equal(
    isNewerFiSource(
      {
        ...current,
        period: '2026 Q3',
        reportDate: '2026-09-30',
        publishedAt: '2026-11-20',
      },
      current,
    ),
    true,
  );
  assert.equal(
    isNewerFiSource(
      { ...current, period: '2026 Q1', reportDate: '2026-03-31' },
      current,
    ),
    false,
  );
});

test('malformed remote holdings cannot replace trusted FI data', async () => {
  const dataset = JSON.parse(await readFile(datasetUrl, 'utf8'));
  const malformed = structuredClone(dataset);
  malformed.funds[0].holdings[0].weight = Number.NaN;
  assert.equal(isFiFundDataset(malformed), false);
});
