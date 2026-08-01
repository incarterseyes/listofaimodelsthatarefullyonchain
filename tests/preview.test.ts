import assert from "node:assert/strict";
import test from "node:test";
import { decodePreview } from "@/lib/preview";
import type { OutputPreview } from "@/lib/types";

function word(value: bigint): string {
  return BigInt.asUintN(256, value).toString(16).padStart(64, "0");
}

test("grayscale images decode raw and ABI-framed payloads", () => {
  const spec = { kind: "grayscale-image", width: 2, height: 2 } as const;
  const pixels = "00408cff";

  const raw = decodePreview(spec, `0x${pixels}`);
  assert.equal(raw?.kind, "image");
  assert.deepEqual(
    raw?.kind === "image" ? Array.from(raw.pixels) : [],
    [0, 64, 140, 255],
  );

  const framed = decodePreview(spec, `0x${word(32n)}${word(4n)}${pixels}`);
  assert.deepEqual(
    framed?.kind === "image" ? Array.from(framed.pixels) : [],
    [0, 64, 140, 255],
  );

  assert.equal(decodePreview(spec, `0x${pixels}00`), null);
});

test("fields decode bools and signed integers", () => {
  const decoded = decodePreview(
    {
      kind: "fields",
      fields: [
        { label: "LABEL", type: "uint8" },
        { label: "CONFIDENCE", type: "int256" },
        { label: "FLAG", type: "bool" },
      ],
    },
    `0x${word(1n)}${word(-42n)}${word(0n)}`,
  );

  assert.deepEqual(decoded, {
    kind: "rows",
    heading: "DECODED FIELDS",
    header: ["FIELD", "VALUE"],
    rows: [
      ["LABEL", "1"],
      ["CONFIDENCE", "-42"],
      ["FLAG", "false"],
    ],
  });
});

test("field count must match the returned words", () => {
  const spec: OutputPreview = {
    kind: "fields",
    fields: [{ label: "OUTPUT", type: "bool" }],
  };
  assert.equal(decodePreview(spec, `0x${word(1n)}${word(1n)}`), null);
});

test("logits surface the top-k tokens in score order", () => {
  const values = [-3n, 7n, 0n, 7n, -1n];
  const hex = `0x${word(32n)}${word(BigInt(values.length))}${values
    .map(word)
    .join("")}`;

  const decoded = decodePreview({ kind: "logits", topK: 3 }, hex);

  assert.deepEqual(decoded, {
    kind: "rows",
    heading: "TOP 3 OF 5 LOGITS",
    header: ["TOKEN", "LOGIT"],
    rows: [
      ["TOKEN 1", "7"],
      ["TOKEN 3", "7"],
      ["TOKEN 2", "0"],
    ],
  });

  const truncated = `0x${word(32n)}${word(6n)}${values.map(word).join("")}`;
  assert.equal(decodePreview({ kind: "logits", topK: 3 }, truncated), null);
});

test("words fall back to one row per 32-byte word", () => {
  const decoded = decodePreview({ kind: "words" }, `0x${word(0n)}${word(255n)}`);

  assert.deepEqual(decoded, {
    kind: "rows",
    heading: "2 × 32-BYTE WORDS",
    header: ["WORD", "VALUE"],
    rows: [
      ["WORD 0", `0x${word(0n)}`],
      ["WORD 1", `0x${word(255n)}`],
    ],
  });

  assert.equal(decodePreview({ kind: "words" }, "0x00"), null);
});
