import assert from "node:assert/strict";
import test from "node:test";
import { decodeStringReturn, decodeMarketState } from "@/lib/abiReturn";
import { decodePreview } from "@/lib/preview";

const word = (value: number | bigint) => BigInt(value).toString(16).padStart(64, "0");
function stringData(value: string) {
  const bytes = Buffer.from(value);
  return word(bytes.length) + bytes.toString("hex").padEnd(Math.ceil(bytes.length / 32) * 64, "0");
}

test("variable string results require correct offsets, full padding, and no trailing data", () => {
  const valid = `0x${word(32)}${stringData("hello")}`;
  assert.equal(decodeStringReturn(valid), "hello");
  assert.equal(decodeStringReturn(`0x${word(32)}${stringData("café")}`), "café");
  for (const invalid of [
    "0x", "0xzz", valid.slice(0, -2), valid + "00", valid.slice(0, -2) + "01",
    `0x${word(64)}${stringData("hello")}`,
    `0x${word(32)}${word(1n << 255n)}`,
    `0x${word(32)}${word(1)}ff${"00".repeat(31)}`,
  ]) assert.equal(decodeStringReturn(invalid), null, invalid);
  assert.equal(decodePreview({ kind: "text" }, `0x${word(32)}${stringData("")}`), null);
});

test("program previews return inert text, including source that looks like markup", () => {
  const code = "<script>alert('example')</script>";
  assert.deepEqual(decodePreview({ kind: "text" }, `0x${word(32)}${stringData(code)}`), {
    kind: "text", heading: "ONCHAIN PROGRAM PART", text: code,
  });
});

test("saved model state decodes both dynamic strings and verifies their exact positions", () => {
  const inputs = stringData("0x" + "12".repeat(20));
  const mood = stringData("0.5,0.8");
  const raw = `0x${word(25000000)}${word(128)}${word(25000001)}${word(128 + inputs.length / 2)}${inputs}${mood}`;
  assert.deepEqual(decodeMarketState(raw), {
    inputBlock: "25000000", inputs: "0x" + "12".repeat(20), moodBlock: "25000001", mood: "0.5,0.8",
  });
  assert.equal(decodePreview({ kind: "market-state" }, raw)?.kind, "rows");
  const empty = `0x${word(0)}${word(128)}${word(0)}${word(160)}${word(0)}${word(0)}`;
  assert.deepEqual(decodeMarketState(empty), { inputBlock: "0", inputs: "", moodBlock: "0", mood: "" });
  assert.equal(decodeMarketState(raw.slice(0, -2)), null);
  assert.equal(decodeMarketState(raw + word(0)), null);
  const overlapping = raw.slice(0, 194) + word(128) + raw.slice(258);
  assert.equal(decodeMarketState(overlapping), null);
});
