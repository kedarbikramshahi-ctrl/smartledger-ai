import { validDate, validateRecord, close } from '../src/ledger.js';

export const COMPARISON_FIELDS=['opening','cash','card','expenses','withdrawals','closing','actual','cash_difference','total_sales','card_share','reconciliation'];
export const BROAD_FIELDS=['total_sales','cash','card','expenses','card_share','reconciliation'];
export const QUERY_REASONS=['none','periods','fields','context','calendar','missing_data','unsupported'];
export function relativePeriods(calendar) {
  const shift=days=>new Date(Date.parse(calendar.monday+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
  return {this_week:{start:calendar.monday,end:calendar.today},last_week:{start:shift(-7),end:shift(-1)},elapsed_last_week:{start:shift(-7),end:shift(-7+calendar.elapsed)},this_month:{start:calendar.today.slice(0,7)+'-01',end:calendar.today}};
}
const exact=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));

export function validateDateRange(p,today) {
  if(!exact(p,['start','end'])||!validDate(p.start)||!validDate(p.end)||p.start>p.end||(today&&p.end>today))throw Error('Choose real calendar dates through today, in order.');
  return {start:p.start,end:p.end};
}
export function validatePeriods(periods,today) {
  if(!Array.isArray(periods)||periods.length!==2)throw Error('Choose two date ranges.');
  return periods.map(p=>validateDateRange(p,today));
}
export function validateFields(fields) {
  if(!Array.isArray(fields)||!fields.length||fields.length>COMPARISON_FIELDS.length||new Set(fields).size!==fields.length||fields.some(f=>!COMPARISON_FIELDS.includes(f)))throw Error('Choose supported ledger fields.');
  return [...fields];
}
export function validateComparison(query) {
  if(!exact(query,['metric','period','periods','fields','useContext','reason'])||query.metric!=='compare'||query.period!==null||typeof query.useContext!=='boolean'||query.reason!=='none')throw Error('Invalid comparison.');
  const fields=validateFields(query.fields);
  if(query.useContext){if(!Array.isArray(query.periods)||query.periods.length)throw Error('Follow-ups cannot override confirmed periods.');}
  else validatePeriods(query.periods);
  return {...query,fields};
}
export function resolveComparison(query,confirmed,calendar) {
  const q=validateComparison(query);
  if(q.useContext&&!confirmed)return {metric:'clarify',period:'all',reason:'context'};
  return {...q,periods:validatePeriods(q.useContext?confirmed.periods:q.periods,calendar.today),useContext:false};
}
export function ledgerPeriodFacts(records,ranges,calendar) {
  if(!Array.isArray(ranges)||ranges.length<1||ranges.length>2)throw Error('Invalid ledger periods.');
  const bounds=ranges.map(p=>validateDateRange(p,calendar.today));
  const rows=records.map(validateRecord).sort((a,b)=>a.date.localeCompare(b.date));
  if(rows.length>10000||new Set(rows.map(r=>r.date)).size!==rows.length)throw Error('Invalid ledger.');
  return bounds.map(({start,end})=>{
    const selected=rows.filter(r=>r.date>=start&&r.date<=end);
    const sum=field=>selected.reduce((total,r)=>total+r[field],0);
    const counted=selected.filter(r=>r.actual!==undefined).map(r=>({date:r.date,actualCents:r.actual,expectedCents:close(r),differenceCents:r.actual-close(r)}));
    const shortages=counted.filter(r=>r.differenceCents<0),overages=counted.filter(r=>r.differenceCents>0);
    const expectedDays=(Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000+1;
    const sales=sum('cash')+sum('card'),first=selected[0],last=selected.at(-1),latestCount=counted.at(-1);
    const flow=value=>({aggregation:'sum',valueCents:selected.length?value:null});
    const values={opening:{aggregation:'first_recorded_opening',valueCents:first?.opening??null,date:first?.date??null},
      closing:{aggregation:'latest_recorded_closing',valueCents:last?close(last):null,date:last?.date??null},
      actual:{aggregation:'latest_counted_snapshot',valueCents:latestCount?.actualCents??null,date:latestCount?.date??null},
      cash:flow(sum('cash')),card:flow(sum('card')),expenses:flow(sum('expenses')),withdrawals:flow(sum('withdrawals')),total_sales:flow(sales),
      card_share:{aggregation:'card_share_of_recorded_sales',percent:selected.length&&sales?Math.round(sum('card')/sales*10000)/100:null,cardCents:selected.length?sum('card'):null,salesCents:selected.length?sales:null}};
    return {start,end,recordedDays:selected.length,expectedDays,missingDays:expectedDays-selected.length,recordedDates:selected.map(r=>r.date),values,
      reconciliation:{countedDays:counted.length,uncountedDays:selected.length-counted.length,counted,shortageDays:shortages.length,overageDays:overages.length,balancedDays:counted.length-shortages.length-overages.length,
        totalShortageCents:shortages.reduce((s,r)=>s-r.differenceCents,0),totalOverageCents:overages.reduce((s,r)=>s+r.differenceCents,0)}};
  });
}
export function comparisonFacts(records,query,calendar) {
  const q=resolveComparison(query,null,calendar);
  if(q.metric!=='compare')throw Error('Comparison context is required.');
  const periods=ledgerPeriodFacts(records,q.periods,calendar);
  const [a,b]=periods;
  const changes=Object.fromEntries(q.fields.map(field=>{
    if(['cash_difference','reconciliation'].includes(field)){
      const available=a.reconciliation.countedDays>0&&b.reconciliation.countedDays>0;
      return [field,{aggregation:'separate_reconciliation',shortageDaysChange:available?b.reconciliation.shortageDays-a.reconciliation.shortageDays:null,overageDaysChange:available?b.reconciliation.overageDays-a.reconciliation.overageDays:null,
        shortageAmountChangeCents:available?b.reconciliation.totalShortageCents-a.reconciliation.totalShortageCents:null,overageAmountChangeCents:available?b.reconciliation.totalOverageCents-a.reconciliation.totalOverageCents:null}];
    }
    if(field==='card_share')return [field,{aggregation:'percentage_points',percentagePoints:a.values.card_share.percent===null||b.values.card_share.percent===null?null:Math.round((b.values.card_share.percent-a.values.card_share.percent)*100)/100}];
    const av=a.values[field].valueCents,bv=b.values[field].valueCents,available=av!==null&&bv!==null;
    return [field,{aggregation:a.values[field].aggregation,changeCents:available?bv-av:null,changePercent:available&&a.values[field].aggregation==='sum'&&av!==0?Math.round((bv-av)/av*10000)/100:null,higher:available?(bv>av?'B':av>bv?'A':'equal'):null}];
  }));
  return {query:q,timezone:calendar.timezone,today:calendar.today,periods,changes};
}
