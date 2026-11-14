import type { OutputPreview } from "./types";
import { decodeMarketState, decodeStringReturn, hexToBytes, wordAt } from "./abiReturn";

// Decodes the returned bytes of a passed live check as the entry's preview
// declares. The live check uses it once, after the RPC endpoints agree, to
// validate custom output. The page uses it again to show the preview.
// Malformed output returns null and does not throw.

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
      // A data: URI shown in an <img>. It is never an external URL, because
      // a preview must not start a network request other than the live check.
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
      // Accept a raw pixel buffer, or one in ABI dynamic-bytes framing: a
      // 32-byte offset and a 32-byte length before the payload.
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
                : `not true or false (${value})`
            : value.toString();
        return [label, text];
      });
      return {
        kind: "rows",
        heading: "FIELDS",
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
        heading: `TOP ${preview.topK} OF ${count} TOKEN SCORES`,
        header: ["TOKEN", "SCORE"],
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
      // Shown in an <img>. There, browsers do not run scripts in the SVG and
      // do not load external resources that it names.
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
      // Only an image in a data: URI qualifies. An https image is offchain
      // content, so the page must not fetch it or show it.
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
