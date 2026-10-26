import type {Store} from '../supabase/functions/_shared/handler.ts';
import type {Night} from '../src/domain.ts';
// Test fixture only. Production uses Postgres, never this in-memory storage.
export function memoryStore():Store{
 const sessions=new Map<string,{name:string;expires_at:string}>(),nights=new Map<string,{state:Night;revision:number}>();
 return {async session(h){return sessions.get(h)||null;},async createSession(h,name,expires_at){sessions.set(h,{name,expires_at});},async deleteSession(h){sessions.delete(h);},async read(d){return structuredClone(nights.get(d)||null);},async save(d,state,expected){if((nights.get(d)?.revision||0)!==expected)return false;nights.set(d,{state:structuredClone(state),revision:expected+1});return true;}};
}
