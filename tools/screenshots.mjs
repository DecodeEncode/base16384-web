// Captures images/*.png from the web app over the DevTools protocol.
// Starts its own headless browser with a throwaway profile and its own
// static server; nothing else is touched. No dependencies.
//
//   BROWSER=/path/to/browser node tools/screenshots.mjs
//
// SPDX-License-Identifier: Apache-2.0
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BROWSER = process.env.BROWSER;
const CHECKS_ONLY = process.argv.includes("--checks-only");
if (!BROWSER) {
  console.error("Set BROWSER to a headless-capable browser binary that speaks the DevTools protocol.");
  process.exit(2);
}

// name, width, height, URL fragment (state keys in assets/app.js), [page, pixel ratio, action, wait-for]
// Names starting with "check:" are only loaded and checked (no script errors, no sideways scroll,
// and the optional expectation, a JavaScript expression, must be true). `--checks-only` skips the images.
const RUN_BENCH = "document.getElementById('bench-run').click()";
const BENCH_DONE = "document.documentElement.dataset.benchDone === '1'";
const SCENES = [
  ["og", 1200, 630, "", "tools/og-card.html", 1],
  ["encode", 1280, 860, "lang=en&theme=light&preset=hello&pick=%E5%A9%8C"],
  ["binary", 1280, 1000, "lang=en&theme=dark&preset=binary"],
  ["damaged", 1280, 860, "lang=ja&theme=light&preset=damaged"],
  ["bench", 1280, 900, "lang=en&theme=light&tab=bench", "", 2, RUN_BENCH, BENCH_DONE],
  ["alphabet", 1280, 980, "lang=ja&theme=dark&tab=alphabet&q=12345"],
  ["check:320-work", 320, 700, "lang=ja&preset=damaged"],
  ["check:encode", 1280, 800, "lang=en&kind=text&in=12345678", "", 1, null, null, "document.getElementById('output').textContent === '婌焳廔萷尀㴁'"],
  ["check:decode", 1280, 800, "lang=en&mode=decode&in=%E5%A9%8C%E7%84%B3%E5%BB%94%E8%90%B7%E5%B0%80%E3%B4%81", "", 1, null, null, "document.getElementById('output').textContent === '12345678'"],
  ["check:damaged", 1280, 800, "lang=en&preset=damaged", "", 1, null, null, "document.querySelector('#problems').textContent.includes('U+FFFD') && !!document.querySelector('.output .bad')"],
  ["check:lenient", 1280, 800, "lang=en&preset=damaged", "", 1, "document.getElementById('lenient').click()",
    "document.getElementById('lenient').checked", "Number([...document.querySelectorAll('#stats dd')].at(-1).textContent) >= 1 && !document.querySelector('.output .bad')"],
  ["check:alphabet-search", 1280, 800, "lang=en&tab=alphabet&q=U%2B8DFF", "", 1, null, null, "document.getElementById('page').value === '63' && document.querySelector('#alpha-inspector .big').textContent === '\u8dff'"],
  ["check:bench", 1280, 800, "lang=en&tab=bench", "", 1, RUN_BENCH, BENCH_DONE, "document.querySelectorAll('#bench-results tbody tr').length === 6"],
  ["check:api", 800, 600, "", "api/?op=encode&text=12345678", 1, null, "document.documentElement.dataset.status === 'ok'", "JSON.parse(document.getElementById('out').textContent).output === '婌焳廔萷尀㴁'"],
  ["check:320-binary", 320, 700, "lang=en&preset=binary"],
  ["check:320-bench", 320, 700, "lang=en&tab=bench"],
  ["check:320-alphabet", 320, 700, "lang=ja&tab=alphabet"],
  ["phone", 390, 1000, "lang=ja&theme=light&preset=binary"],
];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, path);
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!file.startsWith(ROOT) || !existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});

const profile = mkdtempSync(join(tmpdir(), "kanji1024-shots-"));
let browser, ws;

try {
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}/`;

  browser = spawn(BROWSER, [
    "--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars",
    "--font-render-hinting=none", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl = await new Promise((ok, fail) => {
    let err = "";
    const timer = setTimeout(() => fail(new Error("browser did not start:\n" + err)), 20000);
    browser.stderr.on("data", (d) => {
      err += d;
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); ok(m[1]); }
    });
    browser.on("exit", (c) => fail(new Error(`browser exited (${c}):\n${err}`)));
  });

  ws = new WebSocket(wsUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
  let id = 0;
  const pending = new Map();
  const pageErrors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails);
    if (m.id && pending.has(m.id)) {
      const { ok, fail } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? fail(new Error(JSON.stringify(m.error))) : ok(m.result);
    }
  };
  const send = (method, params = {}, sessionId) => new Promise((ok, fail) => {
    const n = ++id;
    pending.set(n, { ok, fail });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId && { sessionId }) }));
  });

  for (const [name, width, height, state, page = "", scale = 2, action, waitFor, expect] of SCENES) {
    if (CHECKS_ONLY && !name.startsWith("check:")) continue;
    const { targetId } = await send("Target.createTarget", { url: "about:blank", newWindow: false });
    try {
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      const s = (m, p) => send(m, p, sessionId);
      await s("Runtime.enable");
      await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: width < 600 });
      await s("Page.navigate", { url: `${base}${page}#${state}` });
      const deadline = Date.now() + 15000;
      for (;;) {
        const r = await s("Runtime.evaluate", { expression: "(document.documentElement.dataset.ready === '1' || !!document.documentElement.dataset.status) && document.fonts.status === 'loaded'", returnByValue: true });
        if (r.result.value) break;
        if (Date.now() > deadline) throw new Error(`${name}: page never became ready`);
        await new Promise((r) => setTimeout(r, 100));
      }
      if (action || waitFor) {
        if (action) await s("Runtime.evaluate", { expression: action });
        const until = Date.now() + 120000;
        while (!(await s("Runtime.evaluate", { expression: waitFor, returnByValue: true })).result.value) {
          if (Date.now() > until) throw new Error(`${name}: action never finished`);
          await new Promise((r) => setTimeout(r, 250));
        }
        await s("Runtime.evaluate", { expression: "window.scrollTo(0, 0)" });
      }
      const over = await s("Runtime.evaluate", { expression: "document.documentElement.scrollWidth - innerWidth", returnByValue: true });
      if (over.result.value > 0) throw new Error(`${name}: page scrolls sideways by ${over.result.value}px at ${width}px wide`);
      if (pageErrors.length) throw new Error(`${name}: ${JSON.stringify(pageErrors[0].exception?.description ?? pageErrors[0].text)}`);
      if (expect && !(await s("Runtime.evaluate", { expression: expect, returnByValue: true })).result.value) {
        throw new Error(`${name}: expectation failed: ${expect}`);
      }
      if (name.startsWith("check:")) { console.log(`${name}  ok`); continue; }
      const { data } = await s("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(ROOT, "images", `${name}.png`), Buffer.from(data, "base64"));
      console.log(`images/${name}.png  ${width}×${height}`);
    } finally {
      await send("Target.closeTarget", { targetId }).catch(() => {});
    }
  }
  await send("Browser.close").catch(() => {});
} finally {
  ws?.close();
  if (browser && browser.exitCode === null) {
    browser.kill();
    await new Promise((r) => browser.once("exit", r));
  }
  server.close();
  rmSync(profile, { recursive: true, force: true });
}
