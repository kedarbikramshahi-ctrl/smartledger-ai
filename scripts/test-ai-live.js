import { loadEnv } from 'vite';
import { summaryFacts, validateModelSummary } from '../server/summary-facts.js';
import { requestModelSummary } from '../server/summary-services.js';
if(!process.argv.includes('--confirm')){
  console.error('This opt-in test makes two billable API calls using fictional facts. Run npm run test:ai-live -- --confirm.');process.exit(1);
}
const env={...process.env,...loadEnv('development',process.cwd(),'')};
if(!env.OPENAI_API_KEY){console.error('Add OPENAI_API_KEY to ignored .env.local first. No key was displayed.');process.exit(1);}
const records=[{date:'2026-01-01',opening:20000,cash:32000,card:18000,expenses:4000,withdrawals:10000},{date:'2026-01-03',opening:20000,cash:41000,card:25000,expenses:9000,withdrawals:10000}];
const facts=summaryFacts(records,{start:'2026-01-01',end:'2026-01-03'});
try{
  for(const language of ['en','ne']){
    const template=await requestModelSummary(facts,language,env);
    const summary=validateModelSummary(template,facts);
    console.log(language+': real model response passed fact-slot checks.');
    console.log(summary);
  }
  console.log('Review both outputs for language quality. This verifies model access, not the complete authenticated cloud endpoint.');
}catch(error){console.error(error.message);process.exitCode=1;}
