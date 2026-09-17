// Strict decoders for the variable-length results used by manual calls.
// Offsets, payload lengths, padding and the complete encoded size must agree.
const MAX_RETURN_BYTES = 10_000_000;

function bytesFromHex(hex: string): Uint8Array | null {
  if (hex.length > MAX_RETURN_BYTES * 2 + 2 || !/^0x(?:[0-9a-fA-F]{2})*$/.test(hex)) return null;
  return Uint8Array.from(hex.slice(2).match(/../g) ?? [], (byte) => parseInt(byte, 16));
}

function wordAt(bytes: Uint8Array, offset: number): bigint {
  let word = 0n;
  for (let i = offset; i < offset + 32; i++) word = (word << 8n) | BigInt(bytes[i]);
  return word;
}

function stringAt(bytes: Uint8Array, offset: number): { value: string; end: number } | null {
  if (offset + 32 > bytes.length) return null;
  const length = wordAt(bytes, offset);
  if (length > BigInt(MAX_RETURN_BYTES)) return null;
  const end = offset + 32 + Math.ceil(Number(length) / 32) * 32;
  if (end > bytes.length) return null;
  if (bytes.slice(offset + 32 + Number(length), end).some((byte) => byte !== 0)) return null;
  try {
    return {
      value: new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(offset + 32, offset + 32 + Number(length))),
      end,
    };
  } catch {
    return null;
  }
}

export function decodeStringReturn(hex: string): string | null {
  const bytes = bytesFromHex(hex);
  if (!bytes || bytes.length < 64 || wordAt(bytes, 0) !== 32n) return null;
  const decoded = stringAt(bytes, 32);
  return decoded && decoded.end === bytes.length ? decoded.value : null;
}

export function decodeMarketState(hex: string): { inputBlock: string; inputs: string; moodBlock: string; mood: string } | null {
  const bytes = bytesFromHex(hex);
  if (!bytes || bytes.length < 192 || wordAt(bytes, 32) !== 128n) return null;
  const inputs = stringAt(bytes, 128);
  if (!inputs || wordAt(bytes, 96) !== BigInt(inputs.end)) return null;
  const mood = stringAt(bytes, inputs.end);
  if (!mood || mood.end !== bytes.length) return null;
  return {
    inputBlock: wordAt(bytes, 0).toString(),
    inputs: inputs.value,
    moodBlock: wordAt(bytes, 64).toString(),
    mood: mood.value,
  };
}
