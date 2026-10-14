import { validateRecord, validDate, money, close } from '../src/ledger.js';

export function parseSummaryRequest(body) {
  if (!body || typeof body!=='object' || Array.isArray(body) || Object.keys(body).some(k => !['start','end','language'].includes(k))) throw Error('Invalid summary request.');
  const { start='', end='', language='en' } = body;
  if (typeof start!=='string'||typeof end!=='string'||(start&&!validDate(start))||(end&&!validDate(end))||(start&&end&&start>end)||!['en','ne'].includes(language)) throw Error('Choose a valid date range and language.');
  return {start,end,language};
}
export function summaryFacts(records, range) {
  const rows=records.map(validateRecord).filter(r=>(!range.start||r.date>=range.start)&&(!range.end||r.date<=range.end)).sort((a,b)=>b.date.localeCompare(a.date));
  if(new Set(rows.map(r=>r.date)).size!==rows.length)throw Error('Duplicate dates in ledger.');
  if (!rows.length) return null;
  const start=range.start||rows.at(-1).date,end=range.end||rows[0].date;
  const expectedDays=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;
  const sum=k=>rows.reduce((total,r)=>total+r[k],0);
  const sales=sum('cash')+sum('card');
  return {start,end,recordedDays:rows.length,expectedDays,missingDays:expectedDays-rows.length,insufficientData:rows.length<2,salesCents:sales,expensesCents:sum('expenses'),averageCents:Math.round(sales/rows.length),cardSharePercent:Math.round(sum('card')/Math.max(1,sales)*100),strongestDay:rows.reduce((best,r)=>r.cash+r.card>best.cash+best.card?r:best,rows[0]).date,latestClosingCents:close(rows[0])};
}
export function factSlots(facts) {
  return {sales:money(facts.salesCents),expenses:money(facts.expensesCents),average:money(facts.averageCents),cardShare:facts.cardSharePercent+'%',strongestDay:facts.strongestDay,recordedDays:String(facts.recordedDays),missingDays:String(facts.missingDays),closing:money(facts.latestClosingCents)};
}
export function validateModelSummary(text, facts) {
  if(typeof text!=='string'||text.length<10||text.length>1800)throw Error('Invalid model summary.');
  const slots=factSlots(facts);
  const withoutSlots=text.replace(/\{\{([A-Za-z]+)\}\}/g,(_,key)=>{if(!(key in slots))throw Error('Unknown summary fact.');return '';});
  // Model text may explain facts, but all figures must come from code-owned slots.
  if(/[\p{N}$%{}<>]/u.test(withoutSlots)||/\b(profit|loss|zero|one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|million|billion)\b|नाफा|नोक्सान/i.test(withoutSlots))throw Error('Summary contains an unsupported financial claim or figure.');
  return text.replace(/\{\{([A-Za-z]+)\}\}/g,(_,key)=>slots[key]);
}
