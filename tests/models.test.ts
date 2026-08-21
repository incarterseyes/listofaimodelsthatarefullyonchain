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
    ["TYPE", "a network"],
    ["CHAIN", "not a fact"],
    ["TRAINING", "one"],
    ["TRAINING", "two"],
  ];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /unknown fact label "CHAIN"; valid labels are:[\s\S]*"TRAINING" is duplicated/,
  );
});

test("the core fact labels are required", () => {
  const entry = copyValid();
  entry.facts = [["TRAINING", "trained offchain"], ["TRAINING", "x"], ["TRAINING", "y"], ["TRAINING", "z"]];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /missing required fact label "TYPE"[\s\S]*"SIZE"[\s\S]*"STORAGE"[\s\S]*"OUTPUT"/,
  );
});

test("facts must follow the fixed order", () => {
  const entry = copyValid();
  const [first, ...rest] = entry.facts;
  entry.facts = [...rest, first];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /facts must follow the order TYPE, SIZE, STORAGE, TRAINING, OUTPUT/,
  );
});

test("SIZE values must contain a number", () => {
  const entry = copyValid();
  entry.facts = entry.facts.map(([label, value]) =>
    label === "SIZE" ? [label, "many weights"] : [label, value],
  ) as [string, string][];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /SIZE value "many weights" must contain a number/,
  );
});

test("STORAGE values must name where the weights live", () => {
  const entry = copyValid();
  entry.facts = entry.facts.map(([label, value]) =>
    label === "STORAGE" ? [label, "on IPFS"] : [label, value],
  ) as [string, string][];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /STORAGE value "on IPFS" must name where the weights live: contract storage, data contracts, bytecode, derived at read time/,
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
