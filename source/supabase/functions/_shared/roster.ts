export const rooms = [
  { id: "08-2515", names: ["刘行", "杜吉贺", "黄睿鑫"] },
  { id: "21-101", names: ["朱浩天", "马添祥", "杨昊"] },
  { id: "21-102", names: ["陈子豪", "蒋林", "牛星杰", "尹佳乐"] },
  { id: "21-103", names: ["府应桤", "陆致远", "杨博凯", "朱子祥"] },
  { id: "21-104", names: ["翁敢", "刘星宇", "张广楚"] },
  { id: "11-3101", names: ["王诗琪", "杨紫琪"] },
  { id: "11-3102", names: ["胡运萍", "刘静逸", "王紫怡", "张敏杨"] },
  { id: "11-3103", names: ["甘诗阳", "姜雨涵", "孙欣怡", "许崇婧"] },
  { id: "11-3204", names: ["何宜镁", "蒋佳贝", "孙语阳", "杨晓敏"] },
  { id: "11-3205", names: ["侯扬翼", "刘果", "王欣怡", "姚卓孜"] },
  { id: "11-3206", names: ["简铭仪", "倪子棋", "谢雨欣", "朱佳琪"] },
  { id: "11-4101", names: ["黄静", "陆丝雨", "吴雨欣", "周程玉"] },
];
const heads = ["黄睿鑫", "朱浩天", "朱子祥", "牛星杰", "杨紫琪", "张敏杨", "甘诗阳", "蒋佳贝", "姚卓孜", "黄静", "朱佳琪", "翁敢"];
export type Person = { name: string; room: string; role: "monitor" | "deputy" | "head" | "student" };
export const roster: Person[] = rooms.flatMap(room => room.names.map(name => ({
  name, room: room.id,
  role: name === "胡运萍" ? "monitor" : name === "王诗琪" ? "deputy" : heads.includes(name) ? "head" : "student",
})));
export function person(name: string) { return roster.find(p => p.name === name); }
export const roleLabels = { monitor: "班长", deputy: "副班长", head: "寝室长", student: "同学" };
