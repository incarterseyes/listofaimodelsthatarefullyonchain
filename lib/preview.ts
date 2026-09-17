import type { OutputPreview } from "./types";
import { decodeMarketState, decodeStringReturn, hexToBytes, wordAt } from "./abiReturn";

// Decodes verified return bytes according to an entry's declared preview.
// Used once after RPC agreement for custom output validation, and again to
// render previews. Malformed output returns null instead of throwing.

export type DecodedPreview =
  | { kind: "text"; heading: string; text: string }
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

function wordHex(bytes: Uint8Array, index: number): string {
  return `0x${Array.from(bytes.slice(index * 32, index * 32 + 32), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
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
        const raw = wordAt(bytes, index * 32);
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
      const count = wordAt(bytes, 32);
      if (count > 1_000_000n || bytes.length !== 64 + Number(count) * 32) {
        return null;
      }
      const logits = Array.from({ length: Number(count) }, (_, index) => ({
        token: index,
        value: BigInt.asIntN(256, wordAt(bytes, (2 + index) * 32)),
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
      const svg = decodeStringReturn(bytes);
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
      const uri = decodeStringReturn(bytes);
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
    case "text": {
      const text = decodeStringReturn(bytes);
      return text === null ? null : { kind: "text", heading: "ONCHAIN PROGRAM PART", text };
    }
    case "market-state": {
      const state = decodeMarketState(bytes);
      if (!state) return null;
      return {
        kind: "rows",
        heading: "SAVED MODEL STATE",
        header: ["FIELD", "VALUE"],
        rows: [
          ["INPUT BLOCK", state.inputBlock],
          ["INPUTS", state.inputs || "No saved inputs"],
          ["MOOD BLOCK", state.moodBlock],
          ["MOOD", state.mood || "No saved mood"],
        ],
      };
    }
  }
}
