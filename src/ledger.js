// All stored amounts are integer cents. Derived closing cash may be negative.
export const MONEY_FIELDS = ['opening', 'cash', 'card', 'expenses', 'withdrawals'];
export const MAX_CENTS = 10_000_000_000;
export const LEGACY_KEY = 'smartledger-v1';
export const DEMO_KEY = 'smartledger-demo-v2';
export const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
export const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const close = r => r.opening + r.cash - r.expenses - r.withdrawals;
export const cashDifference = r => r.actual === undefined ? null : r.actual - close(r);
export function cashStatus(r) {
  const difference = cashDifference(r);
  return difference === null ? 'Not counted' : difference === 0 ? 'Balanced'
    : difference < 0 ? 'Short by ' + money(-difference) : 'Over by ' + money(difference);
}
export const escapeText = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function validDate(date) {
  if (typeof date !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) || date.slice(0, 4) === '0000') return false;
  const time = Date.parse(date + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}
export function validateRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || !validDate(record.date)) throw Error('Record contains an invalid date.');
  const allowed = ['date', ...MONEY_FIELDS, 'actual', 'notes'];
  if (Object.keys(record).some(key => !allowed.includes(key))) throw Error('Record contains unsupported fields.');
  const clean = { date: record.date };
  for (const field of [...MONEY_FIELDS, ...(record.actual !== undefined ? ['actual'] : [])]) {
    if (!Number.isSafeInteger(record[field]) || record[field] < 0 || record[field] > MAX_CENTS) throw Error('Record contains an invalid amount: ' + field + '.');
    clean[field] = record[field];
  }
  if (record.notes !== undefined && (typeof record.notes !== 'string' || [...record.notes].length > 300)) throw Error('Record contains invalid notes.');
  clean.notes = record.notes || '';
  return clean;
}
export function validateBackup(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 10000) throw Error('This is not a supported SmartLedger backup.');
  const dates = new Set();
  return data.records.map(record => {
    const clean = validateRecord(record);
    if (dates.has(clean.date)) throw Error('Backup contains an invalid or duplicate date.');
    dates.add(clean.date);
    return clean;
  });
}
export function parseCents(value, optional = false) {
  if (optional && value === '') return undefined;
  if (typeof value !== 'string' || !/^\d+(\.\d{1,2})?$/.test(value)) throw Error('Enter a non-negative amount with at most two decimal places.');
  const [whole, decimal = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) throw Error('Amount is too large.');
  return cents;
}
export function sample() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i);
    return { date: iso(d), opening: 20000, cash: [42000,38500,51200,46800,59000,72600,63500][i], card: [61200,57000,68400,64000,78000,92000,81500][i], expenses: [8000,6500,12000,7600,9300,15000,10800][i], withdrawals: 25000, notes: '' };
  });
}
export function importPlan(local, remote) {
  const clean = validateBackup({ version: 1, records: local });
  const dates = new Set(remote.map(r => r.date));
  return { eligible: clean.filter(r => !dates.has(r.date)), duplicates: clean.filter(r => dates.has(r.date)), records: clean };
}
export function readLegacy(storage) {
  const value = storage.getItem(LEGACY_KEY);
  return value === null ? null : validateBackup({ version: 1, records: JSON.parse(value) });
}
export function toCSV(records) {
  const quote = text => '"' + String(text).replace(/"/g, '""') + '"';
  // Prefix formula-like notes so opening the CSV in Excel cannot execute them.
  const safeNote = note => /^[=+\-@\t\r\n]/.test(note) ? "'" + note : note;
  return 'Date,Opening cash,Cash sales,Card sales,Cash expenses,Withdrawals,Closing cash,Actual cash counted,Cash difference,Cash status,Notes\n' + records.map(r => [r.date, ...MONEY_FIELDS.map(k => (r[k] / 100).toFixed(2)), (close(r) / 100).toFixed(2), r.actual === undefined ? '' : (r.actual / 100).toFixed(2), cashDifference(r) === null ? '' : (cashDifference(r) / 100).toFixed(2), cashStatus(r), quote(safeNote(r.notes || ''))].join(',')).join('\n');
}
