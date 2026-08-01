import type { CallTarget } from "./types";

// Ethereum mainnet endpoints; the quorum below requires >= 2 to agree.
export const RPC_URLS = [
  "https://ethereum-rpc.publicnode.com",
  "https://rpc.mevblocker.io",
  "https://eth.drpc.org",
] as const;
const CHAIN_ID = 1;

const RPC_TIMEOUT_MS = 15_000;
const RPC_RETRY_DELAY_MS = 1_000;
const RETRYABLE_HTTP_STATUSES = new Set([429, 502, 503, 504]);
const HEX_BYTES = /^0x(?:[0-9a-fA-F]{2})*$/;
const HEX_QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const BLOCK_HASH = /^0x[0-9a-fA-F]{64}$/;

type Hex = `0x${string}`;

class EndpointError extends Error {}

class JsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

function retryDelay(response: Response): number {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, 2_000);
    }
  }
  return RPC_RETRY_DELAY_MS;
}

async function rpcRequest(
  url: string,
  method:
    | "eth_blockNumber"
    | "eth_call"
    | "eth_chainId"
    | "eth_getBlockByNumber"
    | "eth_getCode",
  params: unknown[],
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let currentResponse: Response;
      try {
        currentResponse = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        });
      } catch (error) {
        throw new EndpointError(errorMessage(error));
      }
      response = currentResponse;

      if (
        currentResponse.ok ||
        attempt > 0 ||
        !RETRYABLE_HTTP_STATUSES.has(currentResponse.status)
      ) {
        break;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay(currentResponse)),
      );
    }

    if (!response) {
      throw new EndpointError("RPC returned no response");
    }
    if (!response.ok) {
      throw new EndpointError(`HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new EndpointError("RPC returned invalid JSON");
    }

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new EndpointError("RPC returned an invalid response");
    }

    const record = payload as Record<string, unknown>;
    const hasResult = Object.hasOwn(record, "result");
    const hasError = Object.hasOwn(record, "error");
    if (
      record.jsonrpc !== "2.0" ||
      record.id !== 1 ||
      hasResult === hasError
    ) {
      throw new EndpointError("RPC returned an invalid JSON-RPC envelope");
    }

    if (hasError) {
      const error = record.error;
      if (!error || typeof error !== "object" || Array.isArray(error)) {
        throw new EndpointError("RPC returned an invalid error");
      }
      const code = "code" in error && typeof error.code === "number" ? error.code : 0;
      const message =
        "message" in error && typeof error.message === "string"
          ? error.message
          : "JSON-RPC request failed";
      throw new JsonRpcError(code, message.slice(0, 300));
    }

    return record.result;
  } finally {
    clearTimeout(timeout);
  }
}

function isHexBytes(value: unknown): value is Hex {
  return typeof value === "string" && HEX_BYTES.test(value);
}

function parseQuantity(value: unknown, method: string): bigint {
  if (typeof value !== "string" || !HEX_QUANTITY.test(value)) {
    throw new EndpointError(`${method} returned an invalid quantity`);
  }
  return BigInt(value);
}

function isRevert(error: JsonRpcError): boolean {
  return /revert|invalid opcode|execution (?:error|failed)/i.test(error.message);
}

type VerifiedResult =
  | { status: "returned"; bytes: Hex; byteLength: number }
  | { status: "empty" }
  | { status: "mismatch"; actualBytes: number; expectedBytes: number }
  | { status: "no-code" }
  | { status: "reverted"; reason: string };

type ReturnedResult = Extract<VerifiedResult, { status: "returned" }> & {
  blockNumber: Hex;
  providers: number;
};

export type CallResult =
  | ReturnedResult
  | Exclude<VerifiedResult, { status: "returned" }>
  | {
      status: "unconfirmed";
      result: VerifiedResult;
      observations: string[];
    }
  | { status: "disagreement"; observations: string[] }
  | { status: "unreachable"; message: string };

async function probeEndpoint(url: string): Promise<bigint> {
  const reportedChainId = parseQuantity(
    await rpcRequest(url, "eth_chainId", []),
    "eth_chainId",
  );
  if (reportedChainId !== BigInt(CHAIN_ID)) {
    throw new EndpointError(
      `RPC reported chain ${reportedChainId}; expected ${CHAIN_ID}`,
    );
  }

  return parseQuantity(
    await rpcRequest(url, "eth_blockNumber", []),
    "eth_blockNumber",
  );
}

async function verifyEndpoint(
  url: string,
  entry: CallTarget,
  blockNumber: bigint,
  blockTag: Hex,
): Promise<{ blockHash: Hex; code: Hex; result: VerifiedResult }> {
  const rawBlock = await rpcRequest(url, "eth_getBlockByNumber", [blockTag, false]);
  if (!rawBlock || typeof rawBlock !== "object" || Array.isArray(rawBlock)) {
    throw new EndpointError(`block ${blockTag} is unavailable`);
  }
  const block = rawBlock as Record<string, unknown>;
  if (
    parseQuantity(block.number, "eth_getBlockByNumber") !== blockNumber ||
    typeof block.hash !== "string" ||
    !BLOCK_HASH.test(block.hash)
  ) {
    throw new EndpointError("eth_getBlockByNumber returned an invalid block");
  }
  const blockHash = block.hash as Hex;
  const blockSelector = { blockHash, requireCanonical: true };

  const code = await rpcRequest(url, "eth_getCode", [
    entry.address,
    blockSelector,
  ]);
  if (!isHexBytes(code)) {
    throw new EndpointError("eth_getCode returned invalid bytes");
  }
  if (code === "0x") {
    return { blockHash, code, result: { status: "no-code" } };
  }

  let data: unknown;
  try {
    data = await rpcRequest(url, "eth_call", [
      { to: entry.address, data: entry.call.calldata },
      blockSelector,
    ]);
  } catch (error) {
    if (error instanceof JsonRpcError && isRevert(error)) {
      return {
        blockHash,
        code,
        result: { status: "reverted", reason: error.message },
      };
    }
    throw error;
  }

  if (!isHexBytes(data)) {
    throw new EndpointError("eth_call returned invalid bytes");
  }
  if (data === "0x") {
    return { blockHash, code, result: { status: "empty" } };
  }

  const byteLength = (data.length - 2) / 2;
  if (byteLength !== entry.call.expectedReturnBytes) {
    return {
      blockHash,
      code,
      result: {
        status: "mismatch",
        actualBytes: byteLength,
        expectedBytes: entry.call.expectedReturnBytes,
      },
    };
  }
  return {
    blockHash,
    code,
    result: { status: "returned", bytes: data, byteLength },
  };
}

function outcomeKey(result: VerifiedResult): string {
  switch (result.status) {
    case "returned":
      return `returned:${result.bytes.toLowerCase()}`;
    case "mismatch":
      return `mismatch:${result.actualBytes}:${result.expectedBytes}`;
    case "reverted":
      return "reverted";
    default:
      return result.status;
  }
}

function summarizeOutcome(result: VerifiedResult): string {
  switch (result.status) {
    case "returned": {
      const preview =
        result.bytes.length <= 22
          ? result.bytes
          : `${result.bytes.slice(0, 12)}…${result.bytes.slice(-8)}`;
      return `returned ${result.byteLength} expected bytes (${preview})`;
    }
    case "empty":
      return "returned no bytes";
    case "mismatch":
      return `returned ${result.actualBytes} bytes; expected ${result.expectedBytes}`;
    case "no-code":
      return "reported no deployed bytecode";
    case "reverted":
      return `reverted: ${result.reason}`;
  }
}

function endpointName(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

type EndpointCheck =
  | {
      url: string;
      blockHash: Hex;
      code: Hex;
      result: VerifiedResult;
    }
  | { url: string; error: string };

function summarizeCheck(check: EndpointCheck, blockTag: Hex): string {
  if ("error" in check) {
    return `${endpointName(check.url)}: unavailable — ${check.error}`;
  }
  return `${endpointName(check.url)}: block ${BigInt(blockTag)} (${check.blockHash.slice(0, 12)}…), ${summarizeOutcome(check.result)}`;
}

export async function performCall(entry: CallTarget): Promise<CallResult> {
  const probes = await Promise.all(
    RPC_URLS.map(async (url) => {
      try {
        return {
          url,
          head: await probeEndpoint(url),
        } as const;
      } catch (error) {
        return { url, error: errorMessage(error) } as const;
      }
    }),
  );
  const availableProbes = probes.filter(
    (probe): probe is Extract<(typeof probes)[number], { head: bigint }> =>
      "head" in probe,
  );
  if (availableProbes.length === 0) {
    return {
      status: "unreachable",
      message: probes
        .map((probe) => `${endpointName(probe.url)}: ${probe.error}`)
        .join("; "),
    };
  }

  let commonBlock = availableProbes[0].head;
  for (const probe of availableProbes.slice(1)) {
    if (probe.head < commonBlock) commonBlock = probe.head;
  }
  const blockTag = `0x${commonBlock.toString(16)}` as Hex;

  const checks: EndpointCheck[] = await Promise.all(
    probes.map(async (probe) => {
      if (probe.head === undefined) {
        return { url: probe.url, error: probe.error };
      }
      try {
        return {
          url: probe.url,
          ...(await verifyEndpoint(probe.url, entry, commonBlock, blockTag)),
        };
      } catch (error) {
        return { url: probe.url, error: errorMessage(error) };
      }
    }),
  );
  const completed = checks.filter(
    (check): check is Extract<EndpointCheck, { result: VerifiedResult }> =>
      "result" in check,
  );
  if (completed.length === 0) {
    return {
      status: "unreachable",
      message: checks.map((check) => summarizeCheck(check, blockTag)).join("; "),
    };
  }

  const agreementKeys = completed.map(
    ({ blockHash, code, result }) =>
      `${blockHash.toLowerCase()}:${code.toLowerCase()}:${outcomeKey(result)}`,
  );
  if (new Set(agreementKeys).size > 1) {
    return {
      status: "disagreement",
      observations: checks.map((check) => summarizeCheck(check, blockTag)),
    };
  }

  const agreedResult = completed[0].result;
  if (completed.length < 2) {
    return {
      status: "unconfirmed",
      result: agreedResult,
      observations: checks.map((check) => summarizeCheck(check, blockTag)),
    };
  }

  if (agreedResult.status === "returned") {
    return {
      ...agreedResult,
      blockNumber: blockTag,
      providers: completed.length,
    };
  }
  return agreedResult;
}

export interface CallDescription {
  ok: boolean;
  message: string;
  details?: string[];
}

// Single source of the user-facing copy for every outcome, shared by the
// browser button and scripts/verify-models.ts.
export function describeResult(result: CallResult): CallDescription {
  switch (result.status) {
    case "returned":
      return {
        ok: true,
        message: `passed: ${result.providers} RPC endpoints agreed at block ${BigInt(result.blockNumber)} that deployed code exists and eth_call returns the expected ${result.byteLength} bytes.`,
      };
    case "empty":
      return { ok: false, message: "failed: eth_call returned no bytes." };
    case "mismatch":
      return {
        ok: false,
        message: `failed: returned ${result.actualBytes} bytes; expected ${result.expectedBytes}.`,
      };
    case "no-code":
      return {
        ok: false,
        message: "failed: the address has no deployed bytecode.",
      };
    case "reverted":
      return { ok: false, message: `reverted: ${result.reason}` };
    case "disagreement":
      return {
        ok: false,
        message: "failed: configured RPC endpoints returned conflicting results.",
        details: result.observations,
      };
    case "unconfirmed":
      return {
        ok: false,
        message:
          "inconclusive: fewer than two RPC endpoints completed the same verification.",
        details: result.observations,
      };
    case "unreachable":
      return {
        ok: false,
        message: `could not complete the check: ${result.message}`,
      };
  }
}
