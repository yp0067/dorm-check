import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';

// Ship the real entry form and its styles in the first response; no database is read at build time.
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {default:App}=await server.ssrLoadModule('/src/App.tsx');
 let html=await readFile('dist/index.html','utf8');
 html=html.replace('<div id="root"></div>','<div id="root">'+renderToString(createElement(App))+'</div>');
 const styles=[...html.matchAll(/<link\b[^>]*href="\.\/(assets\/[^"/]+\.css)"[^>]*>/g)];
 for(const match of styles)html=html.replace(match[0],'<style>'+await readFile('dist/'+match[1],'utf8')+'</style>');
 const config=JSON.parse(await readFile('public/config.json','utf8'));
 if(config.publicKey?.startsWith('sb_secret_'))throw Error('Never embed a secret key');
 const origin=config.apiUrl?new URL(config.apiUrl).origin:'';
 const connection=origin?`<link rel="preconnect" href="${origin}" crossorigin>`:'';
 html=html.replace('</head>',connection+'<script id="dorm-config" type="application/json">'+JSON.stringify(config).replace(/</g,'\\u003c')+'</script></head>');
 await writeFile('dist/index.html',html);
 console.log('Entry form, styles and public configuration included in HTML.');
}finally{await server.close();}
