import { money } from './ledger.js';
import { fieldLabel, conciseMoney, dateName, periodName } from './comparison-answer.js';

export function standaloneDescription(query,language) {
  const p=query.periods[0];
  return `${p.start}${p.start===p.end?'':' → '+p.end} | ${query.fields.map(f=>fieldLabel(f,language)).join(', ')}`;
}
export function standaloneSentences(f,language) {
  const p=f.period,ne=language==='ne',single=p.start===p.end,year=p.start.slice(0,4)!==f.today.slice(0,4)||p.end.slice(0,4)!==f.today.slice(0,4),name=periodName(p,language,year);
  if(!p.recordedDays)return {result:ne?`${name} का लागि लेजर रेकर्ड छैन। रेकर्ड नभएकोलाई शून्य मान्न मिल्दैन।`:`No ledger record was saved for ${name}. Missing records do not mean zero amounts.`};
  const sentences={};
  for(const field of f.query.fields){
    if(['cash_difference','reconciliation'].includes(field)){
      if(sentences.reconciliation)continue;
      const r=p.reconciliation,c=r.counted[0];
      if(single){
        if(!c)sentences.reconciliation=ne?`${name} मा वास्तविक नगद गनिएको थिएन, त्यसैले नगद मिलेको थियो कि थिएन पुष्टि गर्न सकिँदैन। अपेक्षित अन्तिम नगद ${conciseMoney(p.values.closing.valueCents)} थियो।`:`Actual cash was not counted on ${name}, so I cannot confirm whether the drawer was balanced. Expected closing cash was ${conciseMoney(p.values.closing.valueCents)}.`;
        else if(c.actualCents===c.expectedCents)sentences.reconciliation=ne?`${name} मा नगद मिलेको थियो। वास्तविक गनिएको र अपेक्षित नगद दुवै ${conciseMoney(c.actualCents)} थिए।`:`${name} was balanced. Expected closing cash and actual cash counted were both ${conciseMoney(c.actualCents)}.`;
        else sentences.reconciliation=ne?`${name} मा नगद ${conciseMoney(Math.abs(c.differenceCents))} ${c.differenceCents<0?'कम':'बढी'} थियो। गनिएको नगद ${conciseMoney(c.actualCents)} र अपेक्षित नगद ${conciseMoney(c.expectedCents)} थियो।`:`The cash drawer was ${c.differenceCents<0?'short':'over'} by ${conciseMoney(Math.abs(c.differenceCents))} on ${name}. Actual cash counted was ${conciseMoney(c.actualCents)}; expected closing cash was ${conciseMoney(c.expectedCents)}.`;
      } else sentences.reconciliation=ne?`${name} का ${p.recordedDays} रेकर्ड दिनमध्ये ${r.countedDays} दिनमा नगद गनिएको छ। कमी भएका ${r.shortageDays} दिन (${conciseMoney(r.totalShortageCents)}), बढी भएका ${r.overageDays} दिन (${conciseMoney(r.totalOverageCents)}) र मिलेका ${r.balancedDays} दिन छन्। नगनिएका दिन ${r.uncountedDays} छन्।`:`For ${name}, cash was counted on ${r.countedDays} of ${p.recordedDays} recorded days: ${r.shortageDays} shortage ${r.shortageDays===1?'day':'days'} (${conciseMoney(r.totalShortageCents)}), ${r.overageDays} overage ${r.overageDays===1?'day':'days'} (${conciseMoney(r.totalOverageCents)}), and ${r.balancedDays} balanced ${r.balancedDays===1?'day':'days'}. ${r.uncountedDays} recorded ${r.uncountedDays===1?'day was':'days were'} not counted.`;
    } else if(field==='card_share'){
      const v=p.values.card_share;
      sentences[field]=v.percent===null?(ne?`${name} मा कुल बिक्री शून्य भएकाले कार्डको प्रतिशत निकाल्न मिल्दैन।`:`Card share is undefined for ${name} because recorded total sales were zero.`):(ne?`${name} को कुल बिक्री ${conciseMoney(v.salesCents)} मध्ये कार्ड बिक्री ${conciseMoney(v.cardCents)} (${v.percent}%) थियो।`:`Card sales were ${conciseMoney(v.cardCents)} of ${conciseMoney(v.salesCents)} total sales for ${name} (${v.percent}%).`);
    } else {
      const v=p.values[field],label=fieldLabel(field,language);
      if(v.valueCents===null)sentences[field]=ne?`${name} मा वास्तविक नगद गनिएको रेकर्ड छैन।`:`Actual cash was not counted for ${name}.`;
      else if(v.aggregation==='sum')sentences[field]=ne?`${name} को रेकर्ड गरिएको ${label} ${conciseMoney(v.valueCents)} थियो।`:`${label} ${single?'on':'for'} ${name} were ${conciseMoney(v.valueCents)}.`;
      else {const date=dateName(v.date,language,year),prefix=field==='opening'?'First recorded opening cash':field==='closing'?'Latest expected closing cash':'Latest actual cash counted';
        sentences[field]=ne?`${label} ${date} मा ${conciseMoney(v.valueCents)} थियो।`:`${prefix} was ${conciseMoney(v.valueCents)} on ${date}.`;
      }
    }
  }
  const entries=Object.entries(sentences),answer={result:entries[0][1],...Object.fromEntries(entries.slice(1))};
  if(p.missingDays>0)answer.coverage=ne?'केही दिनको रेकर्ड छैन। हराएका दिनलाई शून्य मानिएको छैन।':'Some days have no record. Missing days are not treated as zero amounts.';
  return answer;
}
export function standaloneEvidence(f,language) {
  const p=f.period,ne=language==='ne';
  const lines=[`${ne?'समय क्षेत्र':'Store timezone'}: ${f.timezone}; ${ne?'आज':'Today'}: ${f.today}; USD`,standaloneDescription(f.query,language),
    `${ne?'रेकर्ड दिन':'Recorded days'}: ${p.recordedDays}/${p.expectedDays}; ${ne?'रेकर्ड नभएका दिन':'Missing days'}: ${p.missingDays}`,`${ne?'रेकर्ड मिति':'Recorded dates'}: ${p.recordedDates.join(', ')||'—'}`];
  const fields=[...new Set(f.query.fields.map(field=>field==='cash_difference'?'reconciliation':field))];
  for(const field of fields){
    if(field==='reconciliation'){const r=p.reconciliation;
      lines.push(`${fieldLabel(field,language)}: ${ne?'गनिएका दिन':'counted days'} ${r.countedDays}/${p.recordedDays}; ${ne?'नगनिएका दिन':'uncounted days'} ${r.uncountedDays}; ${r.shortageDays} ${ne?'कमी दिन':'shortage days'} (${money(r.totalShortageCents)}); ${r.overageDays} ${ne?'बढी दिन':'overage days'} (${money(r.totalOverageCents)}); ${r.balancedDays} ${ne?'मिलेका दिन':'balanced days'}`);
      lines.push(`${ne?'अपेक्षित अन्तिम नगद':'Expected closing cash'}: ${p.values.closing.valueCents===null?'—':money(p.values.closing.valueCents)} (${p.values.closing.date||'—'})`);
    } else if(field==='card_share'){const v=p.values.card_share;lines.push(`${fieldLabel(field,language)}: ${v.cardCents===null?'—':money(v.cardCents)} / ${v.salesCents===null?'—':money(v.salesCents)} × 100 = ${v.percent===null?'—':v.percent+'%'}`);}
    else {const v=p.values[field],aggregation=v.aggregation==='sum'?(ne?'रेकर्डको योग':'sum of recorded flows'):v.aggregation==='first_recorded_opening'?(ne?'पहिलो रेकर्ड दिनको सुरुवात':'first recorded opening'):v.aggregation==='latest_recorded_closing'?(ne?'अन्तिम रेकर्ड दिनको मौज्दात':'latest recorded closing'):(ne?'पछिल्लो गनिएको नगद':'latest counted snapshot');
      lines.push(`${fieldLabel(field,language)}: ${v.valueCents===null?(ne?'नगनिएको':'Not counted'):money(v.valueCents)} (${aggregation}${v.date?' '+v.date:''})`);
    }
  }
  if(f.query.fields.some(field=>['actual','cash_difference','reconciliation'].includes(field)))for(const r of p.reconciliation.counted)lines.push(`${r.date}: ${ne?'गनिएको':'counted'} ${money(r.actualCents)}, ${ne?'अपेक्षित':'expected'} ${money(r.expectedCents)}, ${ne?'फरक':'difference'} ${money(r.differenceCents)} (${r.differenceCents<0?'Short':r.differenceCents>0?'Over':'Balanced'})`);
  return lines.join('\n\n');
}
