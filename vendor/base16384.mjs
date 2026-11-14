// Bundled from base16384-js (https://github.com/DecodeEncode/base16384-js), Apache-2.0;
// see vendor/LICENSE-base16384-js. Update with `make vendor`.
// base16384-js — encoder and decoder for the base16384 text format.
// Written from the published format description; shares no code with other implementations.
// SPDX-License-Identifier: Apache-2.0

export const VERSION = "1.0.0";

/** First character of the alphabet (value 0): 一 U+4E00. The alphabet runs to U+8DFF. */
export const BASE = 0x4e00;
/** End markers U+3D01–U+3D06 record how many bytes the final, short group holds.
 *  U+3D00 is accepted on decoding (some encoders append it after a whole number of groups). */
export const MARK = 0x3d00;
const LAST = BASE + 0x3fff;
const BOM = 0xfeff;

/** Characters used by a final group of r bytes (r = 1..6). */
const TAIL = [0, 1, 2, 2, 3, 3, 4];

export class DecodeError extends Error {
  /** @param {string} code  @param {string} message  @param {number} position  character index, or -1 */
  constructor(code, message, position = -1) {
    super(message);
    this.name = "DecodeError";
    this.code = code;
    this.position = position;
  }
}

/** Number of UTF-16 code units (characters) produced for `n` bytes, marker included. */
export function encodedLength(n) {
  const r = n % 7;
  return Math.floor(n / 7) * 4 + (r ? TAIL[r] + 1 : 0);
}

// ── encode ─────────────────────────────────────────────────────────────────

/**
 * Encode bytes into UTF-16 code units (no BOM).
 * @param {Uint8Array|ArrayBuffer|ArrayBufferView|number[]} input
 * @returns {Uint16Array}
 */
export function encodeToUnits(input) {
  const b = toBytes(input);
  const n = b.length, full = n - (n % 7);
  const out = new Uint16Array(encodedLength(n));
  let o = 0, i = 0;
  for (; i < full; i += 7) {
    // 56 bits as two 28-bit halves keeps every intermediate within 32-bit integers.
    const hi = (b[i] << 20) | (b[i + 1] << 12) | (b[i + 2] << 4) | (b[i + 3] >>> 4);
    const lo = ((b[i + 3] & 15) << 24) | (b[i + 4] << 16) | (b[i + 5] << 8) | b[i + 6];
    out[o++] = BASE + (hi >>> 14);
    out[o++] = BASE + (hi & 0x3fff);
    out[o++] = BASE + (lo >>> 14);
    out[o++] = BASE + (lo & 0x3fff);
  }
  const r = n - full;
  if (r) {
    const t = [0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < r; k++) t[k] = b[i + k];
    const hi = (t[0] << 20) | (t[1] << 12) | (t[2] << 4) | (t[3] >>> 4);
    const lo = ((t[3] & 15) << 24) | (t[4] << 16) | (t[5] << 8) | t[6];
    const v = [hi >>> 14, hi & 0x3fff, lo >>> 14, lo & 0x3fff];
    for (let k = 0; k < TAIL[r]; k++) out[o++] = BASE + v[k];
    out[o++] = MARK + r;
  }
  return out;
}

/** Encode bytes to a string. */
export function encode(input) {
  return unitsToString(encodeToUnits(input));
}

/** Encode a string's UTF-8 bytes. */
export const encodeText = (s) => encode(new TextEncoder().encode(s));

// ── decode ─────────────────────────────────────────────────────────────────

/**
 * Decode base16384 text.
 * A leading BOM and all whitespace are skipped.
 * @param {string|Uint16Array} input
 * @param {{strict?: boolean}} [options]
 *   strict (default true): reject characters outside the alphabet, a misplaced or
 *   inconsistent end marker, and an incomplete final group.
 *   strict: false: skip foreign characters and decode whatever is complete, reporting
 *   each problem in `warnings`.
 * @returns {{bytes: Uint8Array, warnings: DecodeError[]}}
 */
export function decodeDetailed(input, { strict = true } = {}) {
  const warnings = [];
  const problem = (code, msg, pos) => {
    const e = new DecodeError(code, msg, pos);
    if (strict) throw e;
    warnings.push(e);
  };

  const units = typeof input === "string" ? input : unitsToString(input);
  // Gather data values and the marker; positions are UTF-16 indexes.
  const vals = new Uint16Array(units.length);
  let n = 0, mark = 0, markAt = -1;
  for (let p = 0; p < units.length; p++) {
    const c = units.charCodeAt(p);
    if (c >= BASE && c <= LAST) {
      if (markAt >= 0) problem("after-end", "data follows the end marker", p);
      else { vals[n++] = c - BASE; }
      continue;
    }
    if (c >= MARK && c <= MARK + 6) {
      if (markAt >= 0) problem("after-end", "a second end marker", p);
      else { mark = c - MARK; markAt = p; }
      continue;
    }
    if (c === BOM && p === 0) continue;
    if (c === 0x20 || c === 0x3000 || (c >= 0x09 && c <= 0x0d) || c === 0x85 || c === 0xa0 ||
        (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f || c === 0x205f) continue;
    problem("foreign", `U+${c.toString(16).toUpperCase().padStart(4, "0")} is not a base16384 character`, p);
  }

  let full = n >> 2, tail = n & 3;
  if (markAt >= 0 && mark === 0) {
    // U+3D00 ("no remainder") is written by some encoders after an exact multiple of 7 bytes.
    if (tail) problem("bad-end", "the end marker says 0 bytes, but the last group is incomplete", markAt);
  } else if (mark) {
    const need = TAIL[mark];
    if (n >= need && (n - need) % 4 === 0) {
      full = (n - need) / 4;
      tail = need;
    } else {
      problem("bad-end", `the end marker says ${mark} byte${mark > 1 ? "s" : ""}, which needs ${need} final character${need > 1 ? "s" : ""}`, markAt);
      if (tail === 0 && full) { full--; tail = 4; }
      // forgiving: trust the marker, but never read past the characters present
      mark = Math.min(mark, Math.floor((tail * 14) / 8));
    }
  } else if (tail) {
    problem("no-end", "the final group is incomplete and has no end marker", -1);
    mark = 0; // forgiving: drop the incomplete group
  }

  const out = new Uint8Array(full * 7 + mark);
  let o = 0, v = 0;
  for (let g = 0; g < full; g++, v += 4) {
    const hi = (vals[v] << 14) | vals[v + 1], lo = (vals[v + 2] << 14) | vals[v + 3];
    out[o++] = hi >>> 20;
    out[o++] = (hi >>> 12) & 255;
    out[o++] = (hi >>> 4) & 255;
    out[o++] = ((hi & 15) << 4) | (lo >>> 24);
    out[o++] = (lo >>> 16) & 255;
    out[o++] = (lo >>> 8) & 255;
    out[o++] = lo & 255;
  }
  if (mark) {
    const t = [0, 0, 0, 0];
    for (let k = 0; k < tail; k++) t[k] = vals[v + k];
    const hi = (t[0] << 14) | t[1], lo = (t[2] << 14) | t[3];
    const bytes = [hi >>> 20, (hi >>> 12) & 255, (hi >>> 4) & 255, ((hi & 15) << 4) | (lo >>> 24), (lo >>> 16) & 255, (lo >>> 8) & 255];
    for (let k = 0; k < mark; k++) out[o++] = bytes[k];
  }
  return { bytes: out, warnings };
}

/** Decode base16384 text to bytes (strict by default). */
export const decode = (input, options) => decodeDetailed(input, options).bytes;

/** Decode to a string; throws if the bytes are not valid UTF-8. */
export const decodeText = (input, options) =>
  new TextDecoder("utf-8", { fatal: true }).decode(decode(input, options));

// ── UTF-16 files (the format of the reference command-line tool) ───────────

/**
 * Serialise text as UTF-16BE bytes, as the reference tool writes files.
 * @param {string|Uint16Array} text
 * @param {{bom?: boolean}} [options]  bom (default true): start with FE FF
 */
export function toUTF16BE(text, { bom = true } = {}) {
  const s = typeof text === "string" ? text : unitsToString(text);
  const off = bom ? 2 : 0;
  const out = new Uint8Array(off + s.length * 2);
  if (bom) { out[0] = 0xfe; out[1] = 0xff; }
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[off + 2 * i] = c >>> 8;
    out[off + 2 * i + 1] = c & 255;
  }
  return out;
}

/**
 * Read text from file bytes. Recognises a UTF-16BE or UTF-16LE BOM and a UTF-8 BOM;
 * without a BOM, guesses UTF-16BE when the bytes look like it and UTF-8 otherwise.
 * @returns {{text: string, encoding: "utf-16be"|"utf-16le"|"utf-8"}}
 */
export function readText(input) {
  const b = toBytes(input);
  if (b[0] === 0xfe && b[1] === 0xff) return { text: utf16(b.subarray(2), false), encoding: "utf-16be" };
  if (b[0] === 0xff && b[1] === 0xfe) return { text: utf16(b.subarray(2), true), encoding: "utf-16le" };
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return { text: new TextDecoder().decode(b.subarray(3)), encoding: "utf-8" };
  if (b.length % 2 === 0 && looksUTF16BE(b)) return { text: utf16(b, false), encoding: "utf-16be" };
  return { text: new TextDecoder().decode(b), encoding: "utf-8" };
}

function looksUTF16BE(b) {
  // Every alphabet character and end marker has a first byte of 0x3D or 0x4E–0x8D.
  const m = Math.min(b.length, 4096);
  let hit = 0;
  for (let i = 0; i < m; i += 2) if ((b[i] >= 0x4e && b[i] <= 0x8d) || b[i] === 0x3d) hit++;
  return m > 0 && hit * 2 >= m * 0.9;
}

function utf16(b, little) {
  const n = b.length >> 1, u = new Uint16Array(n);
  for (let i = 0; i < n; i++) u[i] = little ? b[2 * i] | (b[2 * i + 1] << 8) : (b[2 * i] << 8) | b[2 * i + 1];
  return unitsToString(u);
}

// ── streams ────────────────────────────────────────────────────────────────

/**
 * A TransformStream from byte chunks to string chunks. Chunk boundaries may fall anywhere;
 * the output is identical to encoding the concatenated input in one call.
 */
export class EncoderStream extends TransformStream {
  constructor() {
    let carry = new Uint8Array(0);
    super({
      transform(chunk, ctl) {
        const b = concat(carry, toBytes(chunk));
        const cut = b.length - (b.length % 7);
        if (cut) ctl.enqueue(encode(b.subarray(0, cut)));
        carry = b.slice(cut);
      },
      flush(ctl) { if (carry.length) ctl.enqueue(encode(carry)); },
    });
  }
}

/** A TransformStream from string chunks to byte chunks (strict). */
export class DecoderStream extends TransformStream {
  constructor() {
    let carry = "", seen = 0;
    super({
      transform(chunk, ctl) {
        const s = carry + chunk;
        // Emit all complete groups but the last: a final group of four may still turn out
        // to be the short group of six bytes once its end marker arrives.
        let count = 0, cut = 0, prev = 0;
        for (let p = 0; p < s.length; p++) {
          const c = s.charCodeAt(p);
          if (c >= BASE && c <= LAST && ++count % 4 === 0) { cut = prev; prev = p + 1; }
          else if (c >= MARK && c <= MARK + 6) break;
        }
        if (cut) {
          try { ctl.enqueue(decode(s.slice(0, cut))); } catch (e) { throw shift(e, seen); }
        }
        seen += cut;
        carry = s.slice(cut);
      },
      flush(ctl) {
        if (!carry) return;
        try { ctl.enqueue(decode(carry)); } catch (e) { throw shift(e, seen); }
      },
    });
  }
}

const shift = (e, by) => (e instanceof DecodeError && e.position >= 0 ? new DecodeError(e.code, e.message, e.position + by) : e);

// ── helpers ────────────────────────────────────────────────────────────────

const LITTLE = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1;
const UTF16 = LITTLE ? new TextDecoder("utf-16le", { ignoreBOM: true }) : null;

function unitsToString(u) {
  if (UTF16) return UTF16.decode(u); // native and fast where code units are little-endian in memory
  let s = "";
  for (let i = 0; i < u.length; i += 0x2000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x2000));
  return s;
}

function concat(a, b) {
  if (!a.length) return b;
  const c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (Array.isArray(input)) return Uint8Array.from(input);
  throw new TypeError("base16384: expected bytes (Uint8Array, ArrayBuffer or number[])");
}
