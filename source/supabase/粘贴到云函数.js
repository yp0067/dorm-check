//#region supabase/functions/_shared/roster.ts
const rooms = [
	{
		id: "08-2515",
		names: [
			"刘行",
			"杜吉贺",
			"黄睿鑫"
		]
	},
	{
		id: "21-101",
		names: [
			"朱浩天",
			"马添祥",
			"杨昊"
		]
	},
	{
		id: "21-102",
		names: [
			"陈子豪",
			"蒋林",
			"牛星杰",
			"尹佳乐"
		]
	},
	{
		id: "21-103",
		names: [
			"府应桤",
			"陆致远",
			"杨博凯",
			"朱子祥"
		]
	},
	{
		id: "21-104",
		names: [
			"翁敢",
			"刘星宇",
			"张广楚"
		]
	},
	{
		id: "11-3101",
		names: ["王诗琪", "杨紫琪"]
	},
	{
		id: "11-3102",
		names: [
			"胡运萍",
			"刘静逸",
			"王紫怡",
			"张敏杨"
		]
	},
	{
		id: "11-3103",
		names: [
			"甘诗阳",
			"姜雨涵",
			"孙欣怡",
			"许崇婧"
		]
	},
	{
		id: "11-3204",
		names: [
			"何宜镁",
			"蒋佳贝",
			"孙语阳",
			"杨晓敏"
		]
	},
	{
		id: "11-3205",
		names: [
			"侯扬翼",
			"刘果",
			"王欣怡",
			"姚卓孜"
		]
	},
	{
		id: "11-3206",
		names: [
			"简铭仪",
			"倪子棋",
			"谢雨欣",
			"朱佳琪"
		]
	},
	{
		id: "11-4101",
		names: [
			"黄静",
			"陆丝雨",
			"吴雨欣",
			"周程玉"
		]
	}
];
const heads = [
	"黄睿鑫",
	"朱浩天",
	"朱子祥",
	"牛星杰",
	"杨紫琪",
	"张敏杨",
	"甘诗阳",
	"蒋佳贝",
	"姚卓孜",
	"黄静",
	"朱佳琪",
	"翁敢"
];
const roster = rooms.flatMap((room) => room.names.map((name) => ({
	name,
	room: room.id,
	role: name === "胡运萍" ? "monitor" : name === "王诗琪" ? "deputy" : heads.includes(name) ? "head" : "student"
})));
function person(name) {
	return roster.find((p) => p.name === name);
}

//#endregion
//#region supabase/functions/_shared/domain.ts
const blankNight = () => ({
	leaves: {},
	attendance: {},
	checks: {},
	deputyNote: "",
	deputySubmission: null,
	roomSubmissions: {},
	delegates: {},
	finals: {},
	audit: []
});
function validDate(s) {
	if (typeof s !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(s)) return false;
	const d = /* @__PURE__ */ new Date(s + "T00:00:00Z");
	return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function checkValid(n, name) {
	const l = n.leaves[name], c = n.checks[name];
	return {
		time: !!l && c?.time === l.start,
		reason: !!l && c?.reason === l.reason
	};
}
function deputySignature(n) {
	return JSON.stringify([Object.entries(n.leaves).sort(([a], [b]) => a.localeCompare(b)).map(([name, l]) => [
		name,
		l.start,
		l.reason,
		checkValid(n, name)
	]), n.deputyNote]);
}
function deputySubmitted(n) {
	return !!n.deputySubmission && n.deputySubmission.signature === deputySignature(n);
}
function signature(n, name) {
	return JSON.stringify([
		n.leaves[name] ?? null,
		n.attendance[name] ?? null,
		checkValid(n, name),
		n.deputyNote,
		deputySubmitted(n)
	]);
}
function canCheck(p, n) {
	return p.role === "head" || n.delegates[p.room] === p.name;
}
function view(n, p) {
	if (p.role === "monitor") return n;
	const result = blankNight();
	if (p.role === "deputy") {
		result.leaves = n.leaves;
		result.checks = n.checks;
		result.deputyNote = n.deputyNote;
		result.deputySubmission = n.deputySubmission;
	} else if (n.leaves[p.name]) result.leaves[p.name] = n.leaves[p.name];
	if (n.attendance[p.name]) result.attendance[p.name] = n.attendance[p.name];
	if (canCheck(p, n)) {
		result.attendance = Object.fromEntries(Object.entries(n.attendance).filter(([name]) => person(name)?.room === p.room));
		if (n.roomSubmissions[p.room]) result.roomSubmissions[p.room] = n.roomSubmissions[p.room];
	}
	if (n.delegates[p.room]) result.delegates[p.room] = n.delegates[p.room];
	return result;
}
function requireValue(ok, message) {
	if (!ok) throw new Error(message);
}
function str(v, max) {
	requireValue(typeof v === "string" && v.length <= max, "填写内容不完整或过长");
	return v.trim();
}
function stamp(v) {
	const s = str(v, 16);
	requireValue(/^20\d{2}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(s) && validDate(s.slice(0, 10)), "请填写正确的日期和时间");
	return s;
}
function change(input, p, action, data, date) {
	const n = structuredClone(input), at = (/* @__PURE__ */ new Date()).toISOString();
	let before = null, after = null;
	if (action === "leave") {
		before = n.leaves[p.name] ?? null;
		if (data.cancel === true) delete n.leaves[p.name];
		else {
			const start = stamp(data.start), expected = stamp(data.expected), reason = str(data.reason, 300);
			requireValue(reason, "请填写请假原因");
			requireValue(expected > start, "预计到寝时间必须晚于请假开始时间");
			requireValue(start.slice(0, 10) <= date && expected.slice(0, 10) >= date, "请假时间应覆盖所选查寝日期");
			n.leaves[p.name] = {
				start,
				expected,
				reason,
				updated: at
			};
		}
		after = n.leaves[p.name] ?? null;
		const old = input.leaves[p.name], now = n.leaves[p.name];
		if (old?.start !== now?.start || old?.reason !== now?.reason) {
			const c = n.checks[p.name];
			if (c) {
				if (old?.start !== now?.start) c.time = null;
				if (old?.reason !== now?.reason) c.reason = null;
			}
			if (n.deputySubmission) n.deputySubmission.signature = "";
		}
	} else if (action === "attendance") {
		requireValue(canCheck(p, n), "只有本寝室查寝负责人可以提交");
		const members = roster.filter((x) => x.room === p.room);
		requireValue(Array.isArray(data.rows) && data.rows.length === members.length && new Set(data.rows.map((r) => r.name)).size === members.length, "请为本寝室每位同学选择状态，包括你自己");
		before = members.map((x) => n.attendance[x.name] ?? null);
		for (const row of data.rows) {
			requireValue(members.some((x) => x.name === row.name), "不能修改其他寝室");
			requireValue(["present", "absent"].includes(row.status), "请选择每位同学的查寝结果");
			const note = str(row.note ?? "", 200);
			const old = n.attendance[row.name];
			if (!old || old.status !== row.status || old.note !== note) n.attendance[row.name] = {
				status: row.status,
				by: p.name,
				updated: at,
				note
			};
		}
		n.roomSubmissions[p.room] = {
			by: p.name,
			updated: at,
			unavailable: false
		};
		after = members.map((x) => n.attendance[x.name]);
	} else if (action === "unavailable") {
		requireValue(canCheck(p, n), "只有本寝室负责人可以操作");
		requireValue(!n.roomSubmissions[p.room] || n.roomSubmissions[p.room].unavailable, "已有查寝记录，请直接更新或联系班长安排代查");
		n.roomSubmissions[p.room] = {
			by: p.name,
			updated: at,
			unavailable: true
		};
		after = n.roomSubmissions[p.room];
	} else if (action === "deputy") {
		requireValue(p.role === "deputy", "仅副班长可以核对请假");
		requireValue(data.checks && typeof data.checks === "object" && !Array.isArray(data.checks), "核对内容无效");
		before = {
			checks: n.checks,
			note: n.deputyNote
		};
		for (const [name, c] of Object.entries(data.checks)) {
			requireValue(!!n.leaves[name], "名单已变化，请刷新后核对");
			requireValue(typeof c.time === "boolean" && typeof c.reason === "boolean", "勾选内容无效");
			n.checks[name] = {
				time: c.time ? n.leaves[name].start : null,
				reason: c.reason ? n.leaves[name].reason : null
			};
		}
		n.deputyNote = str(data.note ?? "", 4e3);
		n.deputySubmission = {
			signature: deputySignature(n),
			updated: at
		};
		after = {
			checks: n.checks,
			note: n.deputyNote
		};
	} else if (action === "delegate") {
		requireValue(p.role === "monitor", "仅班长可以安排当晚代查");
		const target = person(data.name);
		requireValue(target && target.room === data.room, "请选择这个寝室的同学");
		before = n.delegates[data.room] ?? null;
		n.delegates[data.room] = target.name;
		after = target.name;
	} else if (action === "final") {
		requireValue(p.role === "monitor", "仅班长可以最终核验");
		requireValue(!!person(data.name), "同学不存在");
		const note = str(data.note ?? "", 500);
		requireValue(typeof data.follow === "boolean", "核验结果无效");
		if (!data.follow) {
			requireValue(n.attendance[data.name], "请先确认实际查寝结果，暂时可标记需跟进");
			requireValue(n.attendance[data.name].status !== "absent" || n.leaves[data.name] || note, "该同学未归且未申报，请在核验备注中记录确认的原因");
		}
		before = n.finals[data.name] ?? null;
		n.finals[data.name] = {
			signature: signature(n, data.name),
			note,
			follow: data.follow,
			updated: at
		};
		after = n.finals[data.name];
	} else throw new Error("不支持的操作");
	n.audit.push({
		by: p.name,
		action,
		at,
		before,
		after
	});
	return n;
}

//#endregion
//#region supabase/functions/_shared/handler.ts
async function digest(token) {
	const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
	return Array.from(new Uint8Array(b), (n) => n.toString(16).padStart(2, "0")).join("");
}
function handler(store, allowedOrigins) {
	return async (req) => {
		const origin = req.headers.get("origin") || "";
		const cors = {
			"Cache-Control": "no-store",
			"Vary": "Origin",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "content-type, apikey, x-dorm-session",
			"Access-Control-Max-Age": "600"
		};
		if (allowedOrigins.includes(origin)) cors["Access-Control-Allow-Origin"] = origin;
		const json = (body, status = 200) => Response.json(body, {
			status,
			headers: cors
		});
		if (!allowedOrigins.length) return json({ error: "后台尚未配置允许访问的网址，请设置 ALLOWED_ORIGIN" }, 503);
		if (!origin || !allowedOrigins.includes(origin)) return json({ error: "此网页地址尚未获准连接，请检查后台 ALLOWED_ORIGIN" }, 403);
		if (req.method === "OPTIONS") return new Response(null, {
			status: 204,
			headers: cors
		});
		if (req.method !== "POST") return json({ error: "不支持的请求方式" }, 405);
		if (Number(req.headers.get("content-length") || 0) > 4e4) return json({ error: "提交内容过大" }, 413);
		let body;
		try {
			const raw = await req.text();
			if (raw.length > 4e4) return json({ error: "提交内容过大" }, 413);
			body = JSON.parse(raw);
			if (!body || typeof body !== "object" || Array.isArray(body)) throw Error();
		} catch {
			return json({ error: "请求格式不正确" }, 400);
		}
		try {
			if (body.action === "login") {
				const p = person(typeof body.name === "string" ? body.name.trim() : "");
				if (!p) return json({ error: "未找到这个姓名，请核对班级名单" }, 400);
				const token = crypto.randomUUID() + crypto.randomUUID();
				await store.createSession(await digest(token), p.name, new Date(Date.now() + 7 * 864e5).toISOString());
				return json({
					person: p,
					token
				});
			}
			const token = req.headers.get("x-dorm-session") || "";
			if (!/^[a-f0-9-]{72}$/.test(token)) return json({ error: "请先输入姓名" }, 401);
			const hash = await digest(token);
			if (body.action === "logout") {
				await store.deleteSession(hash);
				return json({ ok: true });
			}
			const session = await store.session(hash);
			const p = session && Date.parse(session.expires_at) > Date.now() ? person(session.name) : void 0;
			if (!p) return json({ error: "登录已失效，请重新输入姓名" }, 401);
			if (!validDate(body.date)) return json({ error: "查寝日期无效" }, 400);
			const current = await store.read(body.date) || {
				state: blankNight(),
				revision: 0
			};
			if (body.action === "get") return json({
				person: p,
				state: view(current.state, p),
				revision: current.revision
			});
			if (!Number.isInteger(body.revision) || body.revision < 0) return json({ error: "记录版本无效" }, 400);
			if (body.revision !== current.revision) return json({ error: "有新记录提交，请先刷新，再提交你的修改" }, 409);
			let next;
			try {
				next = change(current.state, p, body.action, body.data ?? {}, body.date);
			} catch (e) {
				return json({ error: e.message }, 400);
			}
			if (!await store.save(body.date, next, current.revision)) return json({ error: "有新记录提交，请先刷新，再提交你的修改" }, 409);
			return json({
				person: p,
				state: view(next, p),
				revision: current.revision + 1
			});
		} catch {
			return json({ error: "共享数据库暂时无法读写，请检查后台配置或稍后重试；本次修改未确认保存" }, 503);
		}
	};
}

//#endregion
//#region supabase/functions/_shared/postgrest.ts
function postgresStore(url, secret) {
	async function api(path, method = "GET", body) {
		if (!url || !secret) throw Error("Server database credentials unavailable");
		const headers = {
			apikey: secret,
			"Content-Type": "application/json"
		};
		if (!secret.startsWith("sb_secret_")) headers.Authorization = "Bearer " + secret;
		const result = await fetch(url.replace(/\/$/, "") + "/rest/v1/" + path, {
			method,
			headers,
			body: body === void 0 ? void 0 : JSON.stringify(body),
			signal: AbortSignal.timeout(15e3)
		});
		if (!result.ok) throw Error("Database request failed");
		if (result.status === 204) return null;
		const text = await result.text();
		return text ? JSON.parse(text) : null;
	}
	return {
		async session(hash) {
			return (await api("dorm_sessions?token_hash=eq." + hash + "&select=name,expires_at&limit=1"))[0] || null;
		},
		async createSession(hash, name, expires) {
			await api("dorm_sessions", "POST", {
				token_hash: hash,
				name,
				expires_at: expires
			});
		},
		async deleteSession(hash) {
			await api("dorm_sessions?token_hash=eq." + hash, "DELETE");
		},
		async read(date) {
			return (await api("dorm_nights?date=eq." + encodeURIComponent(date) + "&select=state,revision&limit=1"))[0] || null;
		},
		async save(date, state, expected) {
			return await api("rpc/dorm_save_night", "POST", {
				p_date: date,
				p_state: state,
				p_expected: expected
			}) === true;
		}
	};
}

//#endregion
//#region supabase/functions/night/index.ts
const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const store = postgresStore(Deno.env.get("SUPABASE_URL") || "", secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
const origins = (Deno.env.get("ALLOWED_ORIGIN") || "https://yp0067.github.io").split(",").map((s) => s.trim()).filter(Boolean);
Deno.serve(handler(store, origins));

//#endregion