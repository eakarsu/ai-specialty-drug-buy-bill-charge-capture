import test from 'node:test';
import assert from 'node:assert/strict';
// Offline only: pure module, no provider keys are read or used.
delete process.env.OPENROUTER_API_KEY;
const { filterRecords, recordsToCSV, buildInsights } = await import('../listInsights.mjs');

const rows = [
  { id: 1, reference: 'SPG01-1', title: 'Late delivery case', status: 'Open', owner: 'Ana', risk: 'High', due_date: '2020-01-01', amount: 0, payload: { evidenceState: 'Complete' } },
  { id: 2, reference: 'SPG01-2', title: 'Closed case', status: 'Closed', owner: 'Ben', risk: 'Low', due_date: '2999-01-01', amount: 500, payload: {} },
];

test('filterRecords searches and filters the main list', () => {
  assert.equal(filterRecords(rows, { q: 'late' }).length, 1);
  assert.equal(filterRecords(rows, { status: 'Closed' })[0].reference, 'SPG01-2');
  assert.equal(filterRecords(rows, { risk: 'High', q: 'ana' }).length, 1);
  assert.equal(filterRecords(rows, { q: 'missing' }).length, 0);
});

test('recordsToCSV preserves 0 and escapes text', () => {
  const csv = recordsToCSV(rows);
  assert.ok(csv.startsWith('id,reference,title,status,owner,risk,due_date,amount'));
  assert.ok(csv.includes('SPG01-1'));
  assert.ok(csv.split('\n')[1].endsWith(',0'));
});

test('buildInsights is a labelled deterministic fallback preserving false/0/empty', () => {
  const out = buildInsights(rows, { id: 'f1', title: 'Carrier agreement library' }, new Date('2026-01-01'));
  assert.equal(out.aiGenerated, false);
  assert.equal(out.insights.length, 3);
  assert.ok(out.insights.every((i) => i.aiGenerated === false && i.label.includes('not AI-generated')));
  const triage = out.insights.find((i) => i.id === 'exception-triage');
  assert.equal(triage.metrics.find((m) => m.label === 'Overdue open').value, 1);
  const empty = buildInsights([], { id: 'f1', title: 'X' });
  assert.equal(empty.recordCount, 0);
  assert.equal(empty.insights.find((i) => i.id === 'value-concentration').metrics.find((m) => m.label === 'Largest case value').value, 0);
});
