import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handler,type Store} from '../supabase/functions/_shared/handler.ts';
import type {Night} from '../src/domain.ts';
export function memoryStore():Store{
 const sessions=new Map<string,{name:string;expires_at:string}>(),nights=new Map<string,{state:Night;revision:number}>();
 return {async session(h){return sessions.get(h)||null;},async createSession(h,name,expires_at){sessions.set(h,{name,expires_at});},async deleteSession(h){sessions.delete(h);},async read(d){return structuredClone(nights.get(d)||null);},async save(d,state,expected){if((nights.get(d)?.revision||0)!==expected)return false;nights.set(d,{state:structuredClone(state),revision:expected+1});return true;}};
}
const origin='https://class.example',date='2026-10-26';
function client(store=memoryStore()){
 const run=handler(store,[origin]);
 return async(body:object,token='',from=origin)=>{const r=await run(new Request('https://example.supabase.co/functions/v1/night',{method:'POST',headers:{Origin:from,'X-Dorm-Session':token},body:JSON.stringify(body)}));return {status:r.status,data:await r.json(),headers:r.headers};};
}
test('allowed origin, identity lookup and scoped shared reads',async()=>{
 const call=client();assert.equal((await call({action:'get',date},'','https://wrong.example')).status,403);
 assert.equal((await call({action:'get',date})).status,401);
 const login=await call({action:'login',name:'刘行'});assert.equal(login.status,200);assert.equal(login.data.person.role,'student');
 const token=login.data.token;
 const saved=await call({action:'leave',date,revision:0,data:{start:date+'T18:00',expected:'2026-10-27T20:00',reason:'回家'}},token);assert.equal(saved.status,200);
 const m=await call({action:'login',name:'胡运萍'});const result=await call({action:'get',date},m.data.token);assert.equal(result.data.state.leaves['刘行'].reason,'回家');
 const forbidden=await call({action:'final',date,revision:1,name:'胡运萍',data:{name:'刘行',follow:true,note:''}},token);assert.equal(forbidden.status,400);
 assert.deepEqual((await call({action:'get',date},token)).data.state.finals,{});
 await call({action:'logout'},token);assert.equal((await call({action:'get',date},token)).status,401);
});
test('concurrent submissions cannot overwrite each other',async()=>{
 const call=client();const a=(await call({action:'login',name:'刘行'})).data.token,b=(await call({action:'login',name:'杜吉贺'})).data.token;
 const data={start:date+'T18:00',expected:'2026-10-27T20:00',reason:'回家'};
 const results=await Promise.all([call({action:'leave',date,revision:0,data},a),call({action:'leave',date,revision:0,data},b)]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('unregistered is not an attendance choice and incomplete room reports fail',async()=>{
 const call=client(),token=(await call({action:'login',name:'黄睿鑫'})).data.token;
 const rows=['刘行','杜吉贺','黄睿鑫'].map(name=>({name,status:'unknown'}));
 assert.equal((await call({action:'attendance',date,revision:0,data:{rows}},token)).status,400);
 rows.forEach(r=>r.status='present');
 assert.equal((await call({action:'attendance',date,revision:0,data:{rows:rows.slice(0,2)}},token)).status,400);
 assert.equal((await call({action:'attendance',date,revision:0,data:{rows}},token)).status,200);
});
test('preflight and database errors remain clear without leaking private data',async()=>{
 const h=handler(memoryStore(),[origin]);const r=await h(new Request('https://example.test',{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);
 const call=client({...memoryStore(),createSession:async()=>{throw Error('SECRET_SHOULD_NOT_LEAK');}});
 const response=await call({action:'login',name:'刘行'});assert.equal(response.status,503);assert.doesNotMatch(JSON.stringify(response),/SECRET_SHOULD_NOT_LEAK/);
});
test('monitor cancellation requires a monitor session and current revision',async()=>{
 const call=client(),student=(await call({action:'login',name:'刘行'})).data.token,monitor=(await call({action:'login',name:'胡运萍'})).data.token;
 await call({action:'leave',date,revision:0,data:{start:date+'T18:00',expected:date+'T23:00',reason:'回家'}},student);
 assert.equal((await call({action:'cancel-leave',date,revision:1,data:{name:'刘行'}},student)).status,400);
 assert.equal((await call({action:'cancel-leave',date,revision:0,data:{name:'刘行'}},monitor)).status,409);
 const result=await call({action:'cancel-leave',date,revision:1,data:{name:'刘行'}},monitor);
 assert.equal(result.status,200);assert.deepEqual(result.data.state.leaves,{});
 assert.equal((await call({action:'get',date},student)).data.state.leaves['刘行'],undefined);
});
