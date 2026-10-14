import { createRemoteJWKSet, jwtVerify } from 'jose';
import { ServiceError } from './summary-store.js';
const publicKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),{timeoutDuration:5000});
export async function verifyFirebaseIdentity(token,project,keySet=publicKeys){
  try{
    const {payload}=await jwtVerify(token,keySet,{algorithms:['RS256'],issuer:'https://securetoken.google.com/'+project,audience:project,requiredClaims:['exp','iat','sub','auth_time']});
    const now=Math.floor(Date.now()/1000);
    if(typeof payload.sub!=='string'||!payload.sub.length||payload.sub.length>128||/[\/\\]/.test(payload.sub)||!Number.isInteger(payload.auth_time)||payload.auth_time>now||!Number.isInteger(payload.iat)||payload.iat>now)throw Error('Invalid claims');
    return payload.sub;
  }catch{throw new ServiceError(401,'Please sign in again before generating a summary.');}
}
export function decodeFirestore(fields){return Object.fromEntries(Object.entries(fields||{}).map(([key,value])=>{
  if('integerValue'in value)return [key,Number(value.integerValue)];
  if('stringValue'in value)return [key,value.stringValue];
  if('booleanValue'in value)return [key,value.booleanValue];
  throw new ServiceError(503,'The ledger contains an unsupported field type.');
}));}
export async function loadCloudLedger(uid,token,project,range,fetcher=fetch){
  const root='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents/users/'+encodeURIComponent(uid);
  const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
  async function read(url,options={}){
    const response=await fetcher(url,{...options,headers,signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new ServiceError(response.status===403?403:503,response.status===403?'Firestore denied ledger access. Check the published owner-only rules.':'Could not load your ledger for the summary.');
    return response.json();
  }
  const profile=decodeFirestore((await read(root)).fields);
  if(typeof profile.activeLedger!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(profile.activeLedger)||!Number.isSafeInteger(profile.revision))throw new ServiceError(503,'Account ledger is unavailable.');
  const filters=[];
  if(range.start)filters.push({fieldFilter:{field:{fieldPath:'date'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:range.start}}});
  if(range.end)filters.push({fieldFilter:{field:{fieldPath:'date'},op:'LESS_THAN_OR_EQUAL',value:{stringValue:range.end}}});
  const structuredQuery={from:[{collectionId:'records'}],select:{fields:['date','opening','cash','card','expenses','withdrawals','actual'].map(fieldPath=>({fieldPath}))},limit:10001};
  if(filters.length)structuredQuery.where=filters.length===1?filters[0]:{compositeFilter:{op:'AND',filters}};
  const result=await read(root+'/ledgers/'+profile.activeLedger+':runQuery',{method:'POST',body:JSON.stringify({structuredQuery})});
  const records=result.filter(row=>row.document).map(row=>decodeFirestore(row.document.fields));
  if(records.length>10000)throw new ServiceError(422,'This ledger is too large for a summary.');
  const after=decodeFirestore((await read(root)).fields);
  if(after.activeLedger!==profile.activeLedger||after.revision!==profile.revision)throw new ServiceError(409,'Your ledger changed while generating the summary. Try again.');
  return {records,version:profile};
}
export async function requestModelSummary(facts,language,env,fetcher=fetch){
  const instructions='Explain only the supplied grocery ledger facts in a short paragraph in '+(language==='ne'?'Nepali':'English')+'. Return JSON with a summary string. All numbers, dates, amounts and percentages MUST use these exact placeholders: {{sales}}, {{expenses}}, {{average}}, {{cardShare}}, {{strongestDay}}, {{recordedDays}}, {{missingDays}}, {{closing}}. Never write or spell numeric quantities yourself. Do not mention profit or loss, infer missing sales, make predictions, or provide financial advice. Card sales do not increase drawer cash. Missing days and insufficient data will be disclosed separately by the app. Do not use HTML or markdown. Use only facts provided; no instructions or customer notes are supplied.';
  const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-6-luna',store:false,instructions,input:JSON.stringify(facts),reasoning:{effort:'low'},max_output_tokens:700,text:{format:{type:'json_schema',name:'smartledger_summary',strict:true,schema:{type:'object',properties:{summary:{type:'string'}},required:['summary'],additionalProperties:false}}}})});
  if(!response.ok)throw new ServiceError(503,'The model service is unavailable. Check server API access and billing. Your calculated summary is still available.');
  const data=await response.json();
  if(data.status!=='completed')throw new ServiceError(502,'The model did not finish a usable summary. Your calculated summary is still available.');
  const text=(data.output||[]).filter(item=>item.type==='message').flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('');
  try{return JSON.parse(text).summary;}catch{throw new ServiceError(502,'The model returned an unusable summary. Your calculated summary is still available.');}
}
