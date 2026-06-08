"use strict";

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (n) => (n == null ? "—" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " "));
const pct = (n) => (n == null ? "—" : String(n).replace(".", ",") + "%");

const CSS = `
*{box-sizing:border-box}
body{font-family:"Onest","Segoe UI",Arial,sans-serif;color:#15201a;margin:0;background:#f0f5f0;font-size:14px;line-height:1.45}
.wrap{max-width:1080px;margin:0 auto;padding:0 16px 60px}
.head{background:linear-gradient(100deg,#0A8F00,#0FBF00);color:#fff;padding:22px 24px;border-radius:0 0 16px 16px;margin-bottom:18px}
.head .wm{font-weight:800;letter-spacing:.5px}.head .wm sup{font-size:10px;opacity:.7}
.head h1{margin:4px 0 0;font-size:24px}.head .sub{opacity:.92;font-size:13px;margin-top:3px}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px}
.btn{background:#fff;color:#0A8F00;border:none;border-radius:9px;padding:8px 16px;font-weight:600;font-size:13px;cursor:pointer;text-decoration:none;display:inline-block}
.btn:hover{background:#eafbe9}
.muted{color:#6b7280;font-size:12px}
h2{font-size:17px;color:#0A8F00;margin:26px 0 12px;border-bottom:2px solid #dceedc;padding-bottom:6px}
.card{background:#fff;border:1px solid #e2efe2;border-radius:14px;padding:16px;margin-bottom:14px}
.kpis{display:flex;gap:12px;flex-wrap:wrap}
.kpi{flex:1;min-width:120px;background:#fff;border:1px solid #e2efe2;border-radius:13px;padding:13px 15px}
.kpi .v{font-size:22px;font-weight:700;color:#0A8F00}.kpi .l{font-size:11.5px;color:#5b6b60;margin-top:3px}
.callout{background:#f3faf3;border-left:4px solid #0FBF00;border-radius:9px;padding:12px 15px;margin:12px 0;font-size:13.5px}
.callout b{color:#0A8F00}
.two{display:flex;gap:16px;flex-wrap:wrap}.two>div{flex:1;min-width:280px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{background:#0A8F00;color:#fff;text-align:left;padding:7px 8px;font-weight:600;position:sticky;top:0}
th.r,td.r{text-align:right}
td{padding:6px 8px;border-bottom:1px solid #eef3ee}
tr:nth-child(even) td{background:#fafdfa}
.g{color:#0A8F00;font-weight:700}.bad{color:#c0392b;font-weight:700}
.src{margin:6px 0;font-size:12.5px}.src .lbl{display:flex;justify-content:space-between;margin-bottom:2px}
.bw{height:8px;background:#e8efe8;border-radius:5px;overflow:hidden}.bw>span{display:block;height:100%;background:#0FBF00}
.site .bw>span{background:#2f7be0}
.err{background:#fff4f4;border-left:4px solid #d33;border-radius:8px;padding:10px 14px;color:#a33;font-size:13px}
.tabletall{max-height:520px;overflow:auto;border:1px solid #e2efe2;border-radius:12px}
.foot{margin-top:24px;font-size:11px;color:#8a958c;border-top:1px solid #dceedc;padding-top:10px}
.login{max-width:360px;margin:12vh auto;background:#fff;border:1px solid #e2efe2;border-radius:16px;padding:28px}
.login h1{font-size:20px;color:#0A8F00;margin:0 0 4px}.login input{width:100%;padding:10px 12px;border:1px solid #cdd;border-radius:9px;margin:10px 0;font-size:15px}
.login button{width:100%;background:#0FBF00;color:#fff;border:none;border-radius:9px;padding:11px;font-weight:600;font-size:15px;cursor:pointer}
`;

function shell(body) {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verde · Аналитика</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function loginPage(error) {
  return shell(`<form class="login" method="POST" action="/login">
    <div style="font-weight:800;letter-spacing:.5px;color:#0A8F00">VERDE<sup style="font-size:9px">®</sup>TECH</div>
    <h1>Аналитика</h1>
    <div class="muted">Внутренний дашборд — рассылки, сайт, Академия, спрос</div>
    ${error ? `<div class="err" style="margin-top:12px">${esc(error)}</div>` : ""}
    <input type="password" name="password" placeholder="Пароль" autofocus>
    <button type="submit">Войти</button>
  </form>`);
}

function sources(list, max, cls) {
  const m = Math.max(1, ...list.map((s) => s.visits));
  return list.map((s) => `<div class="src"><div class="lbl"><span>${esc(s.name)}</span><b>${num(s.visits)}</b></div><div class="bw"><span style="width:${Math.round(s.visits / m * 100)}%"></span></div></div>`).join("");
}

function uniSection(u) {
  if (!u || u.error) return `<div class="err">Рассылки: ${esc(u && u.error || "нет данных")}</div>`;
  const k = u.kpi;
  const rows = u.rows.map((r) => {
    const orate = r.delivered ? (r.open * 100 / r.delivered) : 0;
    const cls = orate >= 24 ? "g" : orate < 8 ? "bad" : "";
    return `<tr><td>${esc(r.date.slice(5))}</td><td>${esc(r.subject)}</td><td class="r">${num(r.sent)}</td><td class="r">${num(r.delivered)}</td><td class="r ${cls}">${num(r.open)} (${orate.toFixed(0)}%)</td><td class="r">${num(r.click)}</td><td class="r">${num(r.unsub)}</td></tr>`;
  }).join("");
  return `<h2>📧 Рассылки (Unisender)</h2>
  <div class="kpis">
    <div class="kpi"><div class="v">${num(k.campaigns)}</div><div class="l">рассылок (год)</div></div>
    <div class="kpi"><div class="v">${num(k.sent)}</div><div class="l">писем отправлено</div></div>
    <div class="kpi"><div class="v">${pct(k.deliveryPct)}</div><div class="l">доставлено</div></div>
    <div class="kpi"><div class="v">${pct(k.openPct)}</div><div class="l">ср. открываемость</div></div>
    <div class="kpi"><div class="v">${num(k.unsub)}</div><div class="l">отписок</div></div>
  </div>
  <div class="callout">Сегментированные письма (&lt;700 адр.) открывают <b>${pct(u.segOpen)}</b>, массовые (&ge;700) — <b>${pct(u.massOpen)}</b>. Точный сегмент = выше отклик.</div>
  <div class="tabletall"><table><thead><tr><th>Дата</th><th>Тема</th><th class="r">Отпр.</th><th class="r">Дост.</th><th>Открытия</th><th class="r">Клики</th><th class="r">Отп.</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function metrikaSection(m) {
  if (!m || m.error) return `<div class="err">Метрика: ${esc(m && m.error || "нет данных")}</div>`;
  const domCards = m.domains.map((d) => {
    const isSite = /^verdetech\.ru/.test(d.domain);
    return `<div class="card ${isSite ? "site" : ""}">
      <h3 style="margin:0 0 8px">${isSite ? "🌐 Сайт" : "🎓 Академия"} ${esc(d.domain)}</h3>
      <div class="kpis"><div class="kpi"><div class="v">${num(d.visits)}</div><div class="l">визитов</div></div>
      <div class="kpi"><div class="v">${num(d.users)}</div><div class="l">посетителей</div></div>
      <div class="kpi"><div class="v">${pct(d.bounce)}</div><div class="l">отказы</div></div>
      <div class="kpi"><div class="v">${String(d.time).replace(".", ",")} мин</div><div class="l">время</div></div></div>
      <div style="margin-top:8px" class="muted">Цели: заявки ${num(d.zayavki)} · контакты ${num(d.kontakty)} · PDF ${num(d.pdf)}</div>
      <div style="margin-top:8px">${sources(d.sources)}</div>
    </div>`;
  }).join("");

  const q = m.quality.map((x) => `<tr><td>${esc(x.name)}</td><td class="r">${num(x.visits)}</td><td class="r ${x.bounce <= 15 ? "g" : x.bounce >= 45 ? "bad" : ""}">${x.bounce}%</td><td class="r">${String(x.depth).replace(".", ",")}</td><td class="r">${String(x.time).replace(".", ",")} мин</td><td class="r ${x.zayavki >= 10 ? "g" : ""}">${num(x.zayavki)}</td><td class="r">${num(x.kontakty)}</td><td class="r ${x.pdf >= 10 ? "g" : ""}">${num(x.pdf)}</td></tr>`).join("");

  const trend = m.trend.map((t) => {
    const cells = m.domains.map((d) => { const v = t.byDom[d.domain]; return `<td class="r">${v ? num(v.pv) + " / " + num(v.u) : "—"}</td>`; }).join("");
    return `<tr><td>${esc(t.month)}</td>${cells}</tr>`;
  }).join("");
  const trendHead = m.domains.map((d) => `<th class="r">${esc(d.domain)}</th>`).join("");

  return `<h2>🌐 Сайт и 🎓 Академия (Яндекс.Метрика)</h2>
  <div class="muted" style="margin-bottom:8px">Период: ${esc(m.window.d1)} — ${esc(m.window.d2)}. Один счётчик, разделение по домену.</div>
  <div class="two">${domCards}</div>
  <h3 style="font-size:14px;margin:18px 0 6px">Качество визитов и целевые действия (по источникам)</h3>
  <div class="card"><table><thead><tr><th>Источник</th><th class="r">Виз.</th><th class="r">Отказы</th><th class="r">Глуб.</th><th class="r">Время</th><th class="r">Заявки</th><th class="r">Конт.</th><th class="r">PDF</th></tr></thead><tbody>${q}</tbody></table></div>
  <h3 style="font-size:14px;margin:18px 0 6px">Просмотры по месяцам (просмотры / посетители)</h3>
  <div class="card"><table><thead><tr><th>Месяц</th>${trendHead}</tr></thead><tbody>${trend}</tbody></table></div>`;
}

function wordstatSection(w) {
  if (!w || w.error) return `<div class="err">Wordstat: ${esc(w && w.error || "нет данных")}</div>`;
  const cards = w.phrases.map((p) => {
    const top = p.top.map((t) => `<div class="src"><div class="lbl"><span>${esc(t.phrase)}</span><b>${num(t.count)}</b></div></div>`).join("");
    return `<div class="card"><div style="font-weight:700;color:#0A8F00">«${esc(p.phrase)}»</div><div class="muted">всего показов/мес: ${num(p.total)}</div><div style="margin-top:8px">${top}</div></div>`;
  }).join("");
  return `<h2>🔎 Поисковый спрос (Wordstat, ${esc(w.region)})</h2>
  <div class="callout" style="border-left-color:#f0b400;background:#fff8e6"><b>Важно:</b> это <b>общий поисковый спрос</b> — в основном частные лица (домашние рецепты, «что это»). У Verde рынок <b>B2B</b>: заводы так не ищут. Цифры показывают <b>популярность темы</b> и формулировки, а <b>не число ваших покупателей</b> и не размер B2B-рынка.</div>
  <div class="two">${cards}</div>`;
}

function bitrixSection(b) {
  if (!b || b.error) return `<div class="err">Битрикс24: ${esc(b && b.error || "нет данных")}</div>`;
  const g = b.groups, gl = b.groupLabels;
  const gOrder = ["work", "qual", "deal", "junk", "other"];
  const gMax = Math.max(1, ...gOrder.map((k) => g[k] || 0));
  const funnel = gOrder.filter((k) => g[k]).map((k) => {
    const cls = k === "deal" ? "g" : k === "junk" ? "" : "";
    const color = k === "deal" ? "#0FBF00" : k === "junk" ? "#c0392b" : k === "work" ? "#2f7be0" : "#f0b400";
    return `<div class="src"><div class="lbl"><span>${esc(gl[k] || k)}</span><b>${num(g[k])}</b></div><div class="bw"><span style="width:${Math.round(g[k] / gMax * 100)}%;background:${color}"></span></div></div>`;
  }).join("");

  const sMax = Math.max(1, ...b.sources.map((s) => s.count));
  const srcBars = b.sources.map((s) => `<div class="src"><div class="lbl"><span>${esc(s.name)}</span><b>${num(s.count)}</b></div><div class="bw"><span style="width:${Math.round(s.count / sMax * 100)}%"></span></div></div>`).join("");

  const stRows = b.stages.map((s) => `<tr><td>${esc(s.name)}</td><td class="r">${num(s.count)}</td></tr>`).join("");
  const moMax = Math.max(1, ...b.months.map((m) => m.count));
  const moBars = b.months.map((m) => `<div class="src"><div class="lbl"><span>${esc(m.month)}</span><b>${num(m.count)}</b></div><div class="bw"><span style="width:${Math.round(m.count / moMax * 100)}%"></span></div></div>`).join("");

  return `<h2>📥 Битрикс24 — что происходит с лидами</h2>
  <div class="kpis">
    <div class="kpi"><div class="v">${num(b.total)}</div><div class="l">всего лидов в CRM</div></div>
    <div class="kpi"><div class="v">${num(b.dealsCreated)}</div><div class="l">сделок создано</div></div>
    <div class="kpi"><div class="v">${pct(b.convRate)}</div><div class="l">лид → сделка</div></div>
    <div class="kpi"><div class="v">${num(b.calls)}</div><div class="l">из звонков</div></div>
    <div class="kpi"><div class="v">${num(b.email)}</div><div class="l">из рассылок/почты</div></div>
  </div>
  <div class="callout"><b>Куда уходят письма?</b> В Битриксе как источник «Рассылка»/«Почта» помечено всего <b>${num(b.email)}</b> лидов из ${num(b.total)} (${pct(b.total ? +(b.email * 100 / b.total).toFixed(1) : 0)}). Поток ведут <b>звонки</b> (${num(b.calls)}) и лиды <b>без указанного источника</b> (${num(b.noSource)}). Поэтому проследить «письмо → сделка» прямо в CRM сейчас нельзя — у большинства лидов источник не проставлен. Это <b>точка роста</b>: тегировать лиды из рассылок (UTM/источник), тогда вклад email станет виден.</div>
  <div class="two">
    <div><h3 style="font-size:14px;margin:6px 0 8px">Стадии воронки (по группам)</h3><div class="card">${funnel}</div></div>
    <div><h3 style="font-size:14px;margin:6px 0 8px">Источники лидов (топ-12)</h3><div class="card">${srcBars}</div></div>
  </div>
  <div class="two">
    <div><h3 style="font-size:14px;margin:6px 0 8px">Новые лиды по месяцам</h3><div class="card">${moBars}</div></div>
    <div><h3 style="font-size:14px;margin:6px 0 8px">Все стадии (детально)</h3><div class="card" style="max-height:340px;overflow:auto"><table><thead><tr><th>Стадия</th><th class="r">Лидов</th></tr></thead><tbody>${stRows}</tbody></table></div></div>
  </div>`;
}

function pultSection(p) {
  if (!p || p.error) return `<div class="err">Пульт продаж: ${esc(p && p.error || "нет данных")}</div>`;
  const r = (m) => `<tr><td>${esc(m.name)}</td><td class="r">${num(m.comps)}</td><td class="r">${num(m.leads)}</td><td class="r">${num(m.deals)}</td><td class="r">${num(m.prog)}</td><td class="r g">${num(m.won)}</td><td class="r">${num(m.wonSum)} ₽</td><td class="r">${m.conv}%</td><td class="r">${num(m.created30)}</td><td class="r ${m.stale > 30 ? "bad" : ""}">${esc(m.last)}</td></tr>`;
  const head = `<tr><th>Менеджер</th><th class="r">Комп.</th><th class="r">Лиды</th><th class="r">Сделки</th><th class="r">В работе</th><th class="r">Выигр.</th><th class="r">Сумма</th><th class="r">Конв.</th><th class="r">Созд/30д</th><th class="r">Посл. сделка</th></tr>`;
  return `<h2>📊 Пульт отдела продаж (Битрикс24)</h2>
  <div class="kpis">
    <div class="kpi"><div class="v">${num(p.teamWon)}</div><div class="l">выигранных сделок</div></div>
    <div class="kpi"><div class="v">${num(p.teamWonSum)} ₽</div><div class="l">сумма выигранных (из Б24)</div></div>
    <div class="kpi"><div class="v">${num(p.teamProg)}</div><div class="l">сделок в работе</div></div>
    <div class="kpi"><div class="v">${num(p.onDeparted)}</div><div class="l">компаний на уволенных</div></div>
  </div>
  <div class="callout" style="border-left-color:#c0392b;background:#fff4f4"><b>Прогресс наведения порядка:</b> на уволенных ещё <b>${num(p.onDeparted)}</b> компаний и <b>${num(p.dealsOnDeparted)}</b> сделок — цель довести до 0 по живым клиентам. Эта цифра должна падать каждую неделю.</div>
  <h3 style="font-size:14px;margin:14px 0 6px">Действующая команда</h3>
  <div class="card"><table><thead>${head}</thead><tbody>${p.team.map(r).join("")}</tbody></table></div>
  <div class="callout">«Конв.» = выигранные ÷ (выигр.+проигр.). «Созд/30д» = новых сделок за месяц (активность). «Посл. сделка» красным = >30 дней не трогал сделки. Суммы — из поля сделки в Б24, могут отличаться от 1С.</div>
  <h3 style="font-size:14px;margin:14px 0 6px">⚠️ Клиенты на уволенных (ждут передачи)</h3>
  <div class="card"><table><thead>${head}</thead><tbody>${p.departed.map(r).join("")}</tbody></table></div>`;
}

function summarySection(d) {
  const u = d.unisender, m = d.metrika;
  const k = [];
  if (u && !u.error) k.push(`<div class="kpi"><div class="v">${pct(u.kpi.openPct)}</div><div class="l">открываемость писем</div></div>`);
  if (m && !m.error) {
    const tv = m.domains.reduce((a, b) => a + b.visits, 0);
    const tz = m.domains.reduce((a, b) => a + b.zayavki, 0);
    k.push(`<div class="kpi"><div class="v">${num(tv)}</div><div class="l">визитов (45 дн.)</div></div>`);
    k.push(`<div class="kpi"><div class="v">${num(tz)}</div><div class="l">заявок (45 дн.)</div></div>`);
  }
  if (u && !u.error) k.push(`<div class="kpi"><div class="v">${num(u.kpi.campaigns)}</div><div class="l">рассылок за год</div></div>`);
  const b = d.bitrix;
  if (b && !b.error) {
    k.push(`<div class="kpi"><div class="v">${num(b.total)}</div><div class="l">лидов в Битриксе</div></div>`);
    k.push(`<div class="kpi"><div class="v">${num(b.dealsCreated)}</div><div class="l">сделок создано</div></div>`);
  }
  return `<h2>📊 Сводная</h2><div class="kpis">${k.join("")}</div>`;
}

function dashboard(d) {
  const when = new Date(d.generatedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
  return shell(`<div class="head"><div class="wrap" style="padding:0">
      <div class="wm">VERDE<sup>®</sup>TECH</div><h1>Аналитика</h1>
      <div class="sub">Рассылки · Сайт · Академия · Спрос</div>
      <div class="bar"><span class="muted" style="color:#eafbe9">Данные на ${esc(when)} (МСК) · кэш ~1 час</span>
      <span><a class="btn" href="/refresh">↻ Обновить</a> <a class="btn" href="/logout">Выйти</a></span></div>
    </div></div>
    <div class="wrap">
      ${summarySection(d)}
      ${pultSection(d.salesPult)}
      ${uniSection(d.unisender)}
      ${bitrixSection(d.bitrix)}
      ${metrikaSection(d.metrika)}
      ${wordstatSection(d.wordstat)}
      <div class="foot">Verde · внутренний дашборд аналитики. Источники: Unisender API, Яндекс.Метрика (счётчик ${esc(process.env.YANDEX_METRIKA_COUNTER || "108760527")}), Yandex Wordstat (облако). Все цифры фактические.</div>
    </div>`);
}

module.exports = { shell, loginPage, dashboard };
