#!/usr/bin/env node
/**
 * Local dev server for the Love Ma'at site.
 *
 * Zero dependencies — the site itself has none, and a dev server is not a
 * reason to add a node_modules tree. Node's own http + fs is enough.
 *
 * What it does that `python -m http.server` doesn't:
 *   - sends Cache-Control: no-store, so an edited stylesheet actually shows up
 *     instead of being served from the browser's memory cache
 *   - live-reloads on change over SSE
 *   - swaps CSS in place rather than reloading, so you keep your scroll
 *     position while tweaking styles
 *
 *   node tools/dev.mjs [--port 5173] [--root .] [--no-reload] [--open]
 */

import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ── args ───────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")
    ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const ROOT = path.resolve(flag("root", path.join(HERE, "..")));
const START_PORT = Number(flag("port", process.env.PORT || 5173));
const RELOAD = !has("no-reload");
const OPEN = has("open");

/* Directories that should never trigger a reload. brand/ holds multi-megabyte
   masters; touching one should not refresh the page. */
const IGNORED = new Set([".git", "node_modules", "brand", "scrollcraft", ".claude"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
};

/* ── live-reload client, injected into HTML only ────────────────────────── */
const CLIENT = `
<script data-dev-reload>
(function () {
  var es = new EventSource("/__dev/stream");
  var badge;

  function flash(text, colour) {
    if (!badge) {
      badge = document.createElement("div");
      badge.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:2147483647;" +
        "font:600 11px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.08em;" +
        "text-transform:uppercase;padding:7px 11px;border-radius:100px;color:#fff;" +
        "pointer-events:none;opacity:0;transition:opacity .18s";
      document.body.appendChild(badge);
    }
    badge.textContent = text;
    badge.style.background = colour;
    badge.style.opacity = "1";
    clearTimeout(badge._t);
    badge._t = setTimeout(function () { badge.style.opacity = "0"; }, 900);
  }

  es.addEventListener("change", function (e) {
    var file = "";
    try { file = JSON.parse(e.data).file || ""; } catch (_) {}

    /* A stylesheet edit doesn't need a reload — re-point the <link> and keep
       the scroll position, which matters when the thing you're tweaking is
       two thirds of the way down the page. */
    if (/\\.css$/i.test(file)) {
      var links = document.querySelectorAll('link[rel="stylesheet"]');
      var swapped = 0;
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute("href") || "";
        if (/^https?:/i.test(href)) continue;
        links[i].setAttribute("href", href.split("?")[0] + "?v=" + Date.now());
        swapped++;
      }
      if (swapped) { flash("css updated", "#D4399A"); return; }
    }
    location.reload();
  });

  es.addEventListener("hello", function () { flash("live reload on", "#8A97FE"); });
  es.onerror = function () { /* server restarting; EventSource retries itself */ };
})();
</script>
`;

/* ── SSE plumbing ───────────────────────────────────────────────────────── */
const clients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

/* ── file watching ──────────────────────────────────────────────────────── */
let debounce = null;
let pending = null;

function watch() {
  try {
    fs.watch(ROOT, { recursive: true }, (_type, filename) => {
      if (!filename) return;
      const rel = filename.toString().replace(/\\/g, "/");
      if (rel.split("/").some((seg) => IGNORED.has(seg))) return;
      if (/(^|\/)[._]|~$|\.tmp$|\.swp$/.test(rel)) return;

      pending = rel;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log(`  ~ ${pending}`);
        broadcast("change", { file: pending });
        pending = null;
      }, 60);
    });
  } catch (err) {
    console.error("  ! could not watch for changes:", err.message);
    console.error("    the server still works; you'll just need to refresh.");
  }
}

/* ── request handling ───────────────────────────────────────────────────── */
async function send(res, status, body, type, extra = {}) {
  res.writeHead(status, {
    "Content-Type": type,
    /* the whole point: never let the browser hand back a stale stylesheet */
    "Cache-Control": "no-store, must-revalidate",
    ...extra,
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/__dev/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("retry: 500\n\n");
    res.write('event: hello\ndata: {}\n\n');
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  /* keep the request inside ROOT — no ../../ escapes */
  const target = path.resolve(ROOT, "." + pathname);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  }

  let file = target;
  try {
    const stat = await fsp.stat(file);
    if (stat.isDirectory()) file = path.join(file, "index.html");
  } catch {
    /* bare path with no extension: try .html before giving up */
    if (!path.extname(file)) {
      try { await fsp.access(file + ".html"); file += ".html"; } catch {}
    }
  }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";

  try {
    let body = await fsp.readFile(file);

    if (RELOAD && ext === ".html") {
      const html = body.toString("utf8");
      body = html.includes("</body>")
        ? html.replace(/<\/body>/i, CLIENT + "</body>")
        : html + CLIENT;
    }

    await send(res, 200, body, type);
    if (ext === ".html") console.log(`  200 ${pathname}`);
  } catch {
    console.log(`  404 ${pathname}`);
    await send(res, 404, `<!doctype html><meta charset="utf-8">
<title>404</title>
<style>body{font:15px/1.6 ui-sans-serif,system-ui,sans-serif;color:#160F1D;
background:#FBF7FC;display:grid;place-items:center;height:100vh;margin:0}
code{background:#EDE7F0;padding:.15em .4em;border-radius:5px}
a{color:#D4399A}</style>
<div><h1 style="margin:0 0 .4em">404</h1>
<p><code>${pathname.replace(/[<&]/g, "")}</code> is not in the project.</p>
<p><a href="/">Back to the site</a></p></div>`, "text/html; charset=utf-8");
  }
});

/* ── listen, stepping past a busy port ──────────────────────────────────── */
function listen(port, attempt = 0) {
  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt < 12) {
      console.log(`  port ${port} busy, trying ${port + 1}`);
      return listen(port + 1, attempt + 1);
    }
    console.error("  ! " + err.message);
    process.exit(1);
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log("");
    console.log("  Love Ma'at — dev server");
    console.log("  " + url);
    console.log(`  serving ${ROOT}`);
    console.log(`  live reload ${RELOAD ? "on" : "off"} · cache disabled`);
    console.log("  ctrl+c to stop");
    console.log("");
    if (RELOAD) watch();
    if (OPEN) {
      const cmd = process.platform === "win32" ? "explorer"
        : process.platform === "darwin" ? "open" : "xdg-open";
      spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
    }
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    for (const res of clients) { try { res.end(); } catch {} }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 300);
  });
}

listen(START_PORT);
