import { createHash } from 'node:crypto';
import { parseAskRequest, validateQuery, storeCalendar, askFacts, answerSentences, validateExplanation } from './ask-facts.js';
import { ServiceError, createSummaryStore } from './summary-store.js';
import { verifyFirebaseIdentity, loadCloudLedger } from './summary-services.js';
import { interpretQuestion, explainFacts } from './ask-services.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function createAskHandler(env,dependencies={}) {
  let store=dependencies.store;
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Use POST to ask your ledger.'});}
    let key,lock;
    try {
      const project=env.VITE_FIREBASE_PROJECT_ID;
      if(!project||project.startsWith('demo-'))throw new ServiceError(503,'Ask your ledger requires cloud Firebase sign-in.');
      const token=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];
      if(!token||token.length>8192)throw new ServiceError(401,'Sign in to ask your ledger.');
      const uid=await(dependencies.verifyIdentity||verifyFirebaseIdentity)(token,project);
      store ||= createSummaryStore(env);
      const owner=hash(uid);await store.readLimit(owner);
      let body=req.body;
      if(body===undefined){const chunks=[];let bytes=0;for await(const chunk of req){const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=buffer.length;if(bytes>4096)throw new ServiceError(413,'Question request is too large.');chunks.push(buffer);}body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}
      if(typeof body==='string')body=JSON.parse(body);
      if(Buffer.byteLength(JSON.stringify(body)||'')>4096)throw new ServiceError(413,'Question request is too large.');
      let request;try{request=parseAskRequest(body);}catch(error){throw new ServiceError(400,error.message);}
      if(!env.OPENAI_API_KEY)throw new ServiceError(503,'Ask your ledger is not configured. The calculated dashboard remains available.');
      let calendar;try{calendar=storeCalendar(env.STORE_TIMEZONE||'America/New_York',dependencies.now?.()||new Date());}catch{throw new ServiceError(503,'The server store timezone is invalid.');}
      const ledger=await(dependencies.loadLedger||loadCloudLedger)(uid,token,project,{});
      key='sl:ask:'+owner+':'+hash(JSON.stringify({request,version:ledger.version,calendar,model:env.OPENAI_MODEL||'gpt-6-luna',promptVersion:1}));
      const cached=await store.get(key);if(cached)return reply(200,{...JSON.parse(cached),cached:true});
      // Covers both model stages, unsupported questions, failures and retries.
      lock=await store.acquire(owner,key);
      let query;try{query=validateQuery(await(dependencies.interpret||interpretQuestion)(request.question,env));}catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError(502,'The interpreted question could not be verified. Try a suggested question.');}
      let result;
      if(['unsupported','clarify'].includes(query.metric)) {
        const ne=request.language==='ne';
        result={status:query.metric,language:request.language,answer:ne?'कृपया बिक्री, हप्ताको तुलना, उच्च बिक्री भएको दिन, नगद फरक, कार्ड हिस्सा वा नगद खर्चबारे एउटा स्पष्ट प्रश्न सोध्नुहोस्। सबै रेकर्ड, यो हप्ता, गत हप्ता वा यो महिनामध्ये अवधि छान्नुहोस्। रेकर्ड परिवर्तन, कारण वा नाफासम्बन्धी प्रश्न समर्थित छैनन्।':'Please ask one clear question about sales, weekly comparison, highest recorded sales, counted cash differences, card share, or cash expenses. Choose all records, this week, last week, or this month. Record changes, causes and profit questions are unsupported.',timezone:calendar.timezone};
      } else {
        const facts=askFacts(ledger.records,query,calendar),sentences=answerSentences(facts,request.language);
        let answer;
        try{answer=validateExplanation(await(dependencies.explain||explainFacts)(facts,sentences,request.language,env),sentences);}catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError(502,'The answer could not be verified. Try again later.');}
        result={status:facts.current.recordedDays?'answered':'empty',language:request.language,answer,facts,timezone:calendar.timezone};
      }
      result={...result,cached:false,createdAt:new Date().toISOString()};
      await store.put(key,JSON.stringify(result));return reply(200,result);
    } catch(error) {
      const status=error instanceof ServiceError?error.status:error instanceof SyntaxError?400:503;
      return reply(status,{error:error instanceof ServiceError?error.message:status===400?'Invalid request JSON.':'Could not answer your ledger question. Try again later.'});
    } finally {if(key&&lock)try{await store.release(key,lock);}catch{/* Lease expires automatically. */}}
  };
}
