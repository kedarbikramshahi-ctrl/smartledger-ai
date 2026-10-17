import { randomUUID } from 'node:crypto';

export class ServiceError extends Error { constructor(status,message){super(message);this.status=status;} }
export function createMemoryStore(now=()=>Date.now()) {
  const values=new Map();
  function get(key){const entry=values.get(key);if(!entry||entry.expires<=now()){values.delete(key);return null;}return entry.value;}
  function set(key,value,seconds){for(const [k,v]of values)if(v.expires<=now())values.delete(k);if(values.size>2000)throw new ServiceError(503,'Local summary cache is full.');values.set(key,{value,expires:now()+seconds*1000});}
  return {async get(key){return get(key);},async put(key,value){set(key,value,86400);},async readLimit(uid){const key='read:'+uid+':'+Math.floor(now()/3600000),count=get(key)||0;if(count>=300)throw new ServiceError(429,'Too many summary requests. Try again later.');set(key,count+1,3600);},async acquire(uid,key){
    const day=Math.floor(now()/86400000),minute=Math.floor(now()/60000),checks=[['user:'+uid+':'+day,20,86400],['global:'+day,200,86400],['minute:'+uid+':'+minute,2,60]];
    if(get('lock:'+key))throw new ServiceError(429,'This summary is already being generated. Try again shortly.');
    for(const [k,max]of checks)if((get(k)||0)>=max)throw new ServiceError(429,'Summary request limit reached. Try again later.');
    for(const [k,,ttl]of checks)set(k,(get(k)||0)+1,ttl);
    const lock=randomUUID();set('lock:'+key,lock,60);return lock;
  },async release(key,lock){if(get('lock:'+key)===lock)values.delete('lock:'+key);}};
}
export function createRedisStore(env,fetcher=fetch,now=()=>Date.now()) {
  async function command(args){
    try{
      const response=await fetcher(env.KV_REST_API_URL,{method:'POST',headers:{Authorization:'Bearer '+env.KV_REST_API_TOKEN,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000)});
      if(!response.ok)throw Error('Store unavailable');const data=await response.json();if(data.error)throw Error('Store error');return data.result;
    }catch{throw new ServiceError(503,'Summary cache is unavailable. Your calculated summary is still available.');}
  }
  return {
    get:key=>command(['GET',key]),put:(key,value)=>command(['SET',key,value,'EX',86400]),
    async readLimit(uid){const key='sl:read:'+uid+':'+Math.floor(now()/3600000);const result=await command(['EVAL',"local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=300 then return 0 end; redis.call('INCR',KEYS[1]); redis.call('EXPIRE',KEYS[1],3600); return 1",1,key]);if(result!==1)throw new ServiceError(429,'Too many summary requests. Try again later.');},
    async acquire(uid,key){
      const day=Math.floor(now()/86400000),minute=Math.floor(now()/60000),lock=randomUUID();
      const script="if redis.call('EXISTS',KEYS[4])==1 then return 2 end; for i=1,3 do if tonumber(redis.call('GET',KEYS[i]) or '0')>=tonumber(ARGV[i]) then return 0 end end; for i=1,3 do redis.call('INCR',KEYS[i]); redis.call('EXPIRE',KEYS[i],i==3 and 60 or 86400) end; redis.call('SET',KEYS[4],ARGV[4],'EX',60); return 1";
      const result=await command(['EVAL',script,4,'sl:user:'+uid+':'+day,'sl:global:'+day,'sl:minute:'+uid+':'+minute,'sl:lock:'+key,20,200,2,lock]);
      if(result!==1)throw new ServiceError(429,result===2?'This summary is already being generated. Try again shortly.':'Summary request limit reached. Try again later.');return lock;
    },release:(key,lock)=>command(['EVAL',"if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",1,'sl:lock:'+key,lock]),
  };
}
const sharedStores=new WeakMap();
export function createSummaryStore(env){
  if(sharedStores.has(env))return sharedStores.get(env);
  let store;
  if(env.KV_REST_API_URL?.startsWith('https://')&&env.KV_REST_API_TOKEN)store=createRedisStore(env);
  else if(env.NODE_ENV==='development'&&!env.VERCEL&&env.AI_USE_LOCAL_STORE==='true')store=createMemoryStore();
  if(store){sharedStores.set(env,store);return store;}
  throw new ServiceError(503,'AI summaries need a configured server cache. Your calculated summary is still available.');
}
