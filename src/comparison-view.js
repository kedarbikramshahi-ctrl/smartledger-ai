import { money } from './ledger.js';
import { fieldLabel, comparisonPresentation } from './comparison-answer.js';
export { FIELD_LABELS, fieldLabel, comparisonPresentation, comparisonSentences } from './comparison-answer.js';

const amount=(value,ne)=>value===null?(ne?'रेकर्ड छैन':'No records'):money(value);
export function comparisonDescription(query,language='en') {
  return query.periods.map(p=>p.start===p.end?p.start:`${p.start} → ${p.end}`).join(' vs ')+' | '+query.fields.map(f=>fieldLabel(f,language)).join(', ');
}
function comparisonDetails(f,language) {
  const ne=language==='ne',[a,b]=f.periods;
  const result=ne?`तुलना: ${comparisonDescription(f.query,language)}। फरक B − A हो।`:`Comparison: ${comparisonDescription(f.query,language)}. Changes are B minus A.`;
  const coverage=f.periods.map((p,i)=>`${i?'B':'A'} ${p.start} → ${p.end}: ${p.recordedDays}/${p.expectedDays} ${ne?'दिनको रेकर्ड; रेकर्ड नभएका दिन':'days recorded; missing days'}: ${p.missingDays}`).join('; ');
  const sentences={result,coverage:coverage+'.'};
  if(a.expectedDays!==b.expectedDays)sentences.coverage+=' '+(ne?'अवधिको लम्बाइ फरक छ; योगहरू दैनिक औसत होइनन्।':'The periods have different lengths; totals are not daily averages.');
  if(a.start<=b.end&&b.start<=a.end)sentences.coverage+=' '+(ne?'अवधिहरू खप्टिएका छन्; एउटै मिति दुवैमा पर्न सक्छ।':'The periods overlap; a recorded date can contribute to both.');
  for(const field of f.query.fields){
    const label=fieldLabel(field,language),change=f.changes[field];
    if(['cash_difference','reconciliation'].includes(field)){
      if(sentences.reconciliation)continue;
      sentences.reconciliation=label+': '+f.periods.map((p,i)=>{const r=p.reconciliation;
        return `${i?'B':'A'}: ${ne?'गनिएका दिन':'counted days'} ${r.countedDays}/${p.recordedDays}; ${ne?'नगनिएका रेकर्ड दिन':'uncounted recorded days'} ${r.uncountedDays}; ${ne?'कमी दिन':'shortage days'} ${r.shortageDays} (${money(r.totalShortageCents)}); ${ne?'बढी दिन':'overage days'} ${r.overageDays} (${money(r.totalOverageCents)}); ${ne?'मिलेका दिन':'balanced days'} ${r.balancedDays}. ${!r.countedDays?(ne?'नगद गनिएको रेकर्ड छैन।':'No actual cash counts are available.'):''}`;
      }).join(' ')+(change.shortageDaysChange===null?'':(ne?` कमी दिनको फरक ${change.shortageDaysChange}; कमी रकमको फरक ${money(change.shortageAmountChangeCents)}; बढी दिनको फरक ${change.overageDaysChange}; बढी रकमको फरक ${money(change.overageAmountChangeCents)}।`:` Shortage-day change ${change.shortageDaysChange}; shortage-amount change ${money(change.shortageAmountChangeCents)}; overage-day change ${change.overageDaysChange}; overage-amount change ${money(change.overageAmountChangeCents)}.`))+' '+(ne?'कमी र बढी रकम छुट्टाछुट्टै छन्; कारण थाहा हुँदैन।':'Shortages and overages are separate; causes are unknown.');
    } else if(field==='card_share'){
      sentences[field]=`${label}: `+f.periods.map((p,i)=>{const v=p.values.card_share;return `${i?'B':'A'} ${amount(v.cardCents,ne)} / ${amount(v.salesCents,ne)} = ${v.percent===null?(ne?'प्रतिशत उपलब्ध छैन':'percentage unavailable'):v.percent+'%'}`;}).join('; ')+`. ${change.percentagePoints===null?(ne?'शून्य बिक्री वा रेकर्ड नभएकाले तुलना उपलब्ध छैन।':'Comparison unavailable with zero sales or no records.'):(ne?`फरक ${change.percentagePoints} प्रतिशत बिन्दु।`:`Change ${change.percentagePoints} percentage points.`)}`;
    } else {
      const values=f.periods.map((p,i)=>{const v=p.values[field];
        const aggregation=v.aggregation==='sum'?(ne?`${p.start} देखि ${p.end} का रेकर्डको योग`:`sum of records ${p.start} through ${p.end}`):v.aggregation==='first_recorded_opening'?(ne?`पहिलो रेकर्ड दिनको सुरुवात ${v.date||'—'}`:`first recorded opening on ${v.date||'—'}`):v.aggregation==='latest_recorded_closing'?(ne?`अन्तिम रेकर्ड दिनको मौज्दात ${v.date||'—'}`:`latest recorded closing on ${v.date||'—'}`):(ne?`पछिल्लो गनिएको नगद ${v.date||'—'}`:`latest counted snapshot on ${v.date||'—'}`);
        return `${i?'B':'A'} ${field==='actual'&&v.valueCents===null?(ne?'नगनिएको':'Not counted'):amount(v.valueCents,ne)} (${aggregation})`;
      });
      let explanation=change.changeCents===null?(ne?'तुलनाका लागि आवश्यक रेकर्ड वा नगद गणना छैन।':'Required records or cash counts are missing for a comparison.'):(ne?`फरक ${money(change.changeCents)}; ${change.higher==='equal'?'बराबर':`${change.higher} बढी छ`}।`:`Change ${money(change.changeCents)}; ${change.higher==='equal'?'equal':`${change.higher} is higher`}.`);
      if(change.aggregation==='sum'&&change.changeCents!==null)explanation+=' '+(change.changePercent===null?(ne?'आधार शून्य भएकाले प्रतिशत परिवर्तन छैन।':'No percentage change because A is zero.'):(ne?`परिवर्तन ${change.changePercent}%।`:`Change ${change.changePercent}%.`));
      if(change.aggregation!=='sum')explanation+=' '+(ne?'यो मौज्दातको तुलना हो, नगद प्रवाहको योग होइन।':'This compares balance snapshots, not a sum of available cash.');
      if(field==='actual')explanation+=' '+(ne?'सबै गनिएका मितिहरू प्रमाणमा छन्। नगनिएको र शून्य छुट्टै हुन्।':'Every counted date is listed in the evidence. Missing counts and entered zero are distinct.');
      sentences[field]=`${label}: ${values.join('; ')}. ${explanation}`;
    }
  }
  return sentences;
}
export function comparisonEvidence(facts,language) {
  const f=comparisonPresentation(facts),ne=language==='ne',sentences=comparisonDetails(f,language);
  const lines=[`${ne?'समय क्षेत्र':'Store timezone'}: ${f.timezone}; ${ne?'आज':'Today'}: ${f.today}; USD`,...Object.values(sentences)];
  if(f.partialWeek)lines.push(ne?'समान बितेका बारहरूको आंशिक हप्ता तुलना।':'Partial-week comparison using equivalent elapsed weekdays.');
  for(const [i,p] of f.periods.entries()){
    if(p.recordedDates)lines.push(`${i?'B':'A'} ${ne?'प्रयोग गरिएका रेकर्ड मिति':'Recorded dates used'}: ${p.recordedDates.join(', ')||'—'}`);
    if(f.query.fields.some(field=>['actual','cash_difference','reconciliation'].includes(field))){
      lines.push(`${i?'B':'A'} ${ne?'गनिएका मिति':'Counted dates'}: ${p.reconciliation.counted.map(r=>r.date).join(', ')||'—'}`);
      for(const r of p.reconciliation.counted)lines.push(`${r.date}: ${ne?'गनिएको':'counted'} ${money(r.actualCents)}, ${ne?'अपेक्षित':'expected'} ${money(r.expectedCents)}, ${ne?'फरक':'difference'} ${money(r.differenceCents)} (${r.differenceCents<0?(ne?'कमी':'Short'):r.differenceCents>0?(ne?'बढी':'Over'):(ne?'मिलेको':'Balanced')})`);
    }
  }
  return lines.join('\n\n');
}
