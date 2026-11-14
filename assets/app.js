// base16384 web. No dependencies; nothing leaves the page.
// SPDX-License-Identifier: AGPL-3.0-or-later
import { encode, decodeDetailed, DecodeError, toUTF16BE, readText, VERSION as LIB_VERSION, BASE, MARK } from "../vendor/base16384.mjs";

export const VERSION = "1.0.0";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const utf8 = new TextEncoder();
const RENDER_LIMIT = 20000;  // characters drawn one by one; beyond this, plain text
const HASH_LIMIT = 4000;     // longest input kept in the address bar
const MAP_ROWS = 256;        // byte map: at most 256 rows (64 KiB at 256 bytes per row)

// ── words ───────────────────────────────────────────────────────────────────
const STR = {
  en: {
    skip: "Skip to the workbench", tagline: "any data as printable text, fourteen bits per character",
    theme: "Theme", themeAuto: "Auto", themeLight: "Light", themeDark: "Dark", sections: "Sections",
    tabWork: "Workbench", tabBench: "Benchmark", tabAlphabet: "Alphabet", direction: "Direction",
    encode: "Encode", decode: "Decode", swap: "Swap",
    tryLabel: "Try", presetHello: "text", presetBinary: "structured binary", presetDamaged: "a damaged copy",
    input: "Input", output: "Output", clear: "Clear", kindLabel: "Input kind", viewLabel: "Show decoded bytes as",
    kindText: "Text (UTF-8)", kindHex: "Hex", kindBase64: "Base64", kindFile: "File",
    fileChoose: "Choose a file", fileHint: "…or drop one here. Files are read in this page and never uploaded.", fileNone: "No file chosen.",
    copy: "Copy", download: "Download", share: "Link", outKeys: "Use the arrow keys to inspect each character.",
    encOpts: "Encoding", decOpts: "Decoding", dispOpts: "Display",
    optWrap: "Line width", noWrap: "no line breaks",
    optWrapHint: "Line breaks are for reading only. This page ignores them, but the reference tool does not, so download without them for that tool.",
    optFile: "Download as", fmtBom: "UTF-16BE + BOM", fmtNoBom: "UTF-16BE, no BOM", fmtUtf8: "UTF-8 text",
    optFileHint: "The reference tool writes UTF-16BE with a byte order mark, or without one when run with -n.", barHead: "chart, {size}",
    optLenient: "Forgiving", optLenientHint: "Skip characters that do not belong and decode what is complete, reporting each problem instead of stopping.",
    optShade: "Tint characters by value", optShadeHint: "Equal byte patterns get equal colours, so repetition stands out.",
    inspector: "Inspector", inspectHint: "Point at or tap a character to inspect it.",
    phText: "Type or paste text…", phHex: "48 65 6c 6c 6f — spaces, colons and 0x are ignored", phBase64: "SGVsbG8= — standard or URL-safe",
    phDecode: "Paste base16384 text, or drop a file from the reference tool. Spaces and line breaks are ignored.",
    hintFileDecoded: "Read a file as {enc}.",
    emptyEncode: "The encoded text appears here.", emptyDecode: "The decoded bytes appear here.",
    sBytes: "bytes in", sChars: "characters", sUtf16: "UTF-16 file", sUtf8: "UTF-8 bytes", sB64: "base64 chars", sRound: "round trip",
    sRead: "characters read", sOut: "bytes out", sWarn: "warnings", yes: "verified", no: "failed", bytesUnit: "B",
    mapLabel: "Byte map", mapCaption: "Byte map: one square per byte, {cols} per row, white is 00 and black is FF.",
    mapCaptionCut: "Byte map of the first {kib} KiB: one square per byte, {cols} per row, white is 00 and black is FF.",
    iValue: "Value", iHex: "Hex", iBits: "Bits", iCode: "Code point", iRole: "Role",
    roleData: "data", roleEnd: "end marker: the last group holds {n} byte(s)", roleZero: "accepted end marker for a whole number of groups",
    copied: "Copied.", copyFail: "Could not copy; select the text instead.", linkCopied: "Link copied.",
    linkLong: "Link copied without the input (too long for an address).",
    notText: "These bytes are not valid UTF-8 text, so they are shown as hex.", tooLarge: "Large output: shown as plain text without per-character inspection.",
    badHex: "Hex digits come in pairs of 0–9 and a–f.", badB64: "That is not valid base64.",
    err_foreign: "{c} is not a base16384 character.", "err_no-end": "The last group is incomplete and has no end marker; the text may be cut short.",
    "err_bad-end": "The end marker does not match the characters before it.", "err_after-end": "Something follows the end marker.",
    errAt: "at character {n}", lenientTip: "Turn on “Forgiving” to read past this.",
    benchLede: "Measures how fast this browser encodes and decodes random data, next to its own base64 and hex. It runs in a background worker, so the page stays responsive. Results depend on the device and are not sent anywhere.",
    benchSizes: "Sizes", benchQuick: "quick (1 KiB – 1 MiB)", benchFull: "full (1 KiB – 16 MiB)", benchRun: "Run benchmark", benchCopy: "Copy results",
    benchRunning: "Measuring {op} at {size}…", benchDone: "Done in {s} s.", benchNoWorker: "This browser cannot run module workers.",
    colOp: "Operation", colSpeed: "MB/s", builtin: "built-in", jsFallback: "JavaScript fallback", benchUnit: "MB/s of binary data, higher is faster",
    alphaLede: "16384 characters, U+4E00 to U+8DFF, one for each 14-bit value, shown 256 at a time. Six end markers, U+3D01 to U+3D06, record the length of a short last group.",
    page: "Page", prev: "Previous page", next: "Next page", alphaSearch: "Value, character or U+code", alphaSearchLabel: "Find a value, character or code point",
    markers: "End markers", pageRange: "values {a}–{b}",
    footer: "Runs entirely in your browser; nothing you enter or drop is sent anywhere. base16384 is a notation, not encryption. This is an independent, unofficial tool, not affiliated with the authors of the base16384 format.",
    source: "Source code", engine: "Encoder: base16384-js (Apache-2.0)", formatBy: "base16384 format by Fumiama Minamoto",
  },
  ja: {
    skip: "ワークベンチへ移動", tagline: "あらゆるデータを、1字14ビットの印字可能な文字列に",
    theme: "表示", themeAuto: "自動", themeLight: "ライト", themeDark: "ダーク", sections: "セクション",
    tabWork: "変換", tabBench: "ベンチマーク", tabAlphabet: "字表", direction: "変換の向き",
    encode: "符号化", decode: "復号", swap: "入れ替え",
    tryLabel: "例", presetHello: "テキスト", presetBinary: "構造のあるバイナリ", presetDamaged: "壊れた写し",
    input: "入力", output: "出力", clear: "消去", kindLabel: "入力の種類", viewLabel: "復号結果の表示形式",
    kindText: "テキスト（UTF-8）", kindHex: "16進", kindBase64: "Base64", kindFile: "ファイル",
    fileChoose: "ファイルを選ぶ", fileHint: "またはここへドロップ。ファイルはこのページ内で読み、送信しません。", fileNone: "ファイル未選択",
    copy: "コピー", download: "保存", share: "リンク", outKeys: "矢印キーで1字ずつ詳細を表示します。",
    encOpts: "符号化", decOpts: "復号", dispOpts: "表示",
    optWrap: "行の幅", noWrap: "改行しない",
    optWrapHint: "改行は読みやすさのためだけです。このページは無視しますが、本家のツールは無視しないので、本家で使うなら改行なしで保存してください。",
    optFile: "保存形式", fmtBom: "UTF-16BE＋BOM", fmtNoBom: "UTF-16BE・BOMなし",
    optFileHint: "本家ツールはUTF-16BEをBOM付きで書き出します（-n指定時はBOMなし）。", barHead: "グラフ（{size}）", fmtUtf8: "UTF-8テキスト",
    optLenient: "寛容に読む", optLenientHint: "余計な字を読み飛ばし、そろっている部分だけを復号します。問題は止めずに一覧します。",
    optShade: "値で色分け", optShadeHint: "同じバイト列は同じ色になり、繰り返しが目立ちます。",
    inspector: "詳細", inspectHint: "文字を指すかタップすると詳細を表示します。",
    phText: "文字を入力または貼り付け…", phHex: "48 65 6c 6c 6f — 空白・コロン・0xは無視", phBase64: "SGVsbG8= — 標準形・URL安全形",
    phDecode: "base16384の文字列を貼り付けるか、本家ツールのファイルをドロップ。空白と改行は無視されます。",
    hintFileDecoded: "ファイルを{enc}として読みました。",
    emptyEncode: "ここに符号化した文字列が出ます。", emptyDecode: "ここに復号したバイト列が出ます。",
    sBytes: "入力バイト", sChars: "文字数", sUtf16: "UTF-16ファイル", sUtf8: "UTF-8バイト", sB64: "Base64字数", sRound: "往復確認",
    sRead: "読んだ文字数", sOut: "出力バイト", sWarn: "警告", yes: "成功", no: "失敗", bytesUnit: "B",
    mapLabel: "バイトマップ", mapCaption: "バイトマップ：1バイト1マス、1行{cols}バイト。00が白、FFが黒。",
    mapCaptionCut: "先頭{kib}KiBのバイトマップ：1バイト1マス、1行{cols}バイト。00が白、FFが黒。",
    iValue: "値", iHex: "16進", iBits: "ビット", iCode: "符号位置", iRole: "役割",
    roleData: "データ", roleEnd: "終端マーク：最後のグループは{n}バイト", roleZero: "グループ数ちょうどを示す終端マーク（読み込み時のみ受理）",
    copied: "コピーしました。", copyFail: "コピーできません。文字を選択してください。", linkCopied: "リンクをコピーしました。",
    linkLong: "入力が長すぎるため、入力を含まないリンクをコピーしました。",
    notText: "UTF-8のテキストではないため、16進で表示しています。", tooLarge: "出力が大きいため、1字ずつの詳細表示なしで表示しています。",
    badHex: "16進は0〜9とa〜fの2桁ずつで書きます。", badB64: "Base64として正しくありません。",
    err_foreign: "{c} はbase16384の文字ではありません。", "err_no-end": "最後のグループが不完全で、終端マークがありません。途中で切れている可能性があります。",
    "err_bad-end": "終端マークが、その前の文字数と合いません。", "err_after-end": "終端マークの後に何かがあります。",
    errAt: "{n}字目", lenientTip: "「寛容に読む」をオンにすると先へ進めます。",
    benchLede: "このブラウザがランダムなデータを符号化・復号する速さを、ブラウザ自身のBase64・16進と並べて測ります。バックグラウンドのワーカーで動くので、ページは固まりません。結果は端末によって変わり、どこにも送信しません。",
    benchSizes: "サイズ", benchQuick: "簡易（1 KiB〜1 MiB）", benchFull: "全部（1 KiB〜16 MiB）", benchRun: "計測する", benchCopy: "結果をコピー",
    benchRunning: "{size}の{op}を計測中…", benchDone: "{s}秒で完了。", benchNoWorker: "このブラウザはモジュールワーカーを実行できません。",
    colOp: "処理", colSpeed: "MB/s", builtin: "内蔵", jsFallback: "JavaScript代替", benchUnit: "バイナリデータのMB/s。大きいほど速い",
    alphaLede: "U+4E00からU+8DFFまでの16384字。14ビットの値1つに1字が対応し、256字ずつ表示します。U+3D01〜U+3D06の6つの終端マークは、最後の短いグループの長さを表します。",
    page: "ページ", prev: "前のページ", next: "次のページ", alphaSearch: "値・文字・U+コード", alphaSearchLabel: "値・文字・符号位置で検索",
    markers: "終端マーク", pageRange: "値 {a}〜{b}",
    footer: "ブラウザ内だけで動作し、入力やドロップしたものはどこにも送信しません。base16384は表記法であり、暗号ではありません。本ツールは非公式の独立したツールで、base16384形式の作者とは無関係です。",
    source: "ソースコード", engine: "エンコーダ：base16384-js（Apache-2.0）", formatBy: "base16384形式の作者：Fumiama Minamoto",
  },
};

// ── state ───────────────────────────────────────────────────────────────────
const DEFAULTS = {
  tab: "work", mode: "encode", kind: "text", in: "", wrap: 0, fmt: "utf16bom", lenient: false, view: "text",
  shade: false, page: 0, q: "", lang: "", theme: "", pick: "", sizes: "quick",
};
const S = { ...DEFAULTS };
let fileBytes = null, fileName = "", fileEnc = "";
let lastOut = { text: "", bytes: null };

const store = {
  get(k) { try { return localStorage.getItem("b14web." + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem("b14web." + k, v); } catch { /* private mode */ } },
};
function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const k of Object.keys(DEFAULTS)) {
    if (!p.has(k)) continue;
    const v = p.get(k), d = DEFAULTS[k];
    S[k] = typeof d === "boolean" ? v === "1" : typeof d === "number" ? Number(v) || 0 : v;
  }
}
function writeHash() {
  const p = new URLSearchParams();
  for (const [k, d] of Object.entries(DEFAULTS)) {
    const v = S[k];
    if (k === "in" && (S.kind === "file" || v.length > HASH_LIMIT)) continue;
    if (k === "lang" || k === "theme" || v === d) continue;
    p.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  const h = p.toString();
  history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
}
const lang = () => (S.lang === "ja" ? "ja" : "en");
const t = (key, vars = {}) => (STR[lang()][key] ?? STR.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

// ── helpers ─────────────────────────────────────────────────────────────────
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
function toB64(b) {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromHex(s) {
  const c = s.replace(/0x/gi, "").replace(/[\s:,-]/g, "");
  if (!/^(?:[0-9a-f]{2})*$/i.test(c)) throw new Error(t("badHex"));
  return Uint8Array.from(c.match(/../g) || [], (h) => parseInt(h, 16));
}
function fromB64(s) {
  let c = s.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  c += "=".repeat((4 - (c.length % 4)) % 4);
  try { return Uint8Array.from(atob(c), (x) => x.charCodeAt(0)); } catch { throw new Error(t("badB64")); }
}
const equalBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
const cp = (c) => "U+" + c.toString(16).toUpperCase().padStart(4, "0");
const fmtBytes = (n) => n.toLocaleString(lang() === "ja" ? "ja" : "en");
function toast(msg) {
  const n = $("#toast");
  n.textContent = msg;
  n.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => n.classList.remove("show"), 1800);
}

/** What a UTF-16 code unit is in this format. */
function describe(code) {
  if (code >= BASE && code <= BASE + 0x3fff) {
    const v = code - BASE;
    return { code, role: "data", value: v, hex: "0x" + v.toString(16).toUpperCase().padStart(4, "0"), bits: v.toString(2).padStart(14, "0") };
  }
  if (code >= MARK && code <= MARK + 6) return { code, role: code === MARK ? "zero" : "end", bytes: code - MARK };
  return null;
}
const shadeColour = (v) => `hsl(${Math.round(((v >> 6) / 256) * 330)} 55% var(--shade-l))`;

// ── rendering ───────────────────────────────────────────────────────────────
function charNodes(text, bad = -1) {
  const frag = document.createDocumentFragment();
  if (text.length > RENDER_LIMIT) { frag.append(text); return frag; }
  let run = "";
  const flush = () => { if (run) { frag.append(run); run = ""; } };
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i), ch = text[i];
    if (i === bad) { flush(); frag.append(el("span", { className: "bad", textContent: ch })); continue; }
    const d = describe(c);
    if (!d) { run += ch; continue; }
    flush();
    const s = el("span", { className: "k" + (d.role !== "data" ? " m" : ""), textContent: ch });
    if (S.shade && d.role === "data") s.style.color = shadeColour(d.value);
    frag.append(s);
  }
  flush();
  return frag;
}
function setOutput(node, cls = "") {
  $("#output").className = "output " + cls;
  $("#output").replaceChildren(node);
}
const empty = (key) => el("span", { className: "empty", textContent: t(key) });
const problem = (msg, cls = "") => $("#problems").append(el("p", { className: cls, textContent: msg }));
function errorText(e, text) {
  const c = e.position >= 0 ? text.charCodeAt(e.position) : 0;
  const msg = t("err_" + e.code, { c: e.position >= 0 ? `“${text[e.position]}” (${cp(c)})` : "" });
  return e.position >= 0 ? `${msg} (${t("errAt", { n: e.position + 1 })})` : msg;
}
function stats(items) {
  $("#stats").replaceChildren(...items.map(([k, v, small]) =>
    el("div", {}, el("dt", { textContent: k }), el("dd", {}, String(v), small ? el("small", { textContent: " " + small }) : ""))));
}

function drawMap(bytes) {
  const fig = $("#map-figure");
  if (!bytes || !bytes.length) { fig.hidden = true; return; }
  // Square cells; the row length grows with the data so small inputs stay legible.
  let cols = 32;
  while (cols < 256 && cols * cols < bytes.length * 2) cols *= 2;
  const shown = Math.min(bytes.length, MAP_ROWS * cols), rows = Math.ceil(shown / cols);
  const cv = $("#map");
  cv.width = cols;
  cv.height = rows;
  cv.style.aspectRatio = `${cols} / ${rows}`;
  const ctx = cv.getContext("2d"), img = ctx.createImageData(cols, rows);
  for (let i = 0; i < rows * cols; i++) {
    const v = i < shown ? 255 - bytes[i] : 0, o = i * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
    img.data[o + 3] = i < shown ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
  $("#map-caption").textContent = t(bytes.length > shown ? "mapCaptionCut" : "mapCaption", { cols, kib: Math.round(shown / 1024) });
  fig.hidden = false;
}

// ── the main loop ───────────────────────────────────────────────────────────
function inputBytes() {
  const v = $("#input").value;
  if (S.kind === "hex") return fromHex(v);
  if (S.kind === "base64") return fromB64(v);
  if (S.kind === "file") return fileBytes || new Uint8Array(0);
  return utf8.encode(v);
}
const wrapText = (s, w) => (w > 0 ? s.replace(new RegExp(`(.{${w}})(?=.)`, "gs"), "$1\n") : s);

function update() {
  $("#problems").replaceChildren();
  $("#input").removeAttribute("aria-invalid");
  if (S.mode === "encode") {
    let bytes;
    try { bytes = inputBytes(); } catch (e) {
      $("#input").setAttribute("aria-invalid", "true");
      setOutput(empty("emptyEncode")); problem(e.message); stats([]); drawMap(null);
      lastOut = { text: "", bytes: null }; return done();
    }
    const plain = encode(bytes), text = wrapText(plain, S.wrap);
    const round = equalBytes(decodeDetailed(plain).bytes, bytes);
    const blank = !bytes.length && S.kind !== "file";
    setOutput(blank ? empty("emptyEncode") : charNodes(text));
    if (text.length > RENDER_LIMIT) problem(t("tooLarge"), "ok");
    stats(blank ? [] : [
      [t("sBytes"), fmtBytes(bytes.length)], [t("sChars"), fmtBytes(plain.length)],
      [t("sUtf16"), fmtBytes(plain.length * 2 + 2), t("bytesUnit")], [t("sUtf8"), fmtBytes(utf8.encode(plain).length), t("bytesUnit")],
      [t("sB64"), fmtBytes(Math.ceil(bytes.length / 3) * 4)], [t("sRound"), round ? "✓" : "✗", round ? t("yes") : t("no")],
    ]);
    drawMap(blank ? null : bytes);
    lastOut = { text, bytes: null };
  } else {
    const text = $("#input").value;
    let r;
    try { r = decodeDetailed(text, { strict: !S.lenient }); } catch (e) {
      if (!(e instanceof DecodeError)) throw e;
      $("#input").setAttribute("aria-invalid", "true");
      setOutput(charNodes(text, e.position));
      problem(errorText(e, text)); problem(t("lenientTip"), "ok");
      stats([[t("sRead"), fmtBytes(text.replace(/\s/g, "").length)], [t("sOut"), "—"]]);
      drawMap(null);
      lastOut = { text: "", bytes: null }; return done();
    }
    for (const w of r.warnings) problem(errorText(w, text));
    let shown, cls = "mono";
    if (!text.trim()) shown = empty("emptyDecode");
    else if (S.view === "text") {
      try { shown = new TextDecoder("utf-8", { fatal: true }).decode(r.bytes); cls = "plain"; } catch {
        shown = toHex(r.bytes).replace(/(..)(?!$)/g, "$1 "); problem(t("notText"));
      }
    } else if (S.view === "hex") shown = toHex(r.bytes).replace(/(..)(?!$)/g, "$1 ");
    else shown = toB64(r.bytes);
    setOutput(shown, cls);
    $("#output").lang = cls === "plain" ? "" : "en";
    stats(text.trim() ? [[t("sRead"), fmtBytes(text.replace(/\s/g, "").length)], [t("sOut"), fmtBytes(r.bytes.length)], [t("sWarn"), r.warnings.length]] : []);
    drawMap(r.bytes);
    lastOut = { text: typeof shown === "string" ? shown : "", bytes: r.bytes };
  }
  return done();
}
function done() {
  $("#copy").disabled = $("#download").disabled = !(lastOut.text || lastOut.bytes?.length);
  document.documentElement.dataset.ready = "1";
}

// ── controls ────────────────────────────────────────────────────────────────
function applyTexts() {
  document.documentElement.lang = lang();
  for (const n of $$("[data-i18n]")) n.textContent = t(n.dataset.i18n);
  for (const n of $$("[data-i18n-placeholder]")) n.placeholder = t(n.dataset.i18nPlaceholder);
  for (const n of $$("[data-i18n-aria-label]")) n.setAttribute("aria-label", t(n.dataset.i18nAriaLabel));
  for (const b of $$("[data-lang]")) b.setAttribute("aria-pressed", String(b.dataset.lang === lang()));
}
function syncControls() {
  const enc = S.mode === "encode";
  for (const b of $$("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === S.mode));
  $("#kind").hidden = !enc;
  $("#view").hidden = enc;
  for (const [id, key] of [["#kind", "kind"], ["#view", "view"], ["#wrap", "wrap"], ["#fileFormat", "fmt"], ["#bench-sizes", "sizes"]]) $(id).value = String(S[key]);
  $("#lenient").checked = S.lenient;
  $("#shade").checked = S.shade;
  $("#enc-opts").disabled = !enc;
  $("#dec-opts").disabled = enc;
  const fileMode = enc && S.kind === "file";
  $("#input").hidden = fileMode;
  $("#file-box").hidden = !fileMode;
  $("#file-name").textContent = fileBytes ? `${fileName} — ${fmtBytes(fileBytes.length)} B` : t("fileNone");
  const ta = $("#input");
  ta.className = enc ? (S.kind === "hex" || S.kind === "base64" ? "mono" : "") : "cjk";
  ta.lang = enc ? "" : "zh";
  ta.placeholder = enc ? t({ hex: "phHex", base64: "phBase64" }[S.kind] || "phText") : t("phDecode");
  $("#in-hint").textContent = !enc && fileEnc ? t("hintFileDecoded", { enc: fileEnc.toUpperCase() }) : "";
  showTab(S.tab, false);
}
function showTab(id, focus = true) {
  S.tab = id;
  for (const b of $$("[data-tab]")) {
    const on = b.dataset.tab === id;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  }
  for (const p of $$("[role=tabpanel]")) p.hidden = p.id !== id;
  const name = { work: "tabWork", bench: "tabBench", alphabet: "tabAlphabet" }[id];
  document.title = id === "work" ? "base16384 web" : `${t(name)} — base16384 web`;
  if (id === "alphabet") renderPage();
}
function applyTheme() {
  const th = S.theme || "auto";
  if (th === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = th;
  $("#theme").value = th;
}
const changed = () => { syncControls(); writeHash(); update(); };

// ── inspector ───────────────────────────────────────────────────────────────
function inspect(code) {
  const d = describe(code);
  if (!d) return;
  const role = d.role === "data" ? t("roleData") : d.role === "end" ? t("roleEnd", { n: d.bytes }) : t("roleZero");
  const rows = [
    d.role === "data" && [t("iValue"), d.value.toLocaleString("en")],
    d.role === "data" && [t("iHex"), d.hex, "mono"],
    d.role === "data" && [t("iBits"), d.bits, "mono"],
    [t("iCode"), cp(code), "mono"],
    [t("iRole"), role],
  ].filter(Boolean);
  const view = () => [
    el("div", { className: "big", lang: "zh", textContent: String.fromCharCode(code), style: d.role === "data" ? (S.shade ? `color:${shadeColour(d.value)}` : "") : "color:var(--accent)" }),
    el("dl", {}, ...rows.flatMap(([k, v, cls]) => [el("dt", { textContent: k }), el("dd", { className: cls || "", textContent: v })])),
  ];
  $("#inspector").replaceChildren(...view());
  $("#alpha-inspector").replaceChildren(...view());
}

// ── alphabet ────────────────────────────────────────────────────────────────
function renderPage() {
  S.page = Math.max(0, Math.min(63, S.page | 0));
  $("#page").value = S.page;
  const a = S.page * 256;
  $("#page-range").textContent = `${t("pageRange", { a: a.toLocaleString("en"), b: (a + 255).toLocaleString("en") })} · ${cp(BASE + a)}–${cp(BASE + a + 255)}`;
  const want = S.pick ? S.pick.charCodeAt(0) : -1;
  $("#grid").replaceChildren(...Array.from({ length: 256 }, (_, i) => {
    const code = BASE + a + i;
    const b = el("button", { type: "button", className: "cell" + (code === want ? " on" : "") }, el("b", { textContent: String.fromCharCode(code) }), el("small", { textContent: a + i }));
    b.dataset.code = code;
    b.setAttribute("aria-label", `${String.fromCharCode(code)} ${a + i}`);
    return b;
  }));
  $("#page-prev").disabled = S.page === 0;
  $("#page-next").disabled = S.page === 63;
}
function buildMarkers() {
  $("#markers").replaceChildren(...[1, 2, 3, 4, 5, 6].map((n) => {
    const b = el("button", { type: "button", textContent: String.fromCharCode(MARK + n) });
    b.dataset.code = MARK + n;
    b.setAttribute("aria-label", `${cp(MARK + n)}: ${n}`);
    return b;
  }));
}
function search(q) {
  q = q.trim();
  let code = -1;
  if (/^\d+$/.test(q) && +q < 16384) code = BASE + +q;
  else if (/^(u\+|0x)?[0-9a-f]{4}$/i.test(q) && /[a-f]|u\+|0x/i.test(q)) code = parseInt(q.replace(/^(u\+|0x)/i, ""), 16);
  else if (q) code = q.charCodeAt(0);
  const d = code >= 0 ? describe(code) : null;
  if (!d) return;
  if (d.role === "data") { S.page = d.value >> 8; S.pick = String.fromCharCode(code); renderPage(); }
  inspect(code);
}

// ── benchmark ───────────────────────────────────────────────────────────────
let benchText = "";
function runBench() {
  let worker;
  try { worker = new Worker(new URL("bench-worker.js", import.meta.url), { type: "module" }); } catch {
    $("#bench-status").textContent = t("benchNoWorker"); return;
  }
  const started = performance.now(), tables = [];
  $("#bench-run").disabled = true;
  $("#bench-copy").disabled = true;
  $("#bench-results").replaceChildren();
  worker.onmessage = ({ data: m }) => {
    if (m.type === "progress") $("#bench-status").textContent = t("benchRunning", { op: m.op, size: m.size });
    if (m.type === "row") { tables.push(m); renderBench(tables); }
    if (m.type === "done") {
      worker.terminate();
      $("#bench-run").disabled = false;
      $("#bench-copy").disabled = false;
      $("#bench-status").textContent = t("benchDone", { s: ((performance.now() - started) / 1000).toFixed(1) });
      benchText = [`base16384 web ${VERSION} benchmark (${t("benchUnit")})`, "", "| size | operation | MB/s |", "|---|---|---|",
        ...tables.flatMap((tb) => tb.results.map((r) => `| ${tb.size} | ${r.name} ${r.op}${r.native === false ? " (JS)" : ""} | ${Math.round(r.mbps)} |`))].join("\n");
      document.documentElement.dataset.benchDone = "1";
    }
  };
  worker.onerror = (e) => { $("#bench-status").textContent = e.message; $("#bench-run").disabled = false; };
  worker.postMessage({ sizes: S.sizes === "full" ? [1 << 10, 1 << 16, 1 << 20, 1 << 24] : [1 << 10, 1 << 16, 1 << 20] });
}
function renderBench(tables) {
  const last = tables.at(-1), max = Math.max(...last.results.map((r) => r.mbps));
  const ops = tables[0].results.map((r, i) => ({ r, cells: tables.map((tb) => tb.results[i].mbps) }));
  $("#bench-results").replaceChildren(
    el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { scope: "col", textContent: t("colOp") }),
        ...tables.map((tb) => el("th", { scope: "col", className: "n", textContent: tb.size })),
        el("th", { scope: "col", className: "barcell", textContent: t("barHead", { size: last.size }) }))),
      el("tbody", {}, ...ops.map(({ r, cells }) => el("tr", {},
        el("th", { scope: "row" }, `${r.name} ${r.op} `, r.native === undefined ? "" : el("span", { className: "note", textContent: `(${t(r.native ? "builtin" : "jsFallback")})` })),
        ...cells.map((v) => el("td", { className: "n", textContent: Math.round(v).toLocaleString("en") })),
        el("td", { className: "barcell" }, el("div", { className: "bar" + (r.name === "base16384" ? " us" : ""), style: `width:${Math.max(0.5, (cells.at(-1) / max) * 100).toFixed(1)}%` })))))),
    el("p", { className: "note", textContent: t("benchUnit") }),
  );
}

// ── presets ─────────────────────────────────────────────────────────────────
const PRESETS = {
  hello: () => ({ mode: "encode", kind: "text", in: "12345678 — base16384, こんにちは!", wrap: 0 }),
  binary: () => {
    const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(42).fill(0)];
    for (let i = 0; i < 64; i++) b.push(i * 4);
    b.push(...Array(28).fill(0xff), 0, 0, 0, 1);
    return { mode: "encode", kind: "hex", in: toHex(Uint8Array.from(b)).replace(/(..)(?!$)/g, "$1 "), shade: true };
  },
  damaged: () => {
    const good = encode(utf8.encode("The quick brown fox jumps over the lazy dog."));
    return { mode: "decode", in: good.slice(0, 9) + "�" + good.slice(10), lenient: false, view: "text" };
  },
};

// ── events ──────────────────────────────────────────────────────────────────
function wire() {
  $$("[data-mode]").forEach((b) => b.addEventListener("click", () => { S.mode = b.dataset.mode; fileEnc = ""; changed(); }));
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => { showTab(b.dataset.tab); writeHash(); }));
  $(".tabs").addEventListener("keydown", (e) => {
    const tabs = $$("[data-tab]"), i = tabs.findIndex((b) => b.dataset.tab === S.tab);
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (j === undefined) return;
    e.preventDefault();
    showTab(tabs[(j + tabs.length) % tabs.length].dataset.tab);
    writeHash();
  });
  $$("[data-lang]").forEach((b) => b.addEventListener("click", () => { S.lang = b.dataset.lang; store.set("lang", S.lang); applyTexts(); syncControls(); update(); }));
  $("#theme").addEventListener("change", (e) => { S.theme = e.target.value; store.set("theme", S.theme); applyTheme(); });

  let typing;
  $("#input").addEventListener("input", (e) => {
    S.in = e.target.value;
    clearTimeout(typing);
    typing = setTimeout(() => { writeHash(); update(); }, 60);
  });
  const bind = (id, key, conv = (v) => v) => $(id).addEventListener("change", (e) => {
    S[key] = conv(e.target.type === "checkbox" ? e.target.checked : e.target.value); changed();
  });
  bind("#kind", "kind"); bind("#view", "view"); bind("#wrap", "wrap", Number); bind("#fileFormat", "fmt");
  bind("#lenient", "lenient"); bind("#shade", "shade"); bind("#bench-sizes", "sizes");

  $("#clear").addEventListener("click", () => { S.in = ""; $("#input").value = ""; fileBytes = null; fileName = ""; fileEnc = ""; changed(); $("#input").focus(); });
  $("#swap").addEventListener("click", () => {
    if (S.mode === "encode") { S.in = lastOut.text; S.mode = "decode"; } else {
      const bytes = lastOut.bytes || new Uint8Array(0);
      let s = null;
      try { s = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { /* binary */ }
      S.mode = "encode";
      if (s !== null) { S.kind = "text"; S.in = s; } else { S.kind = "hex"; S.in = toHex(bytes); }
    }
    fileEnc = "";
    $("#input").value = S.in;
    changed();
  });
  $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
    Object.assign(S, PRESETS[b.dataset.preset]());
    $("#input").value = S.in;
    fileEnc = "";
    changed();
  }));

  $("#copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(lastOut.text || ""); toast(t("copied")); } catch { toast(t("copyFail")); }
  });
  $("#download").addEventListener("click", () => {
    let blob, name;
    if (S.mode === "decode") {
      blob = new Blob([lastOut.bytes], { type: "application/octet-stream" });
      name = fileName ? fileName.replace(/\.(txt|b14|base16384)$/i, "") || "decoded.bin" : "decoded.bin";
    } else {
      const body = S.fmt === "utf8" ? utf8.encode(lastOut.text) : toUTF16BE(lastOut.text, { bom: S.fmt === "utf16bom" });
      blob = new Blob([body], { type: S.fmt === "utf8" ? "text/plain;charset=utf-8" : "text/plain;charset=utf-16be" });
      name = (S.kind === "file" && fileName ? fileName : "data") + ".txt";
    }
    const a = el("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("#share").addEventListener("click", async () => {
    const long = S.kind === "file" || S.in.length > HASH_LIMIT;
    writeHash();
    try { await navigator.clipboard.writeText(location.href); toast(t(long ? "linkLong" : "linkCopied")); } catch { toast(location.href); }
  });

  const takeFile = async (f) => {
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    fileName = f.name;
    if (S.mode === "decode") {
      const r = readText(bytes);
      S.in = r.text; fileEnc = r.encoding;
      $("#input").value = S.in;
    } else { fileBytes = bytes; S.kind = "file"; }
    changed();
  };
  $("#file").addEventListener("change", (e) => takeFile(e.target.files[0]));
  const drop = $("#drop");
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    drop.classList.remove("over");
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); takeFile(e.dataTransfer.files[0]);
  });

  const out = $("#output");
  const pick = (e) => {
    const k = e.target.closest(".k");
    if (!k) return;
    for (const n of $$(".output .k.on")) n.classList.remove("on");
    k.classList.add("on");
    inspect(k.textContent.charCodeAt(0));
  };
  out.addEventListener("mouseover", pick);
  out.addEventListener("click", pick);
  out.addEventListener("keydown", (e) => {
    const ks = $$(".output .k");
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!ks.length || (step === undefined && e.key !== "Home" && e.key !== "End")) return;
    e.preventDefault();
    const i = ks.findIndex((n) => n.classList.contains("on"));
    const j = e.key === "Home" ? 0 : e.key === "End" ? ks.length - 1 : Math.max(0, Math.min(ks.length - 1, i + step));
    for (const n of $$(".output .k.on")) n.classList.remove("on");
    ks[j].classList.add("on");
    ks[j].scrollIntoView({ block: "nearest" });
    inspect(ks[j].textContent.charCodeAt(0));
  });

  $("#bench-run").addEventListener("click", runBench);
  $("#bench-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(benchText); toast(t("copied")); } catch { toast(t("copyFail")); }
  });

  const pickCell = (e) => {
    const c = e.target.closest("[data-code]");
    if (!c) return;
    for (const n of $$(".cell.on")) n.classList.remove("on");
    c.classList.add("on");
    inspect(Number(c.dataset.code));
  };
  $("#grid").addEventListener("click", pickCell);
  $("#markers").addEventListener("click", pickCell);
  $("#page-prev").addEventListener("click", () => { S.page--; renderPage(); writeHash(); });
  $("#page-next").addEventListener("click", () => { S.page++; renderPage(); writeHash(); });
  $("#page").addEventListener("change", (e) => { S.page = Number(e.target.value); renderPage(); writeHash(); });
  $("#alpha-search").addEventListener("input", (e) => { S.q = e.target.value; search(S.q); writeHash(); });

  window.addEventListener("hashchange", () => { Object.assign(S, DEFAULTS, { lang: S.lang, theme: S.theme }); readHash(); start(); });
}

function start() {
  $("#input").value = S.in;
  $("#alpha-search").value = S.q;
  applyTheme();
  applyTexts();
  syncControls();
  update();
  if (S.q) search(S.q);
  else if (S.pick) {
    inspect(S.pick.charCodeAt(0));
    $$(".output .k").find((n) => n.textContent === S.pick)?.classList.add("on");
  }
}

// ── boot ────────────────────────────────────────────────────────────────────
S.lang = store.get("lang") || ((navigator.language || "").startsWith("ja") ? "ja" : "en");
S.theme = store.get("theme") || "auto";
readHash();
{
  const preset = new URLSearchParams(location.hash.slice(1)).get("preset");
  if (PRESETS[preset]) Object.assign(S, PRESETS[preset]());
}
$("#version").textContent = `· v${VERSION} · base16384-js ${LIB_VERSION}`;
buildMarkers();
wire();
start();
