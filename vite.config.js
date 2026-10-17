import { defineConfig, loadEnv } from 'vite';
import { createSummaryHandler } from './server/summary-handler.js';
import { createAskHandler } from './server/ask-handler.js';
export default defineConfig(({mode})=>{
  const fileEnv=loadEnv(mode,process.cwd(),'');
  if(Object.keys({...process.env,...fileEnv}).some(key=>/^VITE_.*(OPENAI|KV_REST_API_TOKEN)/i.test(key)))throw Error('Server AI keys must not have a VITE_ prefix. Remove the public-prefixed secret before building.');
  return {
  plugins:[{name:'local-summary-api',apply:'serve',configureServer(server){
    const env={...process.env,...fileEnv,NODE_ENV:'development'};
    const handler=createSummaryHandler(env);
    const ask=createAskHandler(env);
    server.middlewares.use((req,res,next)=>{const path=req.url?.split('?')[0];return path==='/api/summary'?handler(req,res):path==='/api/ask'?ask(req,res):next();});
  }}],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  };
});
