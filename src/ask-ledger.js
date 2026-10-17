import { money } from './ledger.js';

export function createAskLedgerUI({context,request,doc=globalThis.document}) {
  const form=doc.querySelector('#ask-form'),question=doc.querySelector('#ask-question'),language=doc.querySelector('#ask-language'),button=doc.querySelector('#ask-submit'),status=doc.querySelector('#ask-status'),output=doc.querySelector('#ask-answer'),evidence=doc.querySelector('#ask-evidence');
  let key='',generation=0,controller,pending=false;
  function clear(){generation++;controller?.abort();pending=false;output.textContent='';evidence.textContent='';status.textContent='';}
  function refresh(){
    const c=context(),next=JSON.stringify([c.uid,c.version,c.ready,c.empty,question.value,language.value]);
    if(next!==key){key=next;clear();}
    button.disabled=pending||!c.uid||!c.ready||c.busy||c.empty||c.emulator;
    form.setAttribute('aria-busy',String(pending));
    if(!c.uid)status.textContent='Sign in to ask about your saved ledger.';
    else if(c.emulator)status.textContent='Ask your ledger requires cloud sign-in; emulator accounts do not call AI.';
    else if(!c.ready)status.textContent='Wait for your ledger to load.';
    else if(c.empty)status.textContent='Your ledger has no saved records. Add a daily record first.';
  }
  question.addEventListener('input',refresh);language.addEventListener('change',refresh);
  for(const suggestion of doc.querySelectorAll('[data-ledger-question]'))suggestion.addEventListener('click',()=>{question.value=suggestion.dataset.ledgerQuestion;refresh();question.focus();});
  form.onsubmit=async event=>{
    event.preventDefault();refresh();if(button.disabled)return;
    if(!question.value.trim()){status.textContent='Enter a question or choose a suggestion.';question.focus();return;}
    if([...question.value].length>500){status.textContent='Keep your question within 500 characters.';return;}
    const token=++generation;controller=new AbortController();pending=true;output.textContent='';evidence.textContent='';status.textContent='Reading your saved records and preparing an answer…';refresh();
    try {
      const result=await request({question:question.value.trim(),language:language.value},controller.signal);
      if(token!==generation)return;
      if(typeof result.answer!=='string'||!['answered','empty','unsupported','clarify'].includes(result.status))throw Error('The answer response was incomplete.');
      output.textContent=result.answer;output.lang=result.language;
      status.textContent=result.status==='unsupported'?'This question is outside the supported ledger queries.':result.status==='clarify'?'Please clarify your question.':result.status==='empty'?'No records match this question.':result.cached?'Saved answer reused for the current ledger.':'Answer based on your saved records. Review the evidence below.';
      const f=result.facts;
      if(f){const p=f.current,ne=result.language==='ne';
        const metrics={sales:['Total sales','कुल बिक्री'],compare_sales:['Weekly sales comparison','हप्ताको बिक्री तुलना'],highest_sales:['Highest recorded sales day','उच्च बिक्री भएको रेकर्ड दिन'],cash_differences:['Counted cash differences','गनिएको नगदको फरक'],card_share:['Card share of sales','बिक्रीमा कार्डको हिस्सा'],cash_expenses:['Cash expenses','नगद खर्च']};
        const periods={all:['All records through today','आजसम्मका सबै रेकर्ड'],this_week:['This week','यो हप्ता'],last_week:['Last week','गत हप्ता'],this_month:['This month','यो महिना']};
        const lines=[ne?`समय क्षेत्र: ${f.timezone}। आज: ${f.today}। मुद्रा: USD।`:`Store timezone: ${f.timezone}. Today: ${f.today}. Currency: USD.`,
          `${ne?'बुझिएको प्रश्न':'Question understood as'}: ${metrics[f.query.metric]?.[ne?1:0]||''}; ${periods[f.query.period]?.[ne?1:0]||''}.`,
          `${p.start} → ${p.end} | ${ne?'रेकर्ड दिन':'Recorded days'}: ${p.recordedDays}/${p.expectedDays} | ${ne?'रेकर्ड नभएका दिन':'Missing days'}: ${p.missingDays}`,
          `${ne?'कुल बिक्री':'Total sales'}: ${money(p.salesCents)} | ${ne?'कार्ड':'Card'}: ${money(p.cardCents)} | ${ne?'नगद खर्च':'Cash expenses'}: ${money(p.expensesCents)}`];
        if(f.previous){const b=f.previous;lines.push(`${b.start} → ${b.end} | ${ne?'रेकर्ड दिन':'Recorded days'}: ${b.recordedDays}/${b.expectedDays} | ${ne?'रेकर्ड नभएका दिन':'Missing days'}: ${b.missingDays} | ${ne?'बिक्री':'Sales'}: ${money(b.salesCents)}`);}
        for(const r of p.highest)lines.push(`${r.date}: ${money(r.salesCents)}`);
        for(const r of p.differences)lines.push(`${r.date}: ${ne?'अपेक्षित':'Expected'} ${money(r.expectedCents)}, ${ne?'गनिएको':'counted'} ${money(r.actualCents)}, ${ne?'फरक':'difference'} ${money(r.differenceCents)} (${r.differenceCents<0?(ne?'कमी':'shortage'):(ne?'बढी':'overage')})`);
        evidence.textContent=lines.join('\n');evidence.lang=result.language;
      }
    } catch(error){if(token===generation&&error.name!=='AbortError')status.textContent=error.message;}
    finally{if(token===generation){pending=false;refresh();}}
  };
  refresh();return {refresh};
}
