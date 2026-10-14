export function createAiSummaryUI({context,request,doc=globalThis.document}) {
  const button=doc.querySelector('#generate-summary'),language=doc.querySelector('#ai-language'),status=doc.querySelector('#ai-status'),output=doc.querySelector('#ai-output'),coverage=doc.querySelector('#ai-coverage');
  const cache=new Map();let key='',uid=null,generation=0,controller=null,pending=false;
  function show(result){
    output.textContent=result.summary;
    const f=result.facts;
    coverage.textContent=result.language==='ne'?`यो सारांश ${f.expectedDays} मध्ये ${f.recordedDays} दिनका रेकर्डमा आधारित छ। रेकर्ड नभएका दिन: ${f.missingDays}। ${f.insufficientData?'तुलनाका लागि पर्याप्त दिनको जानकारी छैन। ':''}यसलाई पूर्ण व्यवसायिक लाभको गणना मान्न मिल्दैन।`:`Based on ${f.recordedDays} of ${f.expectedDays} calendar days; ${f.missingDays} days have no record. ${f.insufficientData?'There is insufficient data to compare daily trends. ':''}Sales minus cash expenses is not a complete profit calculation.`;
    status.textContent=result.cached?'Saved AI summary reused.':'AI summary generated. Review it alongside your calculated totals.';
  }
  function refresh(){
    const c=context(),next=JSON.stringify([c.uid,c.version,c.range,language.value||'en']);
    if(uid!==c.uid){cache.clear();uid=c.uid;}
    if(next!==key){key=next;generation++;controller?.abort();pending=false;output.textContent='';coverage.textContent='';status.textContent='';if(cache.has(key))show({...cache.get(key),cached:true});}
    button.disabled=pending||!c.uid||!c.ready||c.busy||c.empty||c.emulator;
    if(!c.uid)status.textContent='Sign in to generate an AI summary. The calculated summary is always available.';
    else if(c.emulator)status.textContent='AI summaries require cloud sign-in. Emulator mode keeps the calculated summary available.';
    else if(!c.ready)status.textContent='Load your ledger before generating an AI summary.';
    else if(c.empty)status.textContent='No records in this range. Change the filter or add a daily record.';
  }
  language.onchange=()=>refresh();
  button.onclick=async()=>{
    refresh();if(button.disabled)return;
    if(cache.has(key)){show({...cache.get(key),cached:true});return;}
    const current=key,token=++generation,c=context();pending=true;controller=new AbortController();
    status.textContent='Generating AI summary…';refresh();
    try{
      const result=await request({...c.range,language:language.value||'en'},controller.signal);
      if(token!==generation||key!==current)return;
      if(typeof result.summary!=='string'||!result.facts)throw Error('The summary response was incomplete.');
      if(cache.size>=20)cache.delete(cache.keys().next().value);cache.set(key,result);show(result);
    }catch(error){if(token===generation&&error.name!=='AbortError'){output.textContent='';coverage.textContent='';const fallback='Your calculated summary is still available.';status.textContent=error.message.includes(fallback)?error.message:error.message+' '+fallback;}}
    finally{if(token===generation){pending=false;refresh();}}
  };
  return {refresh};
}
