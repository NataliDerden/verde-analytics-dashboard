"use strict";
const crypto = require("crypto");

const CFG = {
  unisenderKey: process.env.UNISENDER_API_KEY || "",
  metrikaToken: process.env.YANDEX_METRIKA_TOKEN || "",
  metrikaCounter: process.env.YANDEX_METRIKA_COUNTER || "108760527",
  metrikaDomains: (process.env.METRIKA_DOMAINS || "verdetech.ru,academy.verdetech.ru").split(","),
  wordstatFolder: process.env.WORDSTAT_FOLDER_ID || "",
  wordstatSaKey: process.env.WORDSTAT_SA_KEY || "", // JSON-строка ключа сервис-аккаунта
  wordstatPhrases: (process.env.WORDSTAT_PHRASES || "маринад,ароматизатор пищевой,премикс,краситель пищевой,бульон").split(","),
  bitrixWebhook: process.env.B24_WEBHOOK || "", // https://verdetech.bitrix24.ru/rest/12/XXXX
};

// Цели Метрики (счётчик 108760527)
const GOALS = { zayavka: "549183894", kontakty: "549425106", pdf: "561823578" };

// ---------- даты ----------
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
function monthRange(offset) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
  const end = offset === 0 ? now : lastDay;
  return { label: `${first.getFullYear()}-${pad(first.getMonth() + 1)}`, d1: ymd(first), d2: ymd(end) };
}

// =================== UNISENDER ===================
async function fetchUnisender() {
  if (!CFG.unisenderKey) return { error: "нет ключа UNISENDER_API_KEY" };
  const base = `https://api.unisender.com/ru/api`;
  const camp = await (await fetch(`${base}/getCampaigns?format=json&api_key=${CFG.unisenderKey}&limit=10000`)).json();
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const list = (camp.result || []).filter((c) => c.start_time >= yearStart).sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
  const rows = [];
  for (const c of list) {
    const s = await (await fetch(`${base}/getCampaignCommonStats?format=json&api_key=${CFG.unisenderKey}&campaign_id=${c.id}`)).json();
    const r = s.result || {};
    const sent = +r.sent || 0;
    if (sent <= 1) continue; // тест/черновик
    rows.push({
      date: c.start_time.slice(0, 10), id: c.id, subject: c.subject, list_id: c.list_id,
      sent, delivered: +r.delivered || 0, open: +r.read_unique || 0,
      click: +r.clicked_unique || 0, unsub: +r.unsubscribed || 0, spam: +r.spam || 0,
    });
  }
  const sum = (k) => rows.reduce((a, b) => a + b[k], 0);
  const totSent = sum("sent"), totDeliv = sum("delivered"), totOpen = sum("open");
  const mass = rows.filter((r) => r.sent >= 700);
  const seg = rows.filter((r) => r.sent < 700);
  const avgOpen = (arr) => {
    const d = arr.reduce((a, b) => a + b.delivered, 0), o = arr.reduce((a, b) => a + b.open, 0);
    return d ? +(o * 100 / d).toFixed(1) : 0;
  };
  return {
    rows: rows.slice().reverse(), // свежие сверху
    kpi: {
      campaigns: rows.length, sent: totSent, delivered: totDeliv,
      deliveryPct: totDeliv && totSent ? +(totDeliv * 100 / totSent).toFixed(1) : 0,
      openPct: totDeliv ? +(totOpen * 100 / totDeliv).toFixed(1) : 0,
      unsub: sum("unsub"), spam: sum("spam"),
    },
    massOpen: avgOpen(mass), segOpen: avgOpen(seg), massN: mass.length, segN: seg.length,
  };
}

// =================== МЕТРИКА ===================
async function metrika(params) {
  const u = "https://api-metrika.yandex.net/stat/v1/data?" + new URLSearchParams({ ids: CFG.metrikaCounter, accuracy: "1", ...params });
  const r = await fetch(u, { headers: { Authorization: "OAuth " + CFG.metrikaToken } });
  if (!r.ok) throw new Error("Metrika HTTP " + r.status);
  return r.json();
}
const SRC = "ym:s:lastsignTrafficSourceName";

async function fetchMetrika() {
  if (!CFG.metrikaToken) return { error: "нет токена YANDEX_METRIKA_TOKEN" };
  const win = { d1: ymd(daysAgo(44)), d2: ymd(new Date()) };
  const goalMetrics = `ym:s:goal${GOALS.zayavka}reaches,ym:s:goal${GOALS.kontakty}reaches,ym:s:goal${GOALS.pdf}reaches`;

  // по доменам: визиты/качество/цели + источники
  const domains = [];
  for (const dom of CFG.metrikaDomains) {
    const f = `ym:s:startURLDomain=='${dom.trim()}'`;
    const tot = await metrika({
      metrics: `ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:avgVisitDurationSeconds,${goalMetrics}`,
      filters: f, date1: win.d1, date2: win.d2,
    });
    const src = await metrika({ metrics: "ym:s:visits", dimensions: SRC, filters: f, date1: win.d1, date2: win.d2, sort: "-ym:s:visits", limit: "10" });
    domains.push({
      domain: dom.trim(),
      visits: Math.round(tot.totals[0]), users: Math.round(tot.totals[1]),
      bounce: +tot.totals[2].toFixed(1), time: +(tot.totals[3] / 60).toFixed(1),
      zayavki: Math.round(tot.totals[4]), kontakty: Math.round(tot.totals[5]), pdf: Math.round(tot.totals[6]),
      sources: (src.data || []).map((x) => ({ name: x.dimensions[0].name, visits: Math.round(x.metrics[0]) })),
    });
  }

  // качество по источникам (весь счётчик)
  const q = await metrika({
    metrics: `ym:s:visits,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds,${goalMetrics}`,
    dimensions: SRC, date1: win.d1, date2: win.d2, sort: "-ym:s:visits", limit: "12",
  });
  const quality = (q.data || []).map((x) => ({
    name: x.dimensions[0].name, visits: Math.round(x.metrics[0]), bounce: +x.metrics[1].toFixed(0),
    depth: +x.metrics[2].toFixed(2), time: +(x.metrics[3] / 60).toFixed(1),
    zayavki: Math.round(x.metrics[4]), kontakty: Math.round(x.metrics[5]), pdf: Math.round(x.metrics[6]),
  }));

  // помесячный тренд просмотров по домену (3 месяца)
  const trend = [];
  for (const off of [2, 1, 0]) {
    const m = monthRange(off);
    const r = await metrika({ metrics: "ym:pv:pageviews,ym:pv:users", dimensions: "ym:pv:URLDomain", date1: m.d1, date2: m.d2, limit: "10" });
    const byDom = {};
    (r.data || []).forEach((x) => { byDom[x.dimensions[0].name] = { pv: Math.round(x.metrics[0]), u: Math.round(x.metrics[1]) }; });
    trend.push({ month: m.label, byDom });
  }

  return { window: win, domains, quality, trend };
}

// =================== WORDSTAT (облако) ===================
let _iamCache = { token: "", exp: 0 };
async function iamToken() {
  if (_iamCache.token && _iamCache.exp - Date.now() / 1000 > 300) return _iamCache.token;
  let raw = CFG.wordstatSaKey.trim();
  if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf8"); // поддержка base64
  const sa = JSON.parse(raw);
  const b64 = (x) => Buffer.from(x).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const header = b64(JSON.stringify({ typ: "JWT", alg: "PS256", kid: sa.id }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({ iss: sa.service_account_id, aud: "https://iam.api.cloud.yandex.net/iam/v1/tokens", iat: now, exp: now + 3600 }));
  const si = header + "." + payload;
  const sig = crypto.createSign("RSA-SHA256").update(si).sign({ key: sa.private_key, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST });
  const jwt = si + "." + b64(sig);
  const resp = await (await fetch("https://iam.api.cloud.yandex.net/iam/v1/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jwt }) })).json();
  if (!resp.iamToken) throw new Error("IAM: " + JSON.stringify(resp).slice(0, 200));
  _iamCache = { token: resp.iamToken, exp: now + 3000 };
  return resp.iamToken;
}

async function fetchWordstat() {
  if (!CFG.wordstatSaKey || !CFG.wordstatFolder) return { error: "нет WORDSTAT_SA_KEY / WORDSTAT_FOLDER_ID" };
  const token = await iamToken();
  const out = [];
  for (const phrase of CFG.wordstatPhrases) {
    const p = phrase.trim();
    const r = await fetch("https://searchapi.api.cloud.yandex.net/v2/wordstat/topRequests", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ phrase: p, numPhrases: "30", regions: ["225"], devices: ["DEVICE_ALL"], folderId: CFG.wordstatFolder }),
    });
    const j = await r.json();
    out.push({
      phrase: p,
      total: j.totalCount != null ? +j.totalCount : null,
      top: (j.results || []).slice(0, 10).map((x) => ({ phrase: x.phrase, count: +x.count })),
    });
  }
  return { region: "Россия", phrases: out };
}

// =================== BITRIX24 (CRM-лиды) ===================
function b24call(method, params) {
  const url = CFG.bitrixWebhook.replace(/\/$/, "") + "/" + method + ".json";
  const body = new URLSearchParams(params || {}).toString();
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body })
    .then((r) => r.json());
}
async function b24statusMap(entity) {
  const r = await b24call("crm.status.list", { "filter[ENTITY_ID]": entity, start: 0 });
  const m = {};
  (r.result || []).forEach((s) => (m[s.STATUS_ID] = s.NAME));
  return m;
}

// Группировка стадий воронки в понятные блоки
const STAGE_GROUP = {
  "NEW": "work", "UC_X8BRAP": "work", "UC_XL20ZI": "work", "UC_LINK_OPENED": "work", "UC_FIA6PF": "work",
  "UC_1YRZRD": "qual", "UC_I0GHGV": "qual", "UC_ACADEMY_SUB": "qual",
  "4": "deal", "CONVERTED": "deal",
  "1": "junk", "5": "junk", "9": "junk", "10": "junk", "JUNK": "junk",
};
const GROUP_LABEL = { work: "В работе", qual: "Квалификация", deal: "Сделка создана / создать", junk: "Брак (спам, дубли, некорр.)" };

async function fetchBitrix() {
  if (!CFG.bitrixWebhook) return { error: "нет вебхука B24_WEBHOOK" };
  const SRC = await b24statusMap("SOURCE");
  const STA = await b24statusMap("STATUS");
  const fields = { "select[0]": "ID", "select[1]": "STATUS_ID", "select[2]": "SOURCE_ID", "select[3]": "DATE_CREATE", "order[ID]": "DESC" };
  const first = await b24call("crm.lead.list", Object.assign({ start: 0 }, fields));
  const total = first.total || 0;
  let rows = first.result || [];
  const pages = Math.ceil(total / 50);
  const starts = [];
  for (let p = 1; p < pages; p++) starts.push(p * 50);
  const B = 8;
  for (let i = 0; i < starts.length; i += B) {
    const res = await Promise.all(starts.slice(i, i + B).map((st) => b24call("crm.lead.list", Object.assign({ start: st }, fields))));
    res.forEach((r) => { if (r.result) rows = rows.concat(r.result); });
  }

  const bySource = {}, byStatus = {}, byMonth = {}, groups = { work: 0, qual: 0, deal: 0, junk: 0, other: 0 };
  for (const r of rows) {
    const s = r.SOURCE_ID || "(не указан)";
    bySource[s] = (bySource[s] || 0) + 1;
    const st = r.STATUS_ID || "(пусто)";
    byStatus[st] = (byStatus[st] || 0) + 1;
    groups[STAGE_GROUP[st] || "other"]++;
    const mo = (r.DATE_CREATE || "").slice(0, 7);
    if (mo) byMonth[mo] = (byMonth[mo] || 0) + 1;
  }
  // объединяем "источник не выбран" (56) и пустой источник в одну строку
  const noSrcCount = (bySource["56"] || 0) + (bySource["(не указан)"] || 0);
  const srcArr = Object.entries(bySource)
    .filter(([k]) => k !== "56" && k !== "(не указан)")
    .map(([k, v]) => ({ id: k, name: SRC[k] || k, count: v }));
  if (noSrcCount) srcArr.push({ id: "_nosrc", name: "Источник не указан", count: noSrcCount });
  srcArr.sort((a, b) => b.count - a.count);
  const staArr = Object.entries(byStatus).map(([k, v]) => ({ id: k, name: STA[k] || k, count: v })).sort((a, b) => b.count - a.count);
  const monArr = Object.entries(byMonth).map(([k, v]) => ({ month: k, count: v })).sort((a, b) => (a.month < b.month ? -1 : 1)).slice(-12);

  const cnt = (id) => bySource[id] || 0;
  const email = cnt("65") + cnt("UC_KY1ZRG"); // Рассылка + Почта
  const calls = cnt("CALL");
  const site = cnt("STORE") + cnt("WEBFORM") + cnt("CALLBACK") + cnt("66"); // Сайт + формы + Я.Директ
  const noSource = cnt("(не указан)") + cnt("56"); // пусто + "источник не выбран"
  const dealsCreated = byStatus["CONVERTED"] || 0;
  const dealsTotal = (byStatus["CONVERTED"] || 0) + (byStatus["4"] || 0);

  return {
    total, collected: rows.length,
    sources: srcArr.slice(0, 12), stages: staArr, months: monArr, groups,
    groupLabels: GROUP_LABEL,
    email, calls, site, noSource, dealsCreated, dealsTotal,
    convRate: total ? +(dealsCreated * 100 / total).toFixed(1) : 0,
  };
}

// =================== BITRIX24: ПУЛЬТ ОТДЕЛА ПРОДАЖ ===================
async function b24pullAll(method, fields) {
  const f = {};
  fields.forEach((s, i) => (f["select[" + i + "]"] = s));
  f["order[ID]"] = "ASC";
  const first = await b24call(method, Object.assign({ start: 0 }, f));
  const total = first.total || 0;
  let rows = first.result || [];
  const starts = [];
  for (let p = 1; p < Math.ceil(total / 50); p++) starts.push(p * 50);
  for (let i = 0; i < starts.length; i += 6) {
    const res = await Promise.all(starts.slice(i, i + 6).map((st) => b24call(method, Object.assign({ start: st }, f))));
    res.forEach((r) => { if (r.result) rows = rows.concat(r.result); });
  }
  return rows;
}
async function b24users() {
  let all = [], start = 0;
  while (true) {
    const r = await b24call("user.get", { start });
    if (!r.result || !r.result.length) break;
    all = all.concat(r.result);
    if (r.next == null) break;
    start = r.next;
  }
  return all;
}
const PULT_TEAM = ["250", "24", "66", "454", "456", "446"];
const PULT_DEPARTED = ["158", "232", "234", "222", "22", "220", "136"];
const isWon = (s) => /WON/.test(s || "");
const isLost = (s) => /(LOSE|APOLOGY)/.test(s || "");

async function fetchSalesPult() {
  if (!CFG.bitrixWebhook) return { error: "нет вебхука B24_WEBHOOK" };
  const us = await b24users();
  const uname = {};
  us.forEach((u) => (uname[u.ID] = ((u.LAST_NAME || "") + " " + (u.NAME || "")).trim() || ("#" + u.ID)));
  const deals = await b24pullAll("crm.deal.list", ["ID", "ASSIGNED_BY_ID", "STAGE_ID", "OPPORTUNITY", "DATE_CREATE", "DATE_MODIFY"]);
  const comps = await b24pullAll("crm.company.list", ["ID", "ASSIGNED_BY_ID"]);
  const leads = await b24pullAll("crm.lead.list", ["ID", "ASSIGNED_BY_ID"]);

  const now = Date.now(), d30 = now - 30 * 86400000;
  const M = {};
  const ens = (id) => { id = String(id || "0"); if (!M[id]) M[id] = { id, name: uname[id] || ("#" + id), deals: 0, won: 0, lost: 0, prog: 0, wonSum: 0, comps: 0, leads: 0, created30: 0, lastMod: "" }; return M[id]; };
  deals.forEach((d) => { const m = ens(d.ASSIGNED_BY_ID); m.deals++; if (isWon(d.STAGE_ID)) { m.won++; m.wonSum += +d.OPPORTUNITY || 0; } else if (isLost(d.STAGE_ID)) m.lost++; else m.prog++; if (d.DATE_CREATE && new Date(d.DATE_CREATE).getTime() >= d30) m.created30++; if (d.DATE_MODIFY && d.DATE_MODIFY > m.lastMod) m.lastMod = d.DATE_MODIFY; });
  comps.forEach((c) => ens(c.ASSIGNED_BY_ID).comps++);
  leads.forEach((l) => ens(l.ASSIGNED_BY_ID).leads++);
  const pick = (ids) => ids.map((id) => { const m = M[id] || ens(id); return { ...m, conv: (m.won + m.lost) ? Math.round(m.won * 100 / (m.won + m.lost)) : 0, last: m.lastMod ? m.lastMod.slice(0, 10) : "—", stale: m.lastMod ? Math.round((now - new Date(m.lastMod).getTime()) / 86400000) : 999 }; });

  const onDeparted = comps.filter((c) => PULT_DEPARTED.includes(String(c.ASSIGNED_BY_ID))).length;
  const dealsOnDeparted = deals.filter((d) => PULT_DEPARTED.includes(String(d.ASSIGNED_BY_ID))).length;
  const team = pick(PULT_TEAM);
  const departed = pick(PULT_DEPARTED).filter((m) => m.comps || m.deals).sort((a, b) => b.comps - a.comps);
  return {
    team, departed, onDeparted, dealsOnDeparted,
    totalComps: comps.length,
    teamWon: team.reduce((a, b) => a + b.won, 0),
    teamWonSum: team.reduce((a, b) => a + b.wonSum, 0),
    teamProg: team.reduce((a, b) => a + b.prog, 0),
  };
}

// =================== КЭШ + ОРКЕСТРАЦИЯ ===================
let _cache = { at: 0, data: null, loading: null };
const TTL_MS = 60 * 60 * 1000;

async function build() {
  const safe = async (fn) => { try { return await fn(); } catch (e) { return { error: String(e.message || e) }; } };
  const [unisender, metrika_, wordstat, bitrix, salesPult] = await Promise.all([safe(fetchUnisender), safe(fetchMetrika), safe(fetchWordstat), safe(fetchBitrix), safe(fetchSalesPult)]);
  return { generatedAt: new Date().toISOString(), unisender, metrika: metrika_, wordstat, bitrix, salesPult };
}

async function getData(force) {
  const fresh = _cache.data && Date.now() - _cache.at < TTL_MS;
  if (fresh && !force) return _cache.data;
  if (_cache.loading) return _cache.loading;
  _cache.loading = build().then((d) => { _cache = { at: Date.now(), data: d, loading: null }; return d; })
    .catch((e) => { _cache.loading = null; throw e; });
  return _cache.loading;
}

module.exports = { getData, cacheInfo: () => ({ at: _cache.at }) };
