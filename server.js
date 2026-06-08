"use strict";
const http = require("http");
const crypto = require("crypto");
const { getData } = require("./lib/data");
const { loginPage, dashboard, shell } = require("./lib/render");

const PORT = process.env.PORT || 3000;
const PASSWORD = process.env.DASH_PASSWORD || "verde2026";
const TOKEN = crypto.createHash("sha256").update("verde-dash:" + PASSWORD).digest("hex");

function cookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
const authed = (req) => cookies(req)["verde_auth"] === TOKEN;
function send(res, code, body, headers) { res.writeHead(code, Object.assign({ "Content-Type": "text/html; charset=utf-8" }, headers || {})); res.end(body); }
function redirect(res, to, headers) { res.writeHead(302, Object.assign({ Location: to }, headers || {})); res.end(); }

function readBody(req) {
  return new Promise((resolve) => { let d = ""; req.on("data", (c) => (d += c)); req.on("end", () => resolve(d)); });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;

    if (path === "/login" && req.method === "POST") {
      const body = await readBody(req);
      const pwd = new URLSearchParams(body).get("password") || "";
      if (pwd === PASSWORD) return redirect(res, "/", { "Set-Cookie": `verde_auth=${TOKEN}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax` });
      return send(res, 401, loginPage("Неверный пароль"));
    }
    if (path === "/logout") return redirect(res, "/", { "Set-Cookie": "verde_auth=; Path=/; Max-Age=0" });

    if (!authed(req)) return send(res, 200, loginPage(""));

    if (path === "/refresh") {
      await getData(true);
      return redirect(res, "/");
    }
    if (path === "/" ) {
      const data = await getData(false);
      return send(res, 200, dashboard(data));
    }
    if (path === "/health") return send(res, 200, "ok", { "Content-Type": "text/plain" });
    return send(res, 404, shell(`<div class="wrap"><h2>404</h2><a href="/">На главную</a></div>`));
  } catch (e) {
    return send(res, 500, shell(`<div class="wrap"><div class="err" style="margin-top:40px">Ошибка: ${String(e.message || e)}</div><p><a href="/refresh">Попробовать обновить</a></p></div>`));
  }
});

server.listen(PORT, () => console.log("Verde dashboard on :" + PORT));
