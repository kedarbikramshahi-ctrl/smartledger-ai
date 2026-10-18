import { validateDateRange, validateFields, ledgerPeriodFacts, relativePeriods } from './comparison.js';
const PERIODS=['all','this_week','last_week','this_month'];

export function validateStandalone(query) {
  if(!query||typeof query!=='object'||Array.isArray(query)||Object.keys(query).length!==6||!['metric','period','periods','fields','useContext','reason'].every(k=>Object.hasOwn(query,k))||query.metric!=='ledger'||query.useContext!==false||query.reason!=='none'||!Array.isArray(query.periods))throw Error('Invalid standalone query.');
  const fields=validateFields(query.fields);
  if(query.period===null){if(query.periods.length!==1)throw Error('Choose one period.');validateDateRange(query.periods[0]);}
  else if(!PERIODS.includes(query.period)||query.periods.length)throw Error('Invalid standalone period.');
  return {...query,fields};
}
export function standaloneFacts(records,query,calendar) {
  const q=validateStandalone(query);
  const first=records.map(r=>r.date).filter(date=>typeof date==='string'&&date<=calendar.today).sort()[0]||calendar.today;
  const range=q.period===null?validateDateRange(q.periods[0],calendar.today):q.period==='all'?{start:first,end:calendar.today}:relativePeriods(calendar)[q.period];
  const [period]=ledgerPeriodFacts(records,[range],calendar);
  return {query:{...q,period:null,periods:[range]},timezone:calendar.timezone,today:calendar.today,period};
}

// This controls access to history, not financial interpretation. Explicit periods always take precedence.
export function isComparisonFollowUp(question) {
  const text=question.normalize('NFKC');
  const explicit=/\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}|(?:19|20)\d{2}|jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|today|yesterday|this\s+(?:week|month|year)|last\s+(?:week|month|year))\b|जनवरी|फेब्रुअरी|मार्च|अप्रिल|मे\s|जुन|जुलाई|अगस्ट|सेप्टेम्बर|अक्टोबर|अक्टुबर|नोभेम्बर|डिसेम्बर|आज|हिजो|यो\s*(?:हप्ता|महिना|वर्ष)|गत\s*(?:हप्ता|महिना|वर्ष)|[०-९]{4}/iu;
  if(explicit.test(text))return false;
  return /\b(?:what about|how about|those\s+(?:(?:same|two)\s+)?(?:days|dates|weeks|periods)|same\s+(?:days|dates|weeks|periods)|which\s+(?:week|day|period)\s+had\s+more|what was different|follow[ -]?up)\b|^\s*(?:and\b|also\b|अनि|अझ|र\s)|ती\s*(?:दुई\s*)?(?:दिन|मिति|हप्ता|अवधि)|उही\s*(?:दिन|मिति|हप्ता|अवधि)/iu.test(text);
}
