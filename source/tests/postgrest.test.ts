import {test} from 'node:test';
import assert from 'node:assert/strict';
import {postgresStore} from '../supabase/functions/_shared/postgrest.ts';

test('database requests support new secret keys and legacy JWT keys without mixing headers',async(t)=>{
 const requests:{url:string;headers:Headers}[]=[];
 t.mock.method(globalThis,'fetch',async(url:string,init:RequestInit)=>{
  requests.push({url,headers:new Headers(init.headers)});
  return Response.json([]);
 });
 for(const key of ['sb_secret_test-only','legacy-test-jwt']){
  assert.equal(await postgresStore('https://test.supabase.co/',key).read('2026-10-26'),null);
 }
 assert.equal(requests[0].headers.get('apikey'),'sb_secret_test-only');
 assert.equal(requests[0].headers.has('Authorization'),false);
 assert.equal(requests[1].headers.get('Authorization'),'Bearer legacy-test-jwt');
 assert.equal(requests[0].url,'https://test.supabase.co/rest/v1/dorm_nights?date=eq.2026-10-26&select=state,revision&limit=1');
});
