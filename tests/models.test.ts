import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

test("a month from 1 through 12 is required", () => {
  for (const month of [undefined, 0, 13, 1.5, "8"]) {
    assert.throws(
      () => parseModelEntry({ ...copyValid(), month }, `${valid.slug}.json`),
      /failed schema validation/,
    );
  }
});

test("registry sorts by year and month, with alphabetical ties and later additions last", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "model-order-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "models"));
  for (const [slug, year, month] of [
    ["a-new-model", 2025, 9],
    ["remanence", 2025, 8],
    ["z-previous-year", 2024, 12],
    ["z-earlier-month", 2025, 1],
    ["a-same-month", 2025, 8],
  ] as const) {
    fs.writeFileSync(
      path.join(root, "models", `${slug}.json`),
      JSON.stringify({ ...copyValid(), slug, year, month }),
    );
  }
  assert.deepEqual(loadModels(root).map(({ slug }) => slug), [
    "z-previous-year",
    "z-earlier-month",
    "a-same-month",
    "remanence",
    "a-new-model",
  ]);
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

test("unknown link labels and duplicate URLs are rejected", () => {
  const entry = copyValid();
  entry.links = [
    { label: "GITHUB", url: "https://example.com" },
    { label: "SITE", url: "https://example.com/a" },
    { label: "ABOUT", url: "https://example.com/a" },
  ];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /unknown link label "GITHUB"; valid labels are: SITE, ABOUT, CONTRACT[\s\S]*duplicated/,
  );
});

test("the CONTRACT link is required and pinned to evm.now", () => {
  const entry = copyValid();
  entry.links = [{ label: "SITE", url: "https://example.com" }];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /missing required link "CONTRACT"/,
  );

  entry.links = [
    { label: "CONTRACT", url: `https://etherscan.io/address/${entry.address}` },
  ];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /CONTRACT link must be "https:\/\/evm\.now\/address\//,
  );
});

test("links must follow the fixed order", () => {
  const entry = copyValid();
  entry.links = [
    { label: "CONTRACT", url: `https://evm.now/address/${entry.address}` },
    { label: "SITE", url: "https://example.com" },
  ];
  assert.throws(
    () => parseModelEntry(entry, `${entry.slug}.json`),
    /links must follow the order SITE, ABOUT, CONTRACT/,
  );
});
