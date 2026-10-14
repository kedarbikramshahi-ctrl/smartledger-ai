import { createHash } from 'node:crypto';
import { parseSummaryRequest, summaryFacts, validateModelSummary } from './summary-facts.js';
import { ServiceError, createSummaryStore } from './summary-store.js';
import { verifyFirebaseIdentity, loadCloudLedger, requestModelSummary } from './summary-services.js';
const hash=value=>createHash('sha256').update(value).digest('hex');
export function createSummaryHandler(env,dependencies={}){
  let store=dependencies.store;
  return async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
    if(req.method!=='POST'){res.setHeader('Allow','POST');return reply(405,{error:'Use POST to generate a summary.'});}
    let lock,key;
    try{
      const project=env.VITE_FIREBASE_PROJECT_ID;
      if(!project||project.startsWith('demo-'))throw new ServiceError(503,'AI summaries require cloud Firebase configuration.');
      const token=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];
      if(!token||token.length>8192)throw new ServiceError(401,'Sign in to generate a summary.');
      const uid=await(dependencies.verifyIdentity||verifyFirebaseIdentity)(token,project);
      let body=req.body;
      if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>2048)throw new ServiceError(413,'Summary request is too large.');}body=JSON.parse(raw);}
      if(typeof body==='string')body=JSON.parse(body);
      if(Buffer.byteLength(JSON.stringify(body)||'')>2048)throw new ServiceError(413,'Summary request is too large.');
      let range;try{range=parseSummaryRequest(body);}catch{throw new ServiceError(400,'Choose a valid date range and language.');}
      if(!env.OPENAI_API_KEY)throw new ServiceError(503,'AI summaries are not configured yet. Your calculated summary is still available.');
      store ||= createSummaryStore(env);const userHash=hash(uid);await store.readLimit(userHash);
      const ledger=await(dependencies.loadLedger||loadCloudLedger)(uid,token,project,range);
      const facts=summaryFacts(ledger.records,range);
      if(!facts)throw new ServiceError(422,'No recorded days in this range. Add records or change the range.');
      key='sl:summary:'+userHash+':'+hash(JSON.stringify({facts,version:ledger.version,language:range.language,model:env.OPENAI_MODEL||'gpt-6-luna',promptVersion:1}));
      const cached=await store.get(key);if(cached)return reply(200,{...JSON.parse(cached),cached:true});
      lock=await store.acquire(userHash,key);
      const template=await(dependencies.generate||requestModelSummary)(facts,range.language,env);
      let summary;try{summary=validateModelSummary(template,facts);}catch{throw new ServiceError(502,'The generated summary could not be verified. Your calculated summary is still available.');}
      const result={summary,facts,language:range.language,model:env.OPENAI_MODEL||'gpt-6-luna',createdAt:new Date().toISOString(),cached:false};
      await store.put(key,JSON.stringify(result));return reply(200,result);
    }catch(error){const status=error instanceof ServiceError?error.status:error instanceof SyntaxError?400:503;return reply(status,{error:error instanceof ServiceError?error.message:status===400?'Invalid request JSON.':'Summary generation failed. Your calculated summary is still available.'});}
    finally{if(lock&&key)try{await store.release(key,lock);}catch{/* The lease expires automatically. */}}
  };
}
