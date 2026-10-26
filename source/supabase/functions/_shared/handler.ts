import {person} from './roster.ts';
import {blankNight,change,validDate,view,type Night} from './domain.ts';
export interface Store {
 session(hash:string):Promise<{name:string;expires_at:string}|null>;
 createSession(hash:string,name:string,expires:string):Promise<void>;
 deleteSession(hash:string):Promise<void>;
 read(date:string):Promise<{state:Night;revision:number}|null>;
 save(date:string,state:Night,expected:number):Promise<boolean>;
}
async function digest(token:string){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('');}
export function handler(store:Store,allowedOrigins:string[]){return async(req:Request):Promise<Response>=>{
 const origin=req.headers.get('origin')||'';
 const cors:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, x-dorm-session','Access-Control-Max-Age':'600'};
 if(allowedOrigins.includes(origin))cors['Access-Control-Allow-Origin']=origin;
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:cors});
 if(!allowedOrigins.length)return json({error:'后台尚未配置允许访问的网址，请设置 ALLOWED_ORIGIN'},503);
 if(!origin||!allowedOrigins.includes(origin))return json({error:'此网页地址尚未获准连接，请检查后台 ALLOWED_ORIGIN'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return json({error:'不支持的请求方式'},405);
 if(Number(req.headers.get('content-length')||0)>40000)return json({error:'提交内容过大'},413);
 let body:any;
 try{const raw=await req.text();if(raw.length>40000)return json({error:'提交内容过大'},413);body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{return json({error:'请求格式不正确'},400);}
 try{
  // shortcut: the user explicitly chose name-only entry. This selects a role, not verified identity.
  if(body.action==='login'){
   const p=person(typeof body.name==='string'?body.name.trim():'');if(!p)return json({error:'未找到这个姓名，请核对班级名单'},400);
   const token=crypto.randomUUID()+crypto.randomUUID();
   await store.createSession(await digest(token),p.name,new Date(Date.now()+7*86400000).toISOString());
   return json({person:p,token});
  }
  const token=req.headers.get('x-dorm-session')||'';
  if(!/^[a-f0-9-]{72}$/.test(token))return json({error:'请先输入姓名'},401);
  const hash=await digest(token);
  if(body.action==='logout'){await store.deleteSession(hash);return json({ok:true});}
  const session=await store.session(hash);
  const p=session&&Date.parse(session.expires_at)>Date.now()?person(session.name):undefined;
  if(!p)return json({error:'登录已失效，请重新输入姓名'},401);
  if(!validDate(body.date))return json({error:'查寝日期无效'},400);
  const current=await store.read(body.date)||{state:blankNight(),revision:0};
  if(body.action==='get')return json({person:p,state:view(current.state,p),revision:current.revision});
  if(!Number.isInteger(body.revision)||body.revision<0)return json({error:'记录版本无效'},400);
  if(body.revision!==current.revision)return json({error:'有新记录提交，请先刷新，再提交你的修改'},409);
  let next:Night;
  try{next=change(current.state,p,body.action,body.data??{},body.date);}catch(e){return json({error:(e as Error).message},400);}
  if(!await store.save(body.date,next,current.revision))return json({error:'有新记录提交，请先刷新，再提交你的修改'},409);
  return json({person:p,state:view(next,p),revision:current.revision+1});
 }catch{return json({error:'共享数据库暂时无法读写，请检查后台配置或稍后重试；本次修改未确认保存'},503);}
};}
