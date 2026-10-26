const sessionKey='guinqin-session';
let configPromise:Promise<{apiUrl:string;publicKey:string}>|undefined;
async function config(){
 if(!configPromise)configPromise=(async()=>{
  const response=await fetch(new URL('./config.json',document.baseURI),{cache:'no-store'});
  if(!response.ok)throw Error('网页配置未加载，请检查 config.json 是否已上传');
  const data=await response.json();
  if(!data.apiUrl)throw Error('尚未连接共享数据库，请先按部署说明填写 config.json；当前不能提交查寝记录');
  const url=new URL(data.apiUrl);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))throw Error('在线服务地址必须使用 HTTPS');
  if(typeof data.publicKey!=='string'||!data.publicKey)throw Error('请在 config.json 填写 Supabase 的公开密钥');
  let legacyRole='';
  try{legacyRole=JSON.parse(atob(data.publicKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role||'';}catch{}
  if(data.publicKey.startsWith('sb_secret_')||legacyRole==='service_role')throw Error('配置错误：网页不能使用服务端秘密密钥，请立即删除并在后台轮换该密钥');
  return data;
 })().catch(e=>{configPromise=undefined;throw e;});
 return configPromise;
}
export async function request(body:Record<string,unknown>){
 const c=await config();let session='';try{session=localStorage.getItem(sessionKey)||'';}catch{}
 const headers:Record<string,string>={'Content-Type':'application/json',apikey:c.publicKey};
 if(session)headers['X-Dorm-Session']=session;
 let result:Response;
 try{result=await fetch(c.apiUrl,{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}catch{throw Error('无法连接共享数据库，请检查网络与服务地址。填写尚未提交，请稍后重试');}
 if(result.ok&&body.action==='login'){
  const payload=await result.clone().json();
  try{localStorage.setItem(sessionKey,payload.token);}catch{throw Error('浏览器禁止保存登录状态，请允许本站存储后重试');}
 }
 if((result.ok&&body.action==='logout')||result.status===401){try{localStorage.removeItem(sessionKey);}catch{}}
 return result;
}
