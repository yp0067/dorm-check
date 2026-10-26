import {handler} from '../_shared/handler.ts';
import {postgresStore} from '../_shared/postgrest.ts';
const secretKeys=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');
const store=postgresStore(Deno.env.get('SUPABASE_URL')||'',secretKeys.default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'');
const origins=(Deno.env.get('ALLOWED_ORIGIN')||'https://yp0067.github.io').split(',').map(s=>s.trim()).filter(Boolean);
Deno.serve(handler(store,origins));
