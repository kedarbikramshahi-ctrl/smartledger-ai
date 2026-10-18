import { validateRecord, close, money } from '../src/ledger.js';
import { validateComparison, QUERY_REASONS } from './comparison.js';
import { validateStandalone } from './standalone.js';

export const METRICS = ['sales','compare_sales','highest_sales','cash_differences','card_share','cash_expenses','unsupported','clarify'];
export const PERIODS = ['all','this_week','last_week','this_month'];
export function parseAskRequest(body) {
  const validReference=value=>value===undefined||(typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value));
  if(!validReference(body?.questionContext))throw Error('Invalid question context.');
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k=>!['question','language','comparisonContext','questionContext'].includes(k)) || typeof body.question !== 'string' || !body.question.trim() || [...body.question].length > 500 || !['en','ne'].includes(body.language) || (body.comparisonContext!==undefined&&(typeof body.comparisonContext!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(body.comparisonContext)))) throw Error('Enter a question of at most 500 characters and choose English or Nepali.');
  return {question:body.question.trim(),language:body.language,...(body.questionContext?{questionContext:body.questionContext}:{}),...(body.comparisonContext?{comparisonContext:body.comparisonContext}:{})};
}
export function validateQuery(query) {
  if(query?.metric==='ledger')return validateStandalone(query);
  if(query?.metric==='compare')return validateComparison(query);
  if(query&&Object.keys(query).length===6){
    if(!['metric','period','periods','fields','useContext','reason'].every(k=>Object.hasOwn(query,k))||!Array.isArray(query.periods)||query.periods.length||!Array.isArray(query.fields)||query.fields.length||query.useContext!==false||!QUERY_REASONS.includes(query.reason))throw Error('Invalid interpreted query.');
    const legacy=validateQuery({metric:query.metric,period:query.period});
    if(!['clarify','unsupported'].includes(legacy.metric)&&query.reason!=='none')throw Error('Invalid query reason.');
    return {...legacy,...(['clarify','unsupported'].includes(legacy.metric)?{reason:query.reason}:{})};
  }
  if (!query || typeof query !== 'object' || Array.isArray(query) || Object.keys(query).length !== 2 || !METRICS.includes(query.metric) || !PERIODS.includes(query.period) || (query.metric==='compare_sales' && query.period!=='this_week')) throw Error('Invalid ledger query.');
  return {metric:query.metric,period:query.period};
}
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export function storeCalendar(timezone='America/New_York', now=new Date()) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=key=>parts.find(p=>p.type===key).value;
  const today=`${part('year')}-${part('month')}-${part('day')}`;
  const elapsed=(new Date(today+'T00:00:00Z').getUTCDay()+6)%7;
  return {timezone,today,monday:shift(today,-elapsed),elapsed};
}
export function askFacts(records,query,calendar) {
  validateQuery(query);
  const clean=records.map(validateRecord).sort((a,b)=>a.date.localeCompare(b.date));
  if(new Set(clean.map(r=>r.date)).size!==clean.length)throw Error('Duplicate ledger dates.');
  const rows=clean.filter(r=>r.date<=calendar.today);
  const {today,monday,elapsed}=calendar;
  const bounds=query.period==='this_week'?[monday,today]:query.period==='last_week'?[shift(monday,-7),shift(monday,-1)]:query.period==='this_month'?[today.slice(0,7)+'-01',today]:[rows[0]?.date||today,today];
  function period(start,end) {
    const selected=rows.filter(r=>r.date>=start&&r.date<=end);
    const sum=k=>selected.reduce((s,r)=>s+r[k],0);
    const expectedDays=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(start+'T00:00:00Z'))/86400000)+1;
    const counted=selected.filter(r=>r.actual!==undefined);
    const highestSales=selected.reduce((max,r)=>Math.max(max,r.cash+r.card),0);
    return {start,end,recordedDays:selected.length,expectedDays,missingDays:expectedDays-selected.length,salesCents:sum('cash')+sum('card'),cardCents:sum('card'),expensesCents:sum('expenses'),countedDays:counted.length,uncountedDays:selected.length-counted.length,
      differences:query.metric==='cash_differences'?counted.filter(r=>r.actual!==close(r)).map(r=>({date:r.date,actualCents:r.actual,expectedCents:close(r),differenceCents:r.actual-close(r)})):[],
      highest:query.metric==='highest_sales'&&selected.length?selected.filter(r=>r.cash+r.card===highestSales).map(r=>({date:r.date,salesCents:r.cash+r.card})):[]};
  }
  const current=period(...bounds);
  const previous=query.metric==='compare_sales'?period(shift(monday,-7),shift(monday,-7+elapsed)):null;
  const comparable=previous&&current.recordedDays>0&&previous.recordedDays>0;
  return {query,timezone:calendar.timezone,today,current,previous,partialWeek:query.metric==='compare_sales'&&elapsed<6,
    changeCents:comparable?current.salesCents-previous.salesCents:null,
    changePercent:comparable&&previous.salesCents!==0?Math.round((current.salesCents-previous.salesCents)/previous.salesCents*10000)/100:null,
    cardSharePercent:current.recordedDays&&current.salesCents!==0?Math.round(current.cardCents/current.salesCents*10000)/100:null};
}
export function answerSentences(f,language) {
  const ne=language==='ne',p=f.current,metric=f.query.metric;
  let result;
  if(!p.recordedDays)result=ne?'यस अवधिमा कुनै रेकर्ड छैन। बिक्री शून्य भएको निष्कर्ष निकाल्न मिल्दैन।':'No records match this period. This does not mean sales were zero.';
  else if(metric==='sales')result=ne?`रेकर्ड गरिएको कुल बिक्री ${money(p.salesCents)} छ।`:`Recorded total sales were ${money(p.salesCents)}.`;
  else if(metric==='cash_expenses')result=ne?`रेकर्ड गरिएको नगद खर्च ${money(p.expensesCents)} छ।`:`Recorded cash expenses were ${money(p.expensesCents)}.`;
  else if(metric==='highest_sales')result=ne?`सबैभन्दा बढी रेकर्ड गरिएको दैनिक बिक्री ${money(p.highest[0].salesCents)} थियो। बराबरी भएका सबै मितिहरू प्रमाणमा छन्।`:`The highest recorded daily sales were ${money(p.highest[0].salesCents)}. All tied dates are shown in the evidence.`;
  else if(metric==='card_share')result=ne?`कार्ड बिक्री ${money(p.cardCents)}; कुल बिक्री ${money(p.salesCents)}। ${f.cardSharePercent===null?'कुल बिक्री शून्य भएकाले प्रतिशत निकालिएको छैन।':`कार्डको हिस्सा ${f.cardSharePercent}% छ।`}`:`Card sales were ${money(p.cardCents)} out of ${money(p.salesCents)} total sales. ${f.cardSharePercent===null?'No percentage is calculated because total sales were zero.':`The card share was ${f.cardSharePercent}%.`}`;
  else if(metric==='cash_differences')result=ne?`नगद गनिएका ${p.countedDays} दिनमध्ये ${p.differences.length} दिनमा कमी वा बढी भेटियो। नगद नगनिएका दिन: ${p.uncountedDays}। कारण रेकर्डबाट थाहा हुँदैन।`:`Of ${p.countedDays} days with actual cash counted, ${p.differences.length} had shortages or overages. ${p.uncountedDays} recorded days were not counted. The records do not establish a cause.`;
  else result=ne?`हालको अवधिको रेकर्ड गरिएको बिक्री ${money(p.salesCents)} छ।`:`Recorded sales for the current period were ${money(p.salesCents)}.`;
  const coverage=ne?`${p.start} देखि ${p.end}: ${p.expectedDays} पात्रो दिनमध्ये ${p.recordedDays} दिनको रेकर्ड छ; ${p.missingDays} दिनको रेकर्ड छैन। हराएका दिनलाई शून्य बिक्री मानिएको छैन।`:`${p.start} through ${p.end}: ${p.recordedDays} recorded days out of ${p.expectedDays} calendar days; ${p.missingDays} days have no record. Missing days are not treated as zero sales.`;
  const sentences={result,coverage};
  if(f.previous){const b=f.previous;
    sentences.comparison=ne?`${f.partialWeek?'समान बितेका बारहरूको आंशिक हप्ता तुलना':'पूरा हप्ता तुलना'}: ${b.start} देखि ${b.end}, ${b.expectedDays} मध्ये ${b.recordedDays} दिन रेकर्ड, ${b.missingDays} दिनको रेकर्ड छैन; बिक्री ${money(b.salesCents)}। ${f.changeCents===null?'तुलनाका लागि दुवै अवधिमा रेकर्ड चाहिन्छ।':`रेकर्ड गरिएको फरक ${money(f.changeCents)}। ${f.changePercent===null?'आधार बिक्री शून्य भएकाले प्रतिशत परिवर्तन निकालिएको छैन।':`परिवर्तन ${f.changePercent}%।`}`} अपूर्ण रेकर्डले वास्तविक बिक्री परिवर्तन प्रमाणित गर्दैन।`:`${f.partialWeek?'Partial week comparison using equivalent elapsed weekdays':'Full week comparison'}: ${b.start} through ${b.end}, ${b.recordedDays} of ${b.expectedDays} days recorded, ${b.missingDays} days missing; sales ${money(b.salesCents)}. ${f.changeCents===null?'Both periods need records for a comparison.':`Recorded difference: ${money(f.changeCents)}. ${f.changePercent===null?'No percentage change is calculated because the baseline was zero.':`Change: ${f.changePercent}%.`}`} Incomplete records cannot establish the actual sales change.`;
  }
  return sentences;
}
// AI composes explanations only from code-owned localized sentences. No free-form financial claims.
export function validateExplanation(output,sentences,{leadWithResult=false}={}) {
  if(!output||typeof output!=='object'||Array.isArray(output)||Object.keys(output).length!==1||!Array.isArray(output.sentences)||output.sentences.length!==Object.keys(sentences).length||new Set(output.sentences).size!==output.sentences.length||output.sentences.some(k=>!Object.hasOwn(sentences,k)))throw Error('Invalid explanation.');
  const order=leadWithResult?['result',...output.sentences.filter(k=>k!=='result'&&k!=='coverage'),...(sentences.coverage?['coverage']:[])]:output.sentences;
  return order.map(k=>sentences[k]).join('\n\n');
}
