// Pure list filtering, export, and deterministic insights over own records.
// No provider calls: every insight is a labelled deterministic fallback.
const FALLBACK_LABEL = 'Deterministic fallback — not AI-generated';

function textOf(row) {
  return [row.reference, row.title, row.owner, row.status, row.risk, JSON.stringify(row.payload ?? '')].join(' ').toLowerCase();
}

export function filterRecords(rows, query = {}) {
  const q = String(query.q || '').trim().toLowerCase();
  const status = String(query.status || '').trim();
  const risk = String(query.risk || '').trim();
  const owner = String(query.owner || '').trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (q && !textOf(row).includes(q)) return false;
    if (status && row.status !== status) return false;
    if (risk && row.risk !== risk) return false;
    if (owner && !String(row.owner || '').toLowerCase().includes(owner)) return false;
    return true;
  });
}

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function recordsToCSV(rows) {
  const columns = ['id', 'reference', 'title', 'status', 'owner', 'risk', 'due_date', 'amount'];
  const lines = [columns.join(',')];
  for (const row of rows || []) lines.push(columns.map((col) => csvCell(row[col])).join(','));
  return lines.join('\n') + '\n';
}

function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

export function buildInsights(rows, feature, now = new Date()) {
  const list = rows || [];
  const open = list.filter((r) => !['Approved', 'Closed'].includes(r.status));
  const highRisk = list.filter((r) => ['High', 'Critical'].includes(r.risk));
  const overdue = open.filter((r) => r.due_date && new Date(r.due_date) < now);
  const totalValue = list.reduce((sum, r) => sum + num(r.amount), 0);
  const openValue = open.reduce((sum, r) => sum + num(r.amount), 0);
  const top = [...list].sort((a, b) => num(b.amount) - num(a.amount))[0] || null;
  const byStatus = {};
  const byOwner = {};
  for (const r of list) { byStatus[r.status] = (byStatus[r.status] || 0) + 1; byOwner[r.owner || 'Unassigned'] = (byOwner[r.owner || 'Unassigned'] || 0) + 1; }
  const base = { aiGenerated: false, source: 'deterministic-fallback', label: FALLBACK_LABEL };
  return {
    ...base,
    featureId: feature?.id || null,
    featureTitle: feature?.title || 'Records',
    recordCount: list.length,
    insights: [
      { ...base, id: 'exception-triage', title: `${feature?.title || 'Record'} exception triage`, summary: `${open.length} open, ${highRisk.length} high/critical-risk, and ${overdue.length} overdue records need operational review.`, metrics: [{ label: 'Total records', value: list.length }, { label: 'Open records', value: open.length }, { label: 'High/Critical risk', value: highRisk.length }, { label: 'Overdue open', value: overdue.length }], items: overdue.slice(0, 5).map((r) => ({ reference: r.reference, status: r.status, risk: r.risk, dueDate: r.due_date ? String(r.due_date).slice(0, 10) : null })) },
      { ...base, id: 'value-concentration', title: `${feature?.title || 'Record'} value concentration`, summary: top ? `Largest open exposure is ${top.reference}; open value is concentrated in the highest-amount cases.` : 'No records yet, so there is no value concentration to review.', metrics: [{ label: 'Total value', value: totalValue }, { label: 'Open value', value: openValue }, { label: 'Largest case value', value: top ? num(top.amount) : 0 }, { label: 'Largest case', value: top ? top.reference : 'None' }], items: [...list].sort((a, b) => num(b.amount) - num(a.amount)).slice(0, 5).map((r) => ({ reference: r.reference, amount: num(r.amount), status: r.status })) },
      { ...base, id: 'workload-distribution', title: `${feature?.title || 'Record'} workload distribution`, summary: 'Counts by status and owner show where operational follow-up is concentrated; zero-count states are preserved.', metrics: Object.entries(byStatus).map(([label, value]) => ({ label: `Status: ${label}`, value })).concat([{ label: 'Distinct owners', value: Object.keys(byOwner).length }]), items: Object.entries(byOwner).map(([owner, count]) => ({ owner, count })) },
    ],
  };
}
