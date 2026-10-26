import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {request}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const config=JSON.parse(await readFile('public/config.json','utf8'));
const proxy=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;
const http=await request.newContext({...(proxy?{proxy:{server:proxy}}:{}),timeout:30000});
const date='2000-01-02',tokens=[];
async function call(body,token='',status=200,origin='https://yp0067.github.io'){
 const response=await http.post(config.apiUrl,{headers:{Origin:origin,apikey:config.publicKey,'X-Dorm-Session':token},data:body});
 const result=await response.json();assert.equal(response.status(),status,result.error||'Unexpected API status');return result;
}
async function login(name){const p=await call({action:'login',name});tokens.push(p.token);return p.token;}
try{
 const student=await login('刘行'),head=await login('黄睿鑫'),deputy=await login('王诗琪'),monitor=await login('胡运萍');
 const empty=await call({action:'get',date},monitor);assert.equal(empty.revision,0,'Test date is in use; refusing to modify it');
 await call({action:'leave',date,revision:0,data:{start:date+'T18:00',expected:date+'T23:00',reason:'部署验证示例，稍后删除'}},student);
 await call({action:'attendance',date,revision:1,data:{rows:[{name:'刘行',status:'absent'},{name:'杜吉贺',status:'present'},{name:'黄睿鑫',status:'present'}]}},head);
 await call({action:'deputy',date,revision:2,data:{checks:{'刘行':{time:true,reason:true}},note:'部署验证补充备注'}},deputy);
 const verified=await call({action:'final',date,revision:3,data:{name:'刘行',follow:false,note:''}},monitor);
 assert.equal(verified.revision,4);assert.equal(verified.state.attendance['刘行'].status,'absent');assert.equal(verified.state.checks['刘行'].reason,verified.state.leaves['刘行'].reason);assert.equal(verified.state.deputyNote,'部署验证补充备注');
 assert.equal(Object.keys((await call({action:'get',date},student)).state.attendance).length,1);
 assert.deepEqual((await call({action:'get',date},deputy)).state.finals,{});
 await call({action:'leave',date,revision:0,data:{}},student,409);
 await call({action:'final',date,revision:4,data:{name:'刘行',follow:false,note:''}},student,400);
 await call({action:'get',date},monitor,403,'https://untrusted.example');
 const direct=await http.get(config.apiUrl.replace('/functions/v1/night','/rest/v1/dorm_nights?select=date'),{headers:{apikey:config.publicKey}});
 assert.ok([401,403].includes(direct.status()),'Public key must not read the database directly');
 console.log('PASS: real Supabase persistence, four-role writes/reads, permissions, stale-update rejection and public-key database isolation. Test date: '+date);
}finally{
 for(const token of tokens)await call({action:'logout'},token);
 await http.dispose();
}
