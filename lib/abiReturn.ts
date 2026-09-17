// Strict decoders for the variable-length results used by manual calls.
// Offsets, payload lengths, padding and the complete encoded size must agree.
const MAX_RETURN_BYTES = 10_000_000;

export function hexToBytes(hex: string): Uint8Array | null {
  if (
    hex.length > MAX_RETURN_BYTES * 2 + 2 ||
    hex.length % 2 !== 0 ||
    !/^0x[0-9a-fA-F]*$/.test(hex)
  ) return null;
  const bytes = new Uint8Array((hex.length - 2) / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(2 + i * 2, 4 + i * 2), 16);
  }
  return bytes;
}

// Read a 32-byte ABI word at a byte offset. Callers check the buffer bounds.
export function wordAt(bytes: Uint8Array, offset: number): bigint {
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
  if (bytes.subarray(offset + 32 + Number(length), end).some((byte) => byte !== 0)) return null;
  try {
    return {
      value: new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(offset + 32, offset + 32 + Number(length))),
      end,
    };
  } catch {
    return null;
  }
}

export function decodeStringReturn(bytes: Uint8Array): string | null {
  if (bytes.length > MAX_RETURN_BYTES || bytes.length < 64 || wordAt(bytes, 0) !== 32n) return null;
  const decoded = stringAt(bytes, 32);
  return decoded && decoded.end === bytes.length ? decoded.value : null;
}

export function decodeMarketState(bytes: Uint8Array): { inputBlock: string; inputs: string; moodBlock: string; mood: string } | null {
  if (bytes.length > MAX_RETURN_BYTES || bytes.length < 192 || wordAt(bytes, 32) !== 128n) return null;
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
