import { person, roster, type Person } from "./roster.ts";
export type Status = "present" | "absent";
export type Leave = { start: string; reason: string; expected: string; updated: string };
export type Attendance = { status: Status; by: string; updated: string; note: string };
export type Check = { time: string | null; reason: string | null };
export type Final = { signature: string; note: string; follow: boolean; updated: string };
export type Night = { leaves: Record<string, Leave>; attendance: Record<string, Attendance>; checks: Record<string, Check>; deputyNote: string; deputySubmission: { signature: string; updated: string } | null; roomSubmissions: Record<string, { by: string; updated: string; unavailable: boolean }>; delegates: Record<string, string>; finals: Record<string, Final>; audit: { by: string; action: string; at: string; before: unknown; after: unknown }[] };
export const blankNight = (): Night => ({ leaves: {}, attendance: {}, checks: {}, deputyNote: "", deputySubmission: null, roomSubmissions: {}, delegates: {}, finals: {}, audit: [] });
export function today() { return new Intl.DateTimeFormat("en-CA", {timeZone: "Asia/Shanghai",year: "numeric",month: "2-digit",day: "2-digit"}).format(new Date()); }
export function validDate(s: unknown): s is string { if(typeof s !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+"T00:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s; }
export function checkValid(n: Night, name: string) { const l=n.leaves[name], c=n.checks[name]; return {time: !!l && c?.time===l.start, reason: !!l && c?.reason===l.reason}; }
export function deputySignature(n: Night) { return JSON.stringify([Object.entries(n.leaves).sort(([a],[b])=>a.localeCompare(b)).map(([name,l])=>[name,l.start,l.reason,checkValid(n,name)]),n.deputyNote]); }
export function deputySubmitted(n: Night) { return !!n.deputySubmission && n.deputySubmission.signature===deputySignature(n); }
export function signature(n: Night, name: string) { return JSON.stringify([n.leaves[name]??null,n.attendance[name]??null,checkValid(n,name),n.deputyNote,deputySubmitted(n)]); }
export function verified(n: Night, name: string) { const f=n.finals[name]; return !!f && !f.follow && f.signature===signature(n,name); }
export function attendanceStage(n: Night,p: Person) { return n.attendance[p.name]?"registered":n.roomSubmissions[p.room]?.unavailable?"waiting":"unregistered"; }
export function issue(n: Night, name: string) {
 const a=n.attendance[name],l=n.leaves[name],c=checkValid(n,name);
 if(!a) return "查寝未登记";
 if(a.status==="absent"&&!l) return "未归 · 本人未申报";
 if(a.status==="present"&&l) return "已在寝 · 有请假记录";
 if(l&&(!c.time||!c.reason)) return "请假待副班核对";
 return "";
}
export function canCheck(p: Person,n: Night) { return p.role==="head" || n.delegates[p.room]===p.name; }
export function view(n: Night,p: Person): Night {
 if(p.role==="monitor") return n;
 const result=blankNight();
 if(p.role==="deputy") { result.leaves=n.leaves;result.checks=n.checks;result.deputyNote=n.deputyNote;result.deputySubmission=n.deputySubmission; }
 else if(n.leaves[p.name]) result.leaves[p.name]=n.leaves[p.name];
 if(n.attendance[p.name]) result.attendance[p.name]=n.attendance[p.name];
 if(canCheck(p,n)) {
   result.attendance=Object.fromEntries(Object.entries(n.attendance).filter(([name])=>person(name)?.room===p.room));
   if(n.roomSubmissions[p.room]) result.roomSubmissions[p.room]=n.roomSubmissions[p.room];
 }
 if(n.delegates[p.room]) result.delegates[p.room]=n.delegates[p.room];
 return result;
}
function requireValue(ok: unknown,message: string): asserts ok { if(!ok) throw new Error(message); }
function str(v: unknown,max: number) { requireValue(typeof v==="string" && v.length<=max,"填写内容不完整或过长");return v.trim(); }
function stamp(v: unknown) { const s=str(v,16);requireValue(/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(s)&&validDate(s.slice(0,10)),"请填写正确的日期和时间");return s; }
export function change(input: Night, p: Person, action: string, data: any, date: string): Night {
 const n=structuredClone(input),at=new Date().toISOString();let before:unknown=null,after:unknown=null;
 if(action==="leave") {
  before=n.leaves[p.name]??null;
  if(data.cancel===true) delete n.leaves[p.name];
  else { const start=stamp(data.start),expected=stamp(data.expected),reason=str(data.reason,300);requireValue(reason,"请填写请假原因");requireValue(expected>start,"预计到寝时间必须晚于请假开始时间");requireValue(start.slice(0,10)<=date&&expected.slice(0,10)>=date,"请假时间应覆盖所选查寝日期");n.leaves[p.name]={start,expected,reason,updated:at}; }
  after=n.leaves[p.name]??null;
  const old=input.leaves[p.name],now=n.leaves[p.name];
  if(old?.start!==now?.start||old?.reason!==now?.reason){
   const c=n.checks[p.name];if(c){if(old?.start!==now?.start)c.time=null;if(old?.reason!==now?.reason)c.reason=null;}
   if(n.deputySubmission)n.deputySubmission.signature="";
  }
 } else if(action==="cancel-leave") {
  requireValue(p.role==="monitor","仅班长可以撤销同学请假");
  const target=person(data.name);requireValue(target&&n.leaves[target.name],"这位同学没有请假记录，请刷新后查看");
  const name=target.name;before={name,leave:n.leaves[name],check:n.checks[name]??null,final:n.finals[name]??null};
  delete n.leaves[name];delete n.checks[name];delete n.finals[name];
  if(n.deputySubmission)n.deputySubmission.signature="";
  after={name,cancelled:true};
 } else if(action==="attendance") {
  requireValue(canCheck(p,n),"只有本寝室查寝负责人可以提交");
  const members=roster.filter(x=>x.room===p.room);requireValue(Array.isArray(data.rows)&&data.rows.length===members.length&&new Set(data.rows.map((r:any)=>r.name)).size===members.length,"请为本寝室每位同学选择状态，包括你自己");
  before=members.map(x=>n.attendance[x.name]??null);
  for(const row of data.rows) {requireValue(members.some(x=>x.name===row.name),"不能修改其他寝室");requireValue(["present","absent"].includes(row.status),"请选择每位同学的查寝结果");const note=str(row.note??"",200);const old=n.attendance[row.name];if(!old||old.status!==row.status||old.note!==note)n.attendance[row.name]={status:row.status,by:p.name,updated:at,note};}
  n.roomSubmissions[p.room]={by:p.name,updated:at,unavailable:false};after=members.map(x=>n.attendance[x.name]);
 } else if(action==="unavailable") {
  requireValue(canCheck(p,n),"只有本寝室负责人可以操作");requireValue(!n.roomSubmissions[p.room]||n.roomSubmissions[p.room].unavailable,"已有查寝记录，请直接更新或联系班长安排代查");n.roomSubmissions[p.room]={by:p.name,updated:at,unavailable:true};after=n.roomSubmissions[p.room];
 } else if(action==="deputy") {
  requireValue(p.role==="deputy","仅副班长可以核对请假");requireValue(data.checks&&typeof data.checks==="object"&&!Array.isArray(data.checks),"核对内容无效");before={checks:n.checks,note:n.deputyNote};
  for(const [name,c] of Object.entries(data.checks) as [string,any][]) {requireValue(!!n.leaves[name],"名单已变化，请刷新后核对");requireValue(typeof c.time==="boolean"&&typeof c.reason==="boolean","勾选内容无效");n.checks[name]={time:c.time?n.leaves[name].start:null,reason:c.reason?n.leaves[name].reason:null};}
  n.deputyNote=str(data.note??"",4000);n.deputySubmission={signature:deputySignature(n),updated:at};after={checks:n.checks,note:n.deputyNote};
 } else if(action==="delegate") {
  requireValue(p.role==="monitor","仅班长可以安排当晚代查");const target=person(data.name);requireValue(target&&target.room===data.room,"请选择这个寝室的同学");before=n.delegates[data.room]??null;n.delegates[data.room]=target.name;after=target.name;
 } else if(action==="final") {
  requireValue(p.role==="monitor","仅班长可以最终核验");requireValue(!!person(data.name),"同学不存在");const note=str(data.note??"",500);requireValue(typeof data.follow==="boolean","核验结果无效");
  if(!data.follow) {requireValue(n.attendance[data.name],"请先确认实际查寝结果，暂时可标记需跟进");requireValue(n.attendance[data.name].status!=="absent"||n.leaves[data.name]||note,"该同学未归且未申报，请在核验备注中记录确认的原因");}
  before=n.finals[data.name]??null;n.finals[data.name]={signature:signature(n,data.name),note,follow:data.follow,updated:at};after=n.finals[data.name];
 } else throw new Error("不支持的操作");
 n.audit.push({by:p.name,action,at,before,after});return n;
}
export function report(n: Night,date: string,kind: "monitor"|"deputy") {
 const at=new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",dateStyle:"short",timeStyle:"short"}).format(new Date());
 if(kind==="deputy") return [`食工261｜${date} 请假登记核对`,`统计截至：${at}`,`学生已填写：${Object.keys(n.leaves).length}人（备注补充未自动计数）`,...Object.entries(n.leaves).map(([name,l])=>{const c=checkValid(n,name);return `${name}（${person(name)?.room}）｜请假：${l.start.replace("T"," ")}｜原因：${l.reason}｜预计到寝：${l.expected.replace("T"," ")}｜时间${c.time?"已核对":"待核对"}，原因${c.reason?"已核对":"待核对"}`;}),`副班补充原文：\n${n.deputyNote||"无"}`,`提交状态：${deputySubmitted(n)?"已提交":"尚未提交或信息已变更"}`].join("\n");
 const absent=roster.filter(p=>n.attendance[p.name]?.status==="absent");
 const withTime=new Date(date+"T00:00:00Z").getUTCDay()<=4;
 const groups=new Map<string,{names:string[];reason:string;time:string}>();
 for(const p of absent){
  const l=n.leaves[p.name];
  const reason=(l?.reason||n.finals[p.name]?.note||n.attendance[p.name]?.note||"原因待补充").replace(/\s+/g," ").trim();
  const time=withTime?(l?.expected||""):"";
  const key=JSON.stringify([reason,time]);
  const group=groups.get(key)||{names:[],reason,time};group.names.push(p.name);groups.set(key,group);
 }
 return [`${absent.length}人未归`,...Array.from(groups.values(),g=>{
  let suffix="";
  if(withTime){
   const when=g.time?(g.time.slice(0,10)===date?g.time.slice(11):`${g.time.slice(0,4)===date.slice(0,4)?"":g.time.slice(0,4)+"年"}${Number(g.time.slice(5,7))}月${Number(g.time.slice(8,10))}日 ${g.time.slice(11)}`):"";
   suffix=when?`，预计${when}归寝`:"，归寝时间待补充";
  }
  return g.names.join("、")+" "+g.reason+suffix;
 })].join("\n");
}
