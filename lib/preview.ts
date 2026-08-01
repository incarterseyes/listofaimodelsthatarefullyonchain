import type { OutputPreview } from "./types";

// Decodes verified return bytes according to an entry's declared preview.
// Runs in the browser after a successful check; every decoder returns null
// instead of throwing when the bytes do not match the declared shape.

export type DecodedPreview =
  | {
      kind: "image";
      heading: string;
      width: number;
      height: number;
      pixels: Uint8Array;
    }
  | {
      kind: "rows";
      heading: string;
      header: [string, string];
      rows: [string, string][];
    }
  | {
      // A data: URI rendered via <img>. Never an external URL — previews
      // must not trigger network requests beyond the verified call itself.
      kind: "figure";
      heading: string;
      src: string;
      caption?: string;
    };

const HEX_BYTES = /^0x(?:[0-9a-fA-F]{2})*$/;

function hexToBytes(hex: string): Uint8Array | null {
  if (!HEX_BYTES.test(hex)) return null;
  const bytes = new Uint8Array((hex.length - 2) / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(2 + i * 2, 4 + i * 2), 16);
  }
  return bytes;
}

function wordAt(bytes: Uint8Array, index: number): bigint {
  let value = 0n;
  for (let i = index * 32; i < index * 32 + 32; i += 1) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

function wordHex(bytes: Uint8Array, index: number): string {
  return `0x${Array.from(bytes.slice(index * 32, index * 32 + 32), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

// Decodes a single ABI-encoded dynamic string return value.
function abiString(bytes: Uint8Array): string | null {
  if (bytes.length < 64) return null;
  if (wordAt(bytes, 0) !== 32n) return null;
  const length = wordAt(bytes, 1);
  if (length > 10_000_000n || bytes.length < 64 + Number(length)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.slice(64, 64 + Number(length)),
    );
  } catch {
    return null;
  }
}

function base64Encode(text: string): string {
  const utf8 = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of utf8) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodePreview(
  preview: OutputPreview,
  hex: string,
): DecodedPreview | null {
  const bytes = hexToBytes(hex);
  if (!bytes) return null;

  switch (preview.kind) {
    case "grayscale-image": {
      const size = preview.width * preview.height;
      // Accept a raw pixel buffer, or one wrapped in ABI dynamic-bytes
      // framing (32-byte offset + 32-byte length before the payload).
      const pixels =
        bytes.length === size
          ? bytes
          : bytes.length === size + 64
            ? bytes.slice(64)
            : null;
      if (!pixels) return null;
      return {
        kind: "image",
        heading: `${preview.width}×${preview.height} GRAYSCALE`,
        width: preview.width,
        height: preview.height,
        pixels,
      };
    }

    case "fields": {
      if (bytes.length !== preview.fields.length * 32) return null;
      const rows = preview.fields.map(({ label, type }, index): [string, string] => {
        const raw = wordAt(bytes, index);
        const value = type === "int256" ? BigInt.asIntN(256, raw) : raw;
        const text =
          type === "bool"
            ? value === 1n
              ? "true"
              : value === 0n
                ? "false"
                : `nonstandard bool (${value})`
            : value.toString();
        return [label, text];
      });
      return {
        kind: "rows",
        heading: "DECODED FIELDS",
        header: ["FIELD", "VALUE"],
        rows,
      };
    }

    case "logits": {
      // ABI dynamic array of signed integers: offset word, length word,
      // then one 32-byte word per logit.
      if (bytes.length < 96 || bytes.length % 32 !== 0) return null;
      const count = wordAt(bytes, 1);
      if (count > 1_000_000n || bytes.length !== 64 + Number(count) * 32) {
        return null;
      }
      const logits = Array.from({ length: Number(count) }, (_, index) => ({
        token: index,
        value: BigInt.asIntN(256, wordAt(bytes, 2 + index)),
      }));
      logits.sort((a, b) => (b.value > a.value ? 1 : b.value < a.value ? -1 : 0));
      return {
        kind: "rows",
        heading: `TOP ${preview.topK} OF ${count} LOGITS`,
        header: ["TOKEN", "LOGIT"],
        rows: logits
          .slice(0, preview.topK)
          .map(({ token, value }) => [`TOKEN ${token}`, value.toString()]),
      };
    }

    case "words": {
      if (bytes.length === 0 || bytes.length % 32 !== 0) return null;
      const count = bytes.length / 32;
      return {
        kind: "rows",
        heading: `${count} × 32-BYTE WORDS`,
        header: ["WORD", "VALUE"],
        rows: Array.from({ length: count }, (_, index): [string, string] => [
          `WORD ${index}`,
          wordHex(bytes, index),
        ]),
      };
    }

    case "svg": {
      const svg = abiString(bytes);
      if (!svg || !svg.trimStart().startsWith("<svg")) return null;
      // Rendered via <img>, where browsers do not execute scripts or load
      // external resources referenced by the SVG.
      return {
        kind: "figure",
        heading: "ONCHAIN SVG",
        src: `data:image/svg+xml;base64,${base64Encode(svg)}`,
      };
    }

    case "token-uri": {
      const uri = abiString(bytes);
      const prefix = "data:application/json;base64,";
      if (!uri || !uri.startsWith(prefix)) return null;
      let metadata: unknown;
      try {
        metadata = JSON.parse(atob(uri.slice(prefix.length)));
      } catch {
        return null;
      }
      if (!metadata || typeof metadata !== "object") return null;
      const record = metadata as Record<string, unknown>;
      const image = record.image;
      // Only self-contained data: images qualify; an https image would be
      // offchain content and must not be fetched or rendered.
      if (typeof image !== "string" || !image.startsWith("data:image/")) {
        return null;
      }
      return {
        kind: "figure",
        heading: "ONCHAIN TOKEN METADATA",
        src: image,
        caption: typeof record.name === "string" ? record.name : undefined,
      };
    }
  }
}
