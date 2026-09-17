import type { CallInput, CallTarget, PreparedCallTarget } from "./types";

const UINT256_MAX = (1n << 256n) - 1n;

function word(value: bigint): string {
  return value.toString(16).padStart(64, "0");
}

function parseUint(raw: string, max: bigint, allowHex = false): bigint {
  const value = raw.trim();
  const pattern = allowHex ? /^(?:[0-9]+|0x[0-9a-fA-F]+)$/ : /^[0-9]+$/;
  if (value.length > 78 || !pattern.test(value)) {
    throw new Error(allowHex
      ? "Enter a whole number or a hexadecimal seed starting with 0x."
      : "Enter a whole number, using digits only.");
  }
  const number = BigInt(value);
  if (number > max || number > UINT256_MAX) {
    throw new Error(`Enter a value from 0 to ${max}.`);
  }
  return number;
}

function encodeInput(calldata: `0x${string}`, input: CallInput, raw: string): `0x${string}` {
  const selector = calldata.slice(0, 10);
  if (input.kind === "uint") {
    const value = parseUint(raw, BigInt(input.max), input.allowHex);
    const start = 10 + input.word * 64;
    if (start + 64 > calldata.length) throw new Error("The entry has an invalid input position.");
    return `${calldata.slice(0, start)}${word(value)}${calldata.slice(start + 64)}` as `0x${string}`;
  }
  if (input.kind === "text") {
    // Preserve exactly what the visitor typed; each entry defines its own
    // alphabet and error message. Patterns are checked at registry load time.
    if (!new RegExp(input.pattern, "u").test(raw)) {
      throw new Error(input.patternMessage);
    }
    const bytes = new TextEncoder().encode(raw);
    if (bytes.length > input.maxBytes) throw new Error(`Use at most ${input.maxBytes} bytes of text.`);
    const wordCount = raw.trim() ? raw.trim().split(/\s+/u).length : 0;
    if (wordCount > input.maxWords) throw new Error(`Use at most ${input.maxWords} words.`);
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${selector}${word(32n)}${word(BigInt(bytes.length))}${hex.padEnd(Math.ceil(bytes.length / 32) * 64, "0")}` as `0x${string}`;
  }
  const value = raw.trim();
  if (!/^\d+(?:(?:\s*,\s*|\s+)\d+)*$/.test(value)) {
    throw new Error("Enter token IDs separated by spaces or commas.");
  }
  const tokens = value.split(/[\s,]+/);
  if (tokens.length > input.maxItems) throw new Error(`Use at most ${input.maxItems} token IDs.`);
  const values = tokens.map((token) => parseUint(token, BigInt(input.maxValue)));
  return `${selector}${word(32n)}${word(BigInt(values.length))}${values.map(word).join("")}` as `0x${string}`;
}

export function prepareCall(target: CallTarget, raw: string): PreparedCallTarget {
  const input = target.call.input;
  if (!input) return target;
  if (raw.length > 10_000) throw new Error("The input is too long.");
  const calldata = encodeInput(target.call.calldata, input, raw);
  // An example still gets the original exact-size check, even when entered
  // with equivalent spelling (leading zeroes, hexadecimal, other separators).
  const useShape = calldata.toLowerCase() !== target.call.calldata.toLowerCase()
    && target.call.manualReturn;
  return {
    ...target,
    call: {
      calldata,
      note: target.call.note,
      ...(useShape
        ? { returnShape: useShape }
        : { expectedReturnBytes: target.call.expectedReturnBytes }),
    },
  };
}
