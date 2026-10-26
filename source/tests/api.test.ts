import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request} from '../src/api.ts';

test('name entry works in browsers without AbortSignal.timeout and explains failed reads accurately',async(t)=>{
 const timeoutDescriptor=Object.getOwnPropertyDescriptor(AbortSignal,'timeout')!;
 const docDescriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
 const storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const saved=new Map<string,string>();let fail=false;
 Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
 Object.defineProperty(globalThis,'document',{value:{baseURI:'https://yp0067.github.io/dorm-check/'},configurable:true});
 Object.defineProperty(globalThis,'localStorage',{value:{getItem:(key:string)=>saved.get(key)||null,setItem:(key:string,value:string)=>saved.set(key,value),removeItem:(key:string)=>saved.delete(key)},configurable:true});
 t.after(()=>{
  Object.defineProperty(AbortSignal,'timeout',timeoutDescriptor);
  if(docDescriptor)Object.defineProperty(globalThis,'document',docDescriptor);else Reflect.deleteProperty(globalThis,'document');
  if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else Reflect.deleteProperty(globalThis,'localStorage');
 });
 t.mock.method(globalThis,'fetch',async(url:URL|string,init?:RequestInit)=>{
  if(String(url).endsWith('config.json'))return Response.json({apiUrl:'https://example.supabase.co/functions/v1/night',publicKey:'sb_publishable_test'});
  if(fail)throw new TypeError('Failed to fetch');
  assert.ok(init?.signal instanceof AbortSignal);
  return Response.json({token:'test-session'});
 });
 assert.equal((await request({action:'login',name:'刘行'})).status,200);
 assert.equal(saved.get('guinqin-session'),'test-session');
 fail=true;
 await assert.rejects(request({action:'get',date:'2026-10-26'}),error=>{
  assert.match((error as Error).message,/连接/);
  assert.doesNotMatch((error as Error).message,/填写尚未提交/);return true;
 });
});
