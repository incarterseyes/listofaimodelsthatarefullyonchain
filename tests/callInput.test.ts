import assert from "node:assert/strict";
import test from "node:test";
import { prepareCall } from "@/lib/callInput";
import { loadModels, parseModelEntry } from "@/lib/models";

const entries = loadModels();
function model(slug: string) {
  const entry = entries.find((entry) => entry.slug === slug);
  assert.ok(entry);
  return structuredClone(entry);
}

test("all editable examples reproduce the original calldata and exact-size check", () => {
  assert.ok(entries.some((entry) => entry.call.input));
  for (const entry of entries) {
    const prepared = prepareCall(entry, entry.call.input?.example ?? "");
    assert.equal(prepared.call.calldata, entry.call.calldata, entry.slug);
    assert.equal(prepared.call.expectedReturnBytes, entry.call.expectedReturnBytes, entry.slug);
    assert.equal(prepared.address, entry.address, entry.slug);
  }
});

test("token IDs preserve integers beyond JavaScript number precision and the full uint256 range", () => {
  const entry = model("remanence");
  const large = prepareCall(entry, "9007199254740993");
  assert.equal(large.call.calldata.slice(-16), "0020000000000001");
  assert.equal(large.call.returnShape, "token-uri");
  const max = (1n << 256n) - 1n;
  assert.equal(prepareCall(entry, max.toString()).call.calldata.slice(10), "f".repeat(64));
  assert.throws(() => prepareCall(entry, (max + 1n).toString()), /from 0/);
  for (const bad of ["", " ", "-1", "1.5", "1e3", "0x01", "1,000", "Infinity"]) {
    assert.throws(() => prepareCall(entry, bad), /whole number/);
  }
  assert.equal(prepareCall(entry, "000101").call.expectedReturnBytes, entry.call.expectedReturnBytes);
});

test("script inputs keep the registered project fixed and reject parts outside its program", () => {
  for (const [slug, max] of [["aragnation", 6], ["i-by-ryley-o", 23]] as const) {
    const entry = model(slug);
    const prepared = prepareCall(entry, "0");
    assert.equal(prepared.call.calldata.slice(0, 74), entry.call.calldata.slice(0, 74));
    assert.equal(prepared.call.calldata.slice(74), "0".repeat(64));
    assert.equal(prepared.call.returnShape, "text");
    assert.doesNotThrow(() => prepareCall(entry, String(max)));
    assert.throws(() => prepareCall(entry, String(max + 1)), /from 0/);
  }
  assert.doesNotThrow(() => prepareCall(model("slonks"), "9999"));
  assert.throws(() => prepareCall(model("slonks"), "10000"), /from 0/);
});

test("CONCRETE accepts equivalent decimal and hexadecimal 128-bit seeds", () => {
  const entry = model("concrete-by-higgs");
  assert.equal(prepareCall(entry, "255").call.calldata, prepareCall(entry, "0xff").call.calldata);
  assert.equal(prepareCall(entry, "0x" + "f".repeat(32)).call.calldata.slice(10), "0".repeat(32) + "f".repeat(32));
  assert.throws(() => prepareCall(entry, (1n << 128n).toString()), /from 0/);
  assert.throws(() => prepareCall(entry, "0xno"), /hexadecimal/);
});

test("text encoding matches ABI offsets and lengths while enforcing the contract's alphabet and limits", () => {
  const entry = model("hello-world-computer");
  const call = prepareCall(entry, "a").call;
  assert.equal(call.calldata,
    "0x189bf94f" +
    "0000000000000000000000000000000000000000000000000000000000000020" +
    "0000000000000000000000000000000000000000000000000000000000000001" +
    "6100000000000000000000000000000000000000000000000000000000000000");
  assert.equal(call.expectedReturnBytes, 64);
  for (const text of ["", " ", "Hello", "hi!", "café", "hi\nthere", "hi\tthere"]) {
    assert.throws(() => prepareCall(entry, text), /lowercase/);
  }
  assert.doesNotThrow(() => prepareCall(entry, "a".repeat(64)));
  assert.throws(() => prepareCall(entry, "a".repeat(65)), /64 bytes/);
  assert.doesNotThrow(() => prepareCall(entry, "a b c d e f g h"));
  assert.throws(() => prepareCall(entry, "a b c d e f g h i"), /8 words/);
  // Spaces are allowed by the contract and must not be silently removed.
  assert.equal(BigInt("0x" + prepareCall(entry, " a ").call.calldata.slice(74, 138)), 3n);
});

test("vocabulary input encodes a uint16 array and rejects malformed or out-of-bounds sequences", () => {
  const entry = model("automate-attention");
  const calldata = prepareCall(entry, "0, 2047").call.calldata;
  assert.equal(calldata, prepareCall(entry, "0 2047").call.calldata);
  const words = calldata.slice(10).match(/.{64}/g)?.map((hex) => BigInt("0x" + hex));
  assert.deepEqual(words, [32n, 2n, 0n, 2047n]);
  for (const text of ["", "1,,2", "1,", ",1", "-1", "1.5", "[1,2]", "hello"]) {
    assert.throws(() => prepareCall(entry, text), /separated/);
  }
  assert.throws(() => prepareCall(entry, "2048"), /from 0 to 2047/);
  assert.doesNotThrow(() => prepareCall(entry, Array(512).fill("1").join(" ")));
  assert.throws(() => prepareCall(entry, Array(513).fill("1").join(" ")), /512 token IDs/);
});

test("text alphabets and limits can change through entry data, including Unicode", () => {
  const entry = model("hello-world-computer");
  if (entry.call.input?.kind !== "text") throw new Error("expected text");
  entry.call.input.pattern = "^[\\p{L}!?\\s]+$";
  entry.call.input.patternMessage = "Use letters, spaces, or ! and ?.";
  entry.call.input.maxBytes = 256;
  entry.call.input.maxWords = 20;
  assert.doesNotThrow(() => parseModelEntry(entry, `${entry.slug}.json`));
  const call = prepareCall(entry, "CAFÉ!").call;
  assert.equal(BigInt("0x" + call.calldata.slice(74, 138)), 6n);
  assert.equal(call.calldata.slice(138, 150), "434146c38921");
  assert.doesNotThrow(() => prepareCall(entry, "a".repeat(100)));
  assert.throws(() => prepareCall(entry, "123"), /Use letters, spaces/);
  entry.call.input.maxBytes = 5;
  assert.throws(() => prepareCall(entry, "CAFÉ!"), /5 bytes/);
  entry.call.input.pattern = "[";
  assert.throws(() => parseModelEntry(entry, `${entry.slug}.json`), /invalid input example/);
});

test("registry validation rejects input examples or output formats that drift from the registered call", () => {
  const entry = model("remanence");
  entry.call.input!.example = "102";
  assert.throws(() => parseModelEntry(entry, `${entry.slug}.json`), /example must encode/);
  entry.call.input!.example = "101";
  entry.call.manualReturn = "svg";
  assert.throws(() => parseModelEntry(entry, `${entry.slug}.json`), /matching preview/);
  entry.call.manualReturn = "token-uri";
  if (entry.call.input?.kind !== "uint") throw new Error("expected uint");
  entry.call.input.word = 1;
  assert.throws(() => parseModelEntry(entry, `${entry.slug}.json`), /input position/);
  entry.call.input.word = 0;
  entry.call.input.max = (1n << 256n).toString();
  assert.throws(() => parseModelEntry(entry, `${entry.slug}.json`), /fit in uint256/);
});

test("the input schema rejects misplaced options and unknown fields", () => {
  const entry = model("hello-world-computer");
  for (const extra of [{ word: 0 }, { maxItems: 10 }, { unknown: true }]) {
    const raw = { ...entry, call: { ...entry.call, input: { ...entry.call.input, ...extra } } };
    assert.throws(() => parseModelEntry(raw, `${entry.slug}.json`), /schema validation/);
  }
});
