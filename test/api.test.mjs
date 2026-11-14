// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "../api/api.mjs";

const q = (s) => handle(new URLSearchParams(s));

test("no op shows the guide", () => assert.equal(q(""), null));

test("documented example", () => {
  assert.equal(q("op=encode&text=12345678").output, "婌焳廔萷尀㴁");
  assert.equal(q("op=decode&data=" + encodeURIComponent("婌焳廔萷尀㴁")).text, "12345678");
});

test("hex, base64 and text agree", () => {
  const a = q("op=encode&text=12345").output;
  assert.equal(q("op=encode&hex=3132333435").output, a);
  assert.equal(q("op=encode&base64=MTIzNDU").output, a);
});

test("errors are JSON with a code and position", () => {
  assert.equal(q("op=nope").error.code, "unknown-op");
  assert.equal(q("op=encode").error.code, "bad-parameter");
  assert.equal(q("op=encode&hex=abc").error.code, "bad-input");
  const e = q("op=decode&data=" + encodeURIComponent("婌焳A廔萷")).error;
  assert.deepEqual([e.code, e.position], ["foreign", 2]);
  assert.equal(q("op=decode&lenient=1&data=" + encodeURIComponent("婌焳A廔萷")).warnings[0].code, "foreign");
});

test("binary decodes to null text", () => {
  assert.equal(q("op=decode&data=" + encodeURIComponent(q("op=encode&hex=ff").output)).text, null);
});

test("length and describe", () => {
  assert.deepEqual(q("op=length&bytes=8"), { ok: true, op: "length", version: "1.0.0", bytes: 8, characters: 6, utf16Bytes: 12 });
  const d = q("op=describe&c=" + encodeURIComponent("一㴁x")).characters;
  assert.deepEqual(d.map((x) => x.role ?? x.error), ["data", "end", "not a base16384 character"]);
  assert.equal(d[1].bytes, 1);
});
