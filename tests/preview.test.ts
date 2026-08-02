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

function abiStringHex(text: string): string {
  const utf8 = Buffer.from(text, "utf8");
  const padded = Buffer.concat([
    utf8,
    Buffer.alloc((32 - (utf8.length % 32)) % 32),
  ]);
  return `0x${word(32n)}${word(BigInt(utf8.length))}${padded.toString("hex")}`;
}

test("svg previews decode ABI strings into data URIs", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
  const decoded = decodePreview({ kind: "svg" }, abiStringHex(svg));

  assert.equal(decoded?.kind, "figure");
  assert.equal(
    decoded?.kind === "figure" ? decoded.src : "",
    `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
  );

  assert.equal(decodePreview({ kind: "svg" }, abiStringHex("not svg")), null);
});

test("token-uri previews extract self-contained data images only", () => {
  const gif = "data:image/gif;base64,R0lGODlh";
  const uri = (image: string) =>
    `data:application/json;base64,${Buffer.from(
      JSON.stringify({ name: "GANPepe #1", image }),
      "utf8",
    ).toString("base64")}`;

  const decoded = decodePreview({ kind: "token-uri" }, abiStringHex(uri(gif)));
  assert.deepEqual(decoded, {
    kind: "figure",
    heading: "ONCHAIN TOKEN METADATA",
    src: gif,
    caption: "GANPepe #1",
  });

  // An https image would be offchain content — must never render.
  assert.equal(
    decodePreview(
      { kind: "token-uri" },
      abiStringHex(uri("https://example.com/x.gif")),
    ),
    null,
  );
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
