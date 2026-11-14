// Benchmark worker: measures encode/decode throughput off the main thread.
// SPDX-License-Identifier: AGPL-3.0-or-later
import { encode, decode } from "../vendor/base16384.mjs";

const nativeB64 = typeof Uint8Array.prototype.toBase64 === "function" && typeof Uint8Array.fromBase64 === "function";
const nativeHex = typeof Uint8Array.prototype.toHex === "function" && typeof Uint8Array.fromHex === "function";

const b64enc = nativeB64 ? (x) => x.toBase64() : (x) => {
  let s = "";
  for (let i = 0; i < x.length; i += 0x8000) s += String.fromCharCode.apply(null, x.subarray(i, i + 0x8000));
  return btoa(s);
};
const b64dec = nativeB64 ? (s) => Uint8Array.fromBase64(s) : (s) => {
  const b = atob(s), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};
const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
const hexenc = nativeHex ? (x) => x.toHex() : (x) => {
  const parts = new Array(x.length);
  for (let i = 0; i < x.length; i++) parts[i] = HEX[x[i]];
  return parts.join("");
};
const hexdec = nativeHex ? (s) => Uint8Array.fromHex(s) : (s) => {
  const u = new Uint8Array(s.length >> 1);
  for (let i = 0; i < u.length; i++) u[i] = parseInt(s.substr(2 * i, 2), 16);
  return u;
};

function random(n) {
  const u = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(u.subarray(i, Math.min(n, i + 65536)));
  return u;
}
function rate(fn, bytes) {
  fn();
  let runs = 0, t = 0;
  const start = performance.now();
  while ((t = performance.now() - start) < 350 || runs < 3) { fn(); runs++; }
  return (bytes * runs) / (t / 1000) / 1e6;
}
const label = (n) => (n >= 1 << 20 ? `${n >> 20} MiB` : `${n >> 10} KiB`);

onmessage = ({ data: { sizes } }) => {
  for (const n of sizes) {
    const x = random(n), size = label(n);
    const k = encode(x), b = b64enc(x), h = hexenc(x);
    const ops = [
      ["base16384", "encode", () => encode(x)], ["base16384", "decode", () => decode(k)],
      ["base64", "encode", () => b64enc(x), nativeB64], ["base64", "decode", () => b64dec(b), nativeB64],
      ["hex", "encode", () => hexenc(x), nativeHex], ["hex", "decode", () => hexdec(h), nativeHex],
    ];
    const results = [];
    for (const [name, op, fn, native] of ops) {
      postMessage({ type: "progress", op: `${name} ${op}`, size });
      results.push({ name, op, native, mbps: rate(fn, n) });
    }
    postMessage({ type: "row", size, results });
  }
  postMessage({ type: "done", nativeB64, nativeHex });
};
