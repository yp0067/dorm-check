import type {Store} from './handler.ts';
export function postgresStore(url:string,secret:string):Store{
 async function api(path:string,method='GET',body?:unknown){
  if(!url||!secret)throw Error('Server database credentials unavailable');
  const headers:Record<string,string>={apikey:secret,'Content-Type':'application/json'};
  if(!secret.startsWith('sb_secret_'))headers.Authorization='Bearer '+secret;
  const result=await fetch(url.replace(/\/$/,'')+'/rest/v1/'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!result.ok)throw Error('Database request failed');
  if(result.status===204)return null;
  const text=await result.text();return text?JSON.parse(text):null;
 }
 return {
  async session(hash){return (await api('dorm_sessions?token_hash=eq.'+hash+'&select=name,expires_at&limit=1'))[0]||null;},
  async createSession(hash,name,expires){await api('dorm_sessions','POST',{token_hash:hash,name,expires_at:expires});},
  async deleteSession(hash){await api('dorm_sessions?token_hash=eq.'+hash,'DELETE');},
  async read(date){return (await api('dorm_nights?date=eq.'+encodeURIComponent(date)+'&select=state,revision&limit=1'))[0]||null;},
  async save(date,state,expected){return await api('rpc/dorm_save_night','POST',{p_date:date,p_state:state,p_expected:expected})===true;}
 };
}
