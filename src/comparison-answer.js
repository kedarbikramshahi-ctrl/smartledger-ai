import { money } from './ledger.js';

export const FIELD_LABELS={opening:['Opening cash','सुरुको नगद'],cash:['Cash sales','नगद बिक्री'],card:['Card sales','कार्ड बिक्री'],expenses:['Cash expenses','नगद खर्च'],withdrawals:['Withdrawals','झिकिएको नगद'],closing:['Expected closing cash','अपेक्षित अन्तिम नगद'],actual:['Actual cash counted','गनिएको वास्तविक नगद'],cash_difference:['Cash difference','नगद फरक'],total_sales:['Total sales','कुल बिक्री'],card_share:['Card share','कार्डको हिस्सा'],reconciliation:['Reconciliation statuses','नगद मिलान स्थिति']};
export const fieldLabel=(field,language)=>FIELD_LABELS[field]?.[language==='ne'?1:0]||'';
export const conciseMoney=value=>money(value).replace(/\.00\b/,'');
export function dateName(date,language,year=false){return new Intl.DateTimeFormat(language==='ne'?'ne-NP':'en-US',{timeZone:'UTC',month:'long',day:'numeric',...(year?{year:'numeric'}:{})}).format(new Date(date+'T00:00:00Z'));}
export function periodName(p,language,year=false){return p.start===p.end?dateName(p.start,language,year):dateName(p.start,language,year)+'–'+dateName(p.end,language,year);}

// Adapt already-calculated weekly facts for display. No financial totals/percentages are recomputed.
export function comparisonPresentation(f) {
  if(f.query.metric!=='compare_sales')return f;
  const periods=[f.previous,f.current].map(p=>({...p,values:{total_sales:{aggregation:'sum',valueCents:p.recordedDays?p.salesCents:null}}}));
  return {timezone:f.timezone,today:f.today,partialWeek:f.partialWeek,query:{periods:periods.map(p=>({start:p.start,end:p.end})),fields:['total_sales']},periods,
    changes:{total_sales:{aggregation:'sum',changeCents:f.changeCents,changePercent:f.changePercent,higher:f.changeCents===null?null:f.changeCents>0?'B':f.changeCents<0?'A':'equal'}}};
}

// Conclusions only: detailed coverage, operands and snapshot evidence have a separate formatter.
export function comparisonSentences(facts,language) {
  const f=comparisonPresentation(facts),ne=language==='ne',[a,b]=f.periods;
  const year=f.periods.some(p=>p.start.slice(0,4)!==f.today.slice(0,4)||p.end.slice(0,4)!==f.today.slice(0,4));
  const names=f.periods.map(p=>periodName(p,language,year)),sentences={};
  for(const field of f.query.fields){
    const change=f.changes[field],label=fieldLabel(field,language);let text;
    if(['cash_difference','reconciliation'].includes(field)){
      if(Object.hasOwn(sentences,'reconciliation'))continue;
      const missing=f.periods.filter(p=>!p.reconciliation.countedDays);
      if(f.periods.every(p=>p.start===p.end)){
        text=f.periods.map((p,i)=>{
          if(!p.recordedDays)return ne?`${names[i]} को लेजर रेकर्ड छैन।`:`${names[i]} has no ledger record.`;
          const counted=p.reconciliation.counted.find(r=>r.date===p.start);
          if(!counted||counted.actualCents===undefined)return ne?`${names[i]} मा नगद गनिएको थिएन।`:`${names[i]} was not counted.`;
          if(counted.actualCents===counted.expectedCents)return ne?`${names[i]} मा नगद मिलेको थियो।`:`${names[i]} was balanced.`;
          return counted.differenceCents<0?(ne?`${names[i]} मा ${conciseMoney(Math.abs(counted.differenceCents))} कम थियो।`:`${names[i]} was short by ${conciseMoney(Math.abs(counted.differenceCents))}.`):(ne?`${names[i]} मा ${conciseMoney(counted.differenceCents)} बढी थियो।`:`${names[i]} was over by ${conciseMoney(counted.differenceCents)}.`);
        }).join(' ');
      }
      else if(missing.length)text=ne?`${missing.map(p=>periodName(p,language,year)).join(' र ')} मा वास्तविक नगद गणना छैन; नगद मिलान तुलना गर्न मिल्दैन।`:`No actual cash counts are available for ${missing.map(p=>periodName(p,language,year)).join(' and ')}; cash reconciliation cannot be compared.`;
      else {
        const ar=a.reconciliation,br=b.reconciliation;
        text=ne?`${names[0]} मा कमी भएका ${ar.shortageDays} दिन र ${names[1]} मा कमी भएका ${br.shortageDays} दिन थिए।`:`${names[0]} had ${ar.shortageDays} shortage ${ar.shortageDays===1?'day':'days'}, and ${names[1]} had ${br.shortageDays} shortage ${br.shortageDays===1?'day':'days'}.`;
        text+=' '+(ne?`${names[0]} र ${names[1]} मा कमी रकम क्रमशः ${conciseMoney(ar.totalShortageCents)} र ${conciseMoney(br.totalShortageCents)}; बढी रकम क्रमशः ${conciseMoney(ar.totalOverageCents)} र ${conciseMoney(br.totalOverageCents)} थियो।`:`Shortages totaled ${conciseMoney(ar.totalShortageCents)} for ${names[0]} and ${conciseMoney(br.totalShortageCents)} for ${names[1]}; overages totaled ${conciseMoney(ar.totalOverageCents)} and ${conciseMoney(br.totalOverageCents)}, respectively.`);
      }
      sentences.reconciliation=text;
    } else if(field==='card_share'){
      const av=a.values.card_share.percent,bv=b.values.card_share.percent;
      sentences[field]=change.percentagePoints===null?(ne?'शून्य बिक्री वा रेकर्ड नभएकाले कार्डको हिस्सा तुलना गर्न मिल्दैन।':'Card share cannot be compared because a period has no recorded sales or zero total sales.'):(ne?`बिक्रीमा कार्डको हिस्सा ${names[0]} मा ${av}% र ${names[1]} मा ${bv}% थियो; फरक ${change.percentagePoints} प्रतिशत बिन्दु हो।`:`Card payments accounted for ${av}% of sales for ${names[0]} and ${bv}% for ${names[1]}, ${change.percentagePoints===0?'with no change':`a ${Math.abs(change.percentagePoints)} percentage-point ${change.percentagePoints>0?'increase':'decrease'}`}.`);
    } else {
      const av=a.values[field],bv=b.values[field];
      if(change.changeCents===null){
        const absent=f.periods.filter(p=>p.values[field].valueCents===null).map(p=>periodName(p,language,year));
        text=ne?`${absent.join(' र ')} का लागि ${label} ${field==='actual'?'गनिएको छैन':'रेकर्ड छैन'}; तुलना गर्न मिल्दैन।`:`${label} ${field==='actual'?'was not counted':'has no records'} for ${absent.join(' and ')}; a comparison is unavailable.`;
      } else if(change.aggregation==='sum'){
        const noun=field==='total_sales'?(ne?'बिक्री':'sales'):(ne?label:label.toLowerCase()),subject=field==='total_sales'?'Sales':label;
        if(change.changeCents===0)text=ne?`${names[0]} र ${names[1]} को ${noun} बराबर (${conciseMoney(av.valueCents)}) थियो।`:`${subject} were the same for ${names[0]} and ${names[1]}, at ${conciseMoney(av.valueCents)}.`;
        else {
          const winner=change.higher==='A'?names[0]:names[1],other=change.higher==='A'?names[1]:names[0];
          text=ne?`${winner} मा ${other} भन्दा ${conciseMoney(Math.abs(change.changeCents))} बढी ${noun} थियो।`:`${winner} had ${conciseMoney(Math.abs(change.changeCents))} more in ${noun} than ${other}.`;
          const pct=change.changePercent;
          if(pct===null)text+=' '+(ne?`${names[0]} को आधार रकम शून्य भएकाले प्रतिशत परिवर्तन निकालिएको छैन।`:`No percentage change is calculated because ${names[0]} had a zero baseline.`);
          else if(a.end<b.start)text+=' '+(ne?`${noun} ${Math.abs(pct)}% ले ${change.changeCents>0?'बढ्यो':'घट्यो'}, ${conciseMoney(av.valueCents)} बाट ${conciseMoney(bv.valueCents)} भयो।`:`${subject} ${change.changeCents>0?'increased':'decreased'} by ${Math.abs(pct)}%, from ${conciseMoney(av.valueCents)} to ${conciseMoney(bv.valueCents)}.`);
          else text+=' '+(ne?`${names[1]} को ${noun} ${names[0]} भन्दा ${Math.abs(pct)}% ${change.changeCents>0?'बढी':'कम'} थियो (${conciseMoney(av.valueCents)} को तुलनामा ${conciseMoney(bv.valueCents)})।`:`${subject} for ${names[1]} were ${Math.abs(pct)}% ${change.changeCents>0?'higher':'lower'} than for ${names[0]} (${conciseMoney(bv.valueCents)} versus ${conciseMoney(av.valueCents)}).`);
        }
      } else {
        const dates=[av,bv].map(v=>dateName(v.date,language,year));
        const description=field==='opening'?(ne?'पहिलो रेकर्ड गरिएको सुरुवाती मौज्दात':'First recorded opening balances'):field==='closing'?(ne?'पछिल्लो रेकर्ड गरिएको अपेक्षित अन्तिम मौज्दात':'Latest recorded expected closing balances'):(ne?'पछिल्लो गनिएको वास्तविक नगद':'Latest actual cash counts');
        text=ne?`${description}: ${dates[0]} मा ${conciseMoney(av.valueCents)} र ${dates[1]} मा ${conciseMoney(bv.valueCents)}।`:`${description} were ${conciseMoney(av.valueCents)} on ${dates[0]} and ${conciseMoney(bv.valueCents)} on ${dates[1]}.`;
        text+=' '+(change.changeCents===0?(ne?'मौज्दात बराबर थियो।':'The balances were equal.'):(ne?`${change.higher==='A'?dates[0]:dates[1]} को मौज्दात ${conciseMoney(Math.abs(change.changeCents))} बढी थियो।`:`${change.higher==='A'?dates[0]:dates[1]} had the higher balance by ${conciseMoney(Math.abs(change.changeCents))}.`));
      }
      sentences[field]=text;
    }
  }
  const entries=Object.entries(sentences),answer={result:entries[0][1],...Object.fromEntries(entries.slice(1))};
  if(f.periods.some(p=>p.missingDays>0))answer.coverage=ne?'केही दिनका रेकर्ड छैनन्। हराएका दिनलाई शून्य बिक्री मानिएको छैन; अपूर्ण रेकर्डले वास्तविक व्यापार परिवर्तन प्रमाणित गर्दैन।':'Some days have no record. Missing days are not treated as zero sales; incomplete records do not establish the actual business change.';
  return answer;
}
