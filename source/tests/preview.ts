import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {handler} from '../supabase/functions/_shared/handler.ts';
import {memoryStore} from './memory-store.ts';
const origin='http://127.0.0.1:4180',backend='http://127.0.0.1:4181';
const run=handler(memoryStore(),[origin]);
const api=createServer(async(req,res)=>{
 const chunks:Buffer[]=[];for await(const b of req)chunks.push(b);
 const headers=new Headers();for(const [key,val] of Object.entries(req.headers))if(val)headers.set(key,Array.isArray(val)?val.join(','):val);
 const response=await run(new Request(backend,{method:req.method,headers,body:['GET','HEAD'].includes(req.method||'GET')?undefined:Buffer.concat(chunks)}));
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
});
const site=createServer(async(req,res)=>{
 const pathname=new URL(req.url||'/',origin).pathname;
 if(pathname==='/dorm-test/config.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({apiUrl:backend,publicKey:'local-test-only'}));return;}
 if(!pathname.startsWith('/dorm-test/')){res.writeHead(404);res.end();return;}
 const rel=decodeURIComponent(pathname.slice('/dorm-test/'.length)||'index.html');
 const file=path.resolve('dist',rel),root=path.resolve('dist');
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 try{const body=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'} as Record<string,string>)[path.extname(file)]||'application/octet-stream');res.end(body);}catch{res.writeHead(404);res.end();}
});
await Promise.all([new Promise<void>(r=>api.listen(4181,'127.0.0.1',r)),new Promise<void>(r=>site.listen(4180,'127.0.0.1',r))]);
console.log('Test-only shared server ready: '+origin+'/dorm-test/');
process.on('SIGINT',()=>{site.close();api.close();process.exit(0);});
