import { test } from "node:test";
import assert from "node:assert/strict";
import { rooms,roster,person } from "../src/roster.ts";
import { blankNight,change,checkValid,deputySubmitted,verified,view,report,validDate } from "../src/domain.ts";
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
 assert.match(report(n,date,"monitor"),/未归 1人/);assert.match(report(n,date,"monitor"),/原因：待核实/);
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
