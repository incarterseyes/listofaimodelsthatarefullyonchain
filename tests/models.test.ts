import assert from "node:assert/strict";
import test from "node:test";
import { loadModels, parseModelEntry } from "@/lib/models";

const valid = loadModels()[0];

function copyValid() {
  return structuredClone(valid);
}

test("the checked-in registry passes deterministic validation", () => {
  const entries = loadModels();
  assert.ok(entries.length > 0);
  assert.equal(new Set(entries.map(({ slug }) => slug)).size, entries.length);
});

test("odd-length calldata is rejected", () => {
  const entry = copyValid();
  entry.call.calldata = "0x0";
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /failed schema validation/,
  );
});

test("unknown and duplicate fact labels are rejected", () => {
  const entry = copyValid();
  entry.facts = [
    ...entry.facts,
    ["CHAIN", "not a fact"],
    ["TASK", "one"],
    ["TASK", "two"],
  ];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /unknown fact label "CHAIN"; valid labels are:[\s\S]*"TASK" is duplicated/,
  );
});

test("the core fact labels are required", () => {
  const entry = copyValid();
  entry.facts = [["TASK", "XOR"]];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /missing required fact label "ARCHITECTURE"[\s\S]*"WEIGHTS"[\s\S]*"OUTPUT"/,
  );
});

test("previews must match the declared return size", () => {
  const entry = copyValid();
  entry.preview = {
    kind: "fields",
    fields: [
      { label: "A", type: "bool" },
      { label: "B", type: "bool" },
    ],
  };
  entry.call.expectedReturnBytes = 32;
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /preview declares 2 fields \(64 bytes\) but expectedReturnBytes is 32/,
  );
});

test("invalid and duplicate evidence links are rejected", () => {
  const entry = copyValid();
  entry.links = [
    { label: "BROKEN", url: "https://?" },
    { label: "ONE", url: "https://example.com" },
    { label: "TWO", url: "https://example.com/" },
  ];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /not a valid URL[\s\S]*duplicated/,
  );
});
