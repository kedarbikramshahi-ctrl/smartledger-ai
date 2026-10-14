import { defineConfig, loadEnv } from 'vite';
import { createSummaryHandler } from './server/summary-handler.js';
export default defineConfig(({mode})=>{
  const fileEnv=loadEnv(mode,process.cwd(),'');
  if(Object.keys({...process.env,...fileEnv}).some(key=>/^VITE_.*(OPENAI|KV_REST_API_TOKEN)/i.test(key)))throw Error('Server AI keys must not have a VITE_ prefix. Remove the public-prefixed secret before building.');
  return {
  plugins:[{name:'local-summary-api',apply:'serve',configureServer(server){
    const env={...process.env,...fileEnv,NODE_ENV:'development'};
    const handler=createSummaryHandler(env);
    server.middlewares.use((req,res,next)=>req.url?.split('?')[0]==='/api/summary'?handler(req,res):next());
  }}],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  };
});
