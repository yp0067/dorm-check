import { test } from "node:test";
import assert from "node:assert/strict";
import { rooms,roster,person } from "../src/roster.ts";
import { blankNight,change,checkValid,deputySubmitted,verified,view,report,validDate,attendanceStage } from "../src/domain.ts";
const date="2026-10-25",student=person("刘行")!,head=person("黄睿鑫")!,deputy=person("王诗琪")!,monitor=person("胡运萍")!;
const leave={start:"2026-10-25T18:00",expected:"2026-10-26T20:00",reason:"回家"};
test("roster has 43 unique students, one head per room and correct exclusions",()=>{
 assert.equal(roster.length,43);assert.equal(new Set(roster.map(p=>p.name)).size,43);assert.equal(rooms.length,12);
 assert.equal(person("苏子言"),undefined);assert.equal(person("陈宥铮"),undefined);
 for(const r of rooms)assert.equal(roster.filter(p=>p.room===r.id&&p.role==="head").length,1);
 assert.equal(person("张敏杨")?.role,"head");assert.equal(person("杨晓敏")?.role,"student");
});
test("missing personal report remains an absent person and raw notes do not add to counts",()=>{
 let n=blankNight();n=change(n,head,"attendance",{rows:rooms[0].names.map(name=>({name,status:name===student.name?"absent":"present"}))},date);
 n=change(n,deputy,"deputy",{checks:{},note:"刘行，请假回家。刘行，请假回家。"},date);
 assert.match(report(n,date,"monitor"),/^1人未归/);assert.match(report(n,date,"monitor"),/原因待补充/);
 assert.throws(()=>change(n,monitor,"final",{name:student.name,note:"",follow:false},date),/原因/);
 n=change(n,monitor,"final",{name:student.name,note:"已联系本人，确认回家",follow:false},date);assert.equal(verified(n,student.name),true);
 assert.match(report(n,date,"monitor"),/已联系本人，确认回家/);
});
test("deputy checks time and reason independently; return time is not a check",()=>{
 let n=change(blankNight(),student,"leave",leave,date);
 n=change(n,deputy,"deputy",{checks:{[student.name]:{time:true,reason:true}},note:""},date);assert.equal(deputySubmitted(n),true);
 n=change(n,student,"leave",{...leave,expected:"2026-10-27T20:00"},date);assert.deepEqual(checkValid(n,student.name),{time:true,reason:true});assert.equal(deputySubmitted(n),true);
 n=change(n,student,"leave",{...leave,reason:"看病"},date);assert.deepEqual(checkValid(n,student.name),{time:true,reason:false});assert.equal(deputySubmitted(n),false);
 n=change(n,student,"leave",leave,date);assert.equal(checkValid(n,student.name).reason,false);assert.equal(deputySubmitted(n),false);
});
test("role-scoped views and server actions reject cross-room and non-monitor verification",()=>{
 let n=change(blankNight(),student,"leave",leave,date);n=change(n,deputy,"leave",leave,date);
 n=change(n,head,"attendance",{rows:rooms[0].names.map(name=>({name,status:"present"}))},date);
 assert.equal(Object.keys(view(n,head).attendance).length,3);assert.equal(view(n,head).leaves[student.name],undefined);
 assert.equal(view(n,deputy).attendance[student.name],undefined);assert.equal(Object.keys(view(n,student).leaves).length,1);
 assert.throws(()=>change(n,student,"final",{name:student.name,note:"",follow:false},date),/班长/);
 assert.throws(()=>change(n,head,"attendance",{rows:[{name:deputy.name,status:"present"},{name:"杜吉贺",status:"present"},{name:head.name,status:"present"}]},date),/其他寝室/);
 assert.throws(()=>change(n,head,"attendance",{rows:[{name:student.name,status:"present"}]},date),/每位/);
});
test("changes invalidate final verification; tomorrow starts without carried attendance",()=>{
 let n=change(blankNight(),student,"leave",leave,date);n=change(n,head,"attendance",{rows:rooms[0].names.map(name=>({name,status:"present"}))},date);
 n=change(n,monitor,"final",{name:student.name,note:"提前返寝",follow:false},date);assert.equal(verified(n,student.name),true);
 n=change(n,head,"attendance",{rows:rooms[0].names.map(name=>({name,status:name===student.name?"absent":"present"}))},date);assert.equal(verified(n,student.name),false);
 assert.equal(Object.keys(blankNight().attendance).length,0);assert.equal(n.audit.length,4);
});
test("delegation is limited to the same room and pending students cannot be verified",()=>{
 let n=blankNight();assert.throws(()=>change(n,monitor,"delegate",{room:head.room,name:deputy.name},date),/这个寝室/);
 n=change(n,monitor,"delegate",{room:head.room,name:student.name},date);
 assert.throws(()=>change(n,student,"attendance",{rows:rooms[0].names.map(name=>({name,status:"unknown"}))},date),/查寝结果/);
 assert.equal(Object.keys(view(n,student).attendance).length,0);assert.throws(()=>change(n,monitor,"final",{name:student.name,note:"",follow:false},date),/实际查寝/);
});
test("invalid dates and inverted leave intervals are rejected",()=>{
 assert.equal(validDate("2026-99-25"),false);assert.equal(validDate("2026-02-30"),false);assert.equal(validDate(date),true);
 assert.throws(()=>change(blankNight(),student,"leave",{...leave,expected:"2026-10-24T20:00"},date),/晚于/);
});
test("monitor summaries group identical reasons, and include return times Sunday through Thursday only",()=>{
 for(const day of ['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31']){
  const n=blankNight();
  for(const name of ['刘行','杜吉贺']){
   n.attendance[name]={status:'absent',by:head.name,updated:'',note:''};
   n.leaves[name]={start:day+'T18:00',expected:day+'T23:00',reason:'回家',updated:''};
  }
  n.leaves[deputy.name]={start:day+'T18:00',expected:day+'T23:00',reason:'回家',updated:''};
  n.deputyNote='王诗琪请假回家';
  const withTime=new Date(day+'T00:00:00Z').getUTCDay()<=4;
  assert.equal(report(n,day,'monitor'),'2人未归\n刘行、杜吉贺 回家'+(withTime?'，预计23:00归寝':''));
  n.leaves['杜吉贺'].expected='2026-11-01T10:00';
  const split=report(n,day,'monitor');
  assert.equal(split.split('\n').length,withTime?3:2);
  if(withTime)assert.match(split,/杜吉贺 回家，预计11月1日 10:00归寝/);
 }
 assert.equal(report(blankNight(),date,'monitor'),'0人未归');
});
test("missing return times stay explicit and cross-year dates stay unambiguous",()=>{
 const n=blankNight();n.attendance[student.name]={status:'absent',by:head.name,updated:'',note:'请病假'};
 assert.equal(report(n,date,'monitor'),'1人未归\n刘行 请病假，归寝时间待补充');
 n.leaves[student.name]={...leave,expected:'2027-01-01T09:00',updated:''};
 assert.match(report(n,date,'monitor'),/2027年1月1日 09:00归寝/);
});
test("only monitor can cancel a leave; attendance remains and previous checks do not revive",()=>{
 let n=change(blankNight(),student,'leave',leave,date);
 n=change(n,head,'attendance',{rows:rooms[0].names.map(name=>({name,status:'absent'}))},date);
 n=change(n,deputy,'deputy',{checks:{[student.name]:{time:true,reason:true}},note:'保留副班原文'},date);
 n=change(n,monitor,'final',{name:student.name,note:'',follow:false},date);
 for(const p of [student,head,deputy])assert.throws(()=>change(n,p,'cancel-leave',{name:student.name},date),/仅班长/);
 assert.throws(()=>change(n,monitor,'cancel-leave',{name:'不存在'},date),/没有请假/);
 const original=structuredClone(n);
 n=change(n,monitor,'cancel-leave',{name:student.name},date);
 assert.equal(n.leaves[student.name],undefined);assert.equal(n.checks[student.name],undefined);assert.equal(n.finals[student.name],undefined);
 assert.deepEqual(n.attendance,original.attendance);assert.equal(n.deputyNote,'保留副班原文');assert.equal(deputySubmitted(n),false);
 assert.deepEqual((n.audit.at(-1)!.before as any).leave,original.leaves[student.name]);assert.equal(n.audit.at(-1)!.by,monitor.name);
 n=change(n,student,'leave',leave,date);assert.deepEqual(checkValid(n,student.name),{time:false,reason:false});assert.equal(verified(n,student.name),false);
});
test("unavailable rooms wait for checking until the head or delegate submits actual attendance",()=>{
 let n=blankNight();assert.equal(attendanceStage(n,student),'unregistered');
 n=change(n,head,'unavailable',{},date);assert.equal(attendanceStage(n,student),'waiting');assert.equal(attendanceStage(n,head),'waiting');
 assert.equal(attendanceStage(n,deputy),'unregistered');assert.equal(report(n,date,'monitor'),'0人未归');
 n=change(n,monitor,'delegate',{room:head.room,name:student.name},date);assert.equal(attendanceStage(n,student),'waiting');
 n=change(n,student,'attendance',{rows:rooms[0].names.map(name=>({name,status:'present'}))},date);
 assert.equal(attendanceStage(n,head),'registered');assert.equal(n.roomSubmissions[head.room].unavailable,false);
});
