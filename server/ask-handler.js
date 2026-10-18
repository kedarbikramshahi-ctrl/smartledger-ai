import { standaloneFacts, isComparisonFollowUp } from './standalone.js';
import { standaloneSentences } from '../src/standalone-answer.js';
import { createHash, randomUUID } from 'node:crypto';
import { parseAskRequest, validateQuery, storeCalendar, askFacts, answerSentences, validateExplanation } from './ask-facts.js';
import { ServiceError, createSummaryStore } from './summary-store.js';
import { verifyFirebaseIdentity, loadCloudLedger } from './summary-services.js';
import { interpretQuestion, explainFacts } from './ask-services.js';
import { resolveComparison, comparisonFacts, validateDateRange, validatePeriods, validateFields, relativePeriods } from './comparison.js';
import { comparisonSentences } from '../src/comparison-view.js';
import { askLimitResponse } from './ask-limits.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function limitationAnswer(reason,language) {
  const messages={periods:['Which date or date range do you mean? For a comparison, specify both periods through today.','कुन दुई मिति वा अवधिको तुलना गर्ने? कृपया आजसम्मका मितिहरू दिनुहोस्।'],fields:['Which ledger fields would you like to compare?','लेजरका कुन विवरणहरू तुलना गर्ने?'],context:['Which two periods do you mean? Start a comparison with both date ranges.','कुन दुई अवधि भन्नुभएको हो? दुवै अवधि दिएर तुलना सुरु गर्नुहोस्।'],calendar:['Please specify unambiguous Gregorian dates, including the year if needed.','कृपया स्पष्ट ग्रेगोरियन मिति दिनुहोस्; आवश्यक भए वर्ष पनि लेख्नुहोस्।'],missing_data:['The ledger contains daily amounts and cash counts, not causes, profit, inventory, individual transactions or notes analysis.','लेजरमा दैनिक रकम र नगद गणना छन्; कारण, नाफा, मौज्दात, व्यक्तिगत कारोबार वा नोट विश्लेषण उपलब्ध छैन।'],unsupported:['I can compare saved ledger amounts and reconciliation. Record changes and unrelated requests are unsupported.','सुरक्षित लेजर रकम र नगद मिलान तुलना गर्न सकिन्छ। रेकर्ड परिवर्तन र असम्बन्धित अनुरोध समर्थित छैनन्।']};
  return (messages[reason]||messages.periods)[language==='ne'?1:0];
}
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
      const followUp=isComparisonFollowUp(request.question);
      let active=null;
      if(request.questionContext){
        const saved=await store.get('sl:question-context:'+owner+':'+request.questionContext);
        if(saved)try{const c=JSON.parse(saved);if(c.timezone!==calendar.timezone||!['ledger','compare'].includes(c.kind))throw Error('Invalid context');active={kind:c.kind,periods:c.kind==='compare'?validatePeriods(c.periods,calendar.today):[validateDateRange(c.periods?.length===1?c.periods[0]:null,calendar.today)],fields:validateFields(c.fields)};}catch{/* Expired or invalid context cannot supply a topic. */}
      }
      let confirmed=null;
      if(request.comparisonContext&&followUp){
        const saved=await store.get('sl:comparison-context:'+owner+':'+request.comparisonContext);
        if(!saved)return reply(200,{status:'clarify',language:request.language,answer:limitationAnswer('context',request.language),clearComparisonContext:true,timezone:calendar.timezone});
        try{const c=JSON.parse(saved);if(c.timezone!==calendar.timezone)throw Error('Timezone changed');confirmed={periods:validatePeriods(c.periods,calendar.today),fields:validateFields(c.fields)};}catch{return reply(200,{status:'clarify',language:request.language,answer:limitationAnswer('context',request.language),clearComparisonContext:true,timezone:calendar.timezone});}
      }
      const ledger=await(dependencies.loadLedger||loadCloudLedger)(uid,token,project,{});
      key='sl:ask:'+owner+':'+hash(JSON.stringify({question:request.question,language:request.language,confirmed,active,version:ledger.version,calendar,model:env.OPENAI_MODEL||'gpt-6-luna',promptVersion:6}));
      const cached=await store.get(key);if(cached)return reply(200,{...JSON.parse(cached),cached:true});
      // Covers both model stages, unsupported questions, failures and retries.
      lock=await store.acquire(owner,key);
      let query;try{query=validateQuery(await(dependencies.interpret||interpretQuestion)(request.question,env,undefined,{today:calendar.today,timezone:calendar.timezone,relativePeriods:relativePeriods(calendar),comparison:confirmed,activeQuestion:active}));}catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError(502,'The interpreted question could not be verified. Try a suggested question.');}
      if(query.metric==='compare'){
        try{query=resolveComparison(query,confirmed,calendar);}catch{query={metric:'clarify',period:'all',reason:'periods'};}
      }
      if(query.metric==='ledger'&&query.period===null&&query.periods[0].end>calendar.today)query={metric:'clarify',period:'all',reason:'periods'};
      let result;
      if(['unsupported','clarify'].includes(query.metric)) {
        result={status:query.metric,language:request.language,answer:limitationAnswer(query.reason&&query.reason!=='none'?query.reason:(query.metric==='clarify'?'periods':'unsupported'),request.language),timezone:calendar.timezone};
      } else {
        const standalone=query.metric==='ledger';
        const custom=query.metric==='compare';
        const comparison=custom||query.metric==='compare_sales';
        const facts=standalone?standaloneFacts(ledger.records,query,calendar):custom?comparisonFacts(ledger.records,query,calendar):askFacts(ledger.records,query,calendar),sentences=standalone?standaloneSentences(facts,request.language):comparison?comparisonSentences(facts,request.language):answerSentences(facts,request.language);
        let answer;
        try{answer=validateExplanation(await(dependencies.explain||explainFacts)(facts,sentences,request.language,env),sentences,{leadWithResult:comparison||standalone});}catch(error){if(error instanceof ServiceError)throw error;throw new ServiceError(502,'The answer could not be verified. Try again later.');}
        result={status:(standalone?facts.period.recordedDays:custom?facts.periods.some(p=>p.recordedDays):facts.current.recordedDays)?'answered':'empty',language:request.language,answer,facts,timezone:calendar.timezone};
        if(standalone){result.activeQuestion={kind:'ledger',periods:facts.query.periods,fields:query.fields};result.clearComparisonContext=true;}
        if(custom||query.metric==='compare_sales'){
          const comparison=custom?{periods:query.periods,fields:query.fields}:{periods:[{start:facts.previous.start,end:facts.previous.end},{start:facts.current.start,end:facts.current.end}],fields:['total_sales']};
          const reference=randomUUID();
          await store.put('sl:comparison-context:'+owner+':'+reference,JSON.stringify({...comparison,timezone:calendar.timezone}));
          result.comparisonContext=reference;result.confirmedComparison=comparison;result.activeQuestion={kind:"compare",...comparison};
        }
      }
      if(!followUp&&!result.comparisonContext)result.clearComparisonContext=true;
      if(result.activeQuestion){
        const reference=randomUUID();
        await store.put('sl:question-context:'+owner+':'+reference,JSON.stringify({...result.activeQuestion,timezone:calendar.timezone}));
        result.questionContext=reference;
      }
      result={...result,cached:false,createdAt:new Date().toISOString()};
      await store.put(key,JSON.stringify(result));return reply(200,result);
    } catch(error) {
      const status=error instanceof ServiceError?error.status:error instanceof SyntaxError?400:503;
      if(status===429&&error.rateLimit){
        const result=askLimitResponse(error.rateLimit);
        res.setHeader('Retry-After',String(result.retryAfterSeconds));
        return reply(429,result);
      }
      return reply(status,{error:error instanceof ServiceError?error.message:status===400?'Invalid request JSON.':'Could not answer your ledger question. Try again later.'});
    } finally {if(key&&lock)try{await store.release(key,lock);}catch{/* Lease expires automatically. */}}
  };
}
