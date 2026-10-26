import {rolldown} from 'rolldown';
const bundle=await rolldown({input:'supabase/functions/night/index.ts'});
await bundle.write({file:'supabase/粘贴到云函数.js',format:'esm',minify:false});
await bundle.close();
console.log('Created the single-file Supabase function for the Dashboard editor.');
