import assert from "node:assert/strict";
import test from "node:test";
import { describeResult, performCall, RPC_URLS } from "@/lib/ethCall";
import type { CallTarget, PreparedCallTarget } from "@/lib/types";

const target: CallTarget = {
  slug: "test-model",
  address: "0x0000000000000000000000000000000000000001",
  call: {
    calldata: "0x1234",
    expectedReturnBytes: 1,
    note: "test call",
  },
};

const endpointUrls: readonly string[] = RPC_URLS;
const BLOCK_NUMBER = "0x100";
const BLOCK_HASH = `0x${"ab".repeat(32)}`;

function rpcResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function requestBody(init?: RequestInit): { method: string; params: unknown[] } {
  if (typeof init?.body !== "string") {
    throw new Error("expected a JSON string request body");
  }
  const request = JSON.parse(init.body) as {
    method?: unknown;
    params?: unknown;
  };
  if (typeof request.method !== "string" || !Array.isArray(request.params)) {
    throw new Error("expected a JSON-RPC method");
  }
  return { method: request.method, params: request.params };
}

function requestMethod(init?: RequestInit): string {
  return requestBody(init).method;
}

function successFor(method: string, callResult = "0xaa") {
  switch (method) {
    case "eth_chainId":
      return rpcResponse({ jsonrpc: "2.0", id: 1, result: "0x1" });
    case "eth_blockNumber":
      return rpcResponse({ jsonrpc: "2.0", id: 1, result: BLOCK_NUMBER });
    case "eth_getBlockByNumber":
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { number: BLOCK_NUMBER, hash: BLOCK_HASH },
      });
    case "eth_getCode":
      return rpcResponse({ jsonrpc: "2.0", id: 1, result: "0x6000" });
    case "eth_call":
      return rpcResponse({ jsonrpc: "2.0", id: 1, result: callResult });
    default:
      throw new Error(`unexpected method: ${method}`);
  }
}

test("configured endpoints must agree on a successful result", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => successFor(requestMethod(init)),
  );

  assert.deepEqual(await performCall(target), {
    status: "returned",
    bytes: "0xaa",
    byteLength: 1,
    blockNumber: BLOCK_NUMBER,
    providers: endpointUrls.length,
  });
});

test("contract-supplied offchain URLs are never fetched", async (context) => {
  const requestedUrls: string[] = [];
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    requestedUrls.push(String(input));
    const method = requestMethod(init);
    if (method !== "eth_call") return successFor(method);
    return rpcResponse({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: 3,
        message: "execution reverted: OffchainLookup",
        data: { urls: ["https://attacker.example/{data}"] },
      },
    });
  });

  const result = await performCall(target);

  assert.equal(result.status, "reverted");
  assert.equal(requestedUrls.length, endpointUrls.length * 5);
  assert.equal(
    requestedUrls.some((url) => url.includes("attacker.example")),
    false,
  );
});

test("unexpected raw return sizes fail verification", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => successFor(requestMethod(init), "0x0001"),
  );

  assert.deepEqual(await performCall(target), {
    status: "mismatch",
    actualBytes: 2,
    expectedBytes: 1,
  });
});

test("invalid JSON-RPC envelopes are never trusted", async (context) => {
  let requestCount = 0;
  context.mock.method(globalThis, "fetch", async () => {
    requestCount += 1;
    return rpcResponse({ jsonrpc: "2.0", id: 999, result: "0x1" });
  });

  const result = await performCall(target);

  assert.equal(result.status, "unreachable");
  assert.match(result.status === "unreachable" ? result.message : "", /envelope/);
  assert.equal(requestCount, endpointUrls.length);
});

test("endpoints on the wrong chain are rejected before contract reads", async (context) => {
  const methods: string[] = [];
  context.mock.method(globalThis, "fetch", async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    methods.push(requestMethod(init));
    return rpcResponse({ jsonrpc: "2.0", id: 1, result: "0xa" });
  });

  const result = await performCall(target);

  assert.equal(result.status, "unreachable");
  assert.match(result.status === "unreachable" ? result.message : "", /chain 10/);
  assert.deepEqual(methods, endpointUrls.map(() => "eth_chainId"));
});

test("a semantic failure and a success are reported as disagreement", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    if (method === "eth_getCode" && String(input) === endpointUrls[0]) {
      return rpcResponse({ jsonrpc: "2.0", id: 1, result: "0x" });
    }
    return successFor(method);
  });

  const result = await performCall(target);

  assert.equal(result.status, "disagreement");
  assert.deepEqual(
    result.status === "disagreement"
      ? result.observations.map((value) =>
          value.includes("reported no contract code") ? "no-code" : "returned",
        )
      : [],
    ["no-code", ...endpointUrls.slice(1).map(() => "returned")],
  );
});

test("same-size but different return payloads are disagreement", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    const callResult = String(input) === endpointUrls[0] ? "0xaa" : "0xbb";
    return successFor(method, callResult);
  });

  const result = await performCall(target);

  assert.equal(result.status, "disagreement");
  assert.equal(
    result.status === "disagreement" ? result.observations.length : 0,
    endpointUrls.length,
  );
});

test("one surviving endpoint is explicitly unconfirmed", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (String(input) !== endpointUrls.at(-1)) {
      return new Response("unavailable", {
        status: 503,
        headers: { "Retry-After": "0" },
      });
    }
    return successFor(requestMethod(init));
  });

  const result = await performCall(target);

  assert.equal(result.status, "unconfirmed");
  assert.equal(
    result.status === "unconfirmed" ? result.result.status : "",
    "returned",
  );
  assert.equal(
    result.status === "unconfirmed" ? result.observations.length : 0,
    endpointUrls.length,
  );
});

test("two agreeing endpoints can tolerate one unavailable provider", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    if (String(input) === endpointUrls[0]) {
      return new Response("unavailable", {
        status: 503,
        headers: { "Retry-After": "0" },
      });
    }
    return successFor(requestMethod(init));
  });

  const result = await performCall(target);

  assert.equal(result.status, "returned");
  assert.equal(
    result.status === "returned" ? result.providers : 0,
    endpointUrls.length - 1,
  );
});

test("one endpoint that refuses to run the call does not veto a quorum", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    // A public node that caps eth_call gas rejects the call with a bare
    // "execution reverted" while the others run it to the end.
    if (method === "eth_call" && String(input) === endpointUrls[0]) {
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 3, message: "execution reverted", data: "0x" },
      });
    }
    return successFor(method);
  });

  const result = await performCall(target);

  assert.equal(result.status, "returned");
  assert.equal(
    result.status === "returned" ? result.providers : 0,
    endpointUrls.length - 1,
  );
  assert.deepEqual(
    result.status === "returned" ? (result.refusals?.length ?? 0) : 0,
    1,
  );
  const described = describeResult(result);
  assert.equal(described.ok, true);
  assert.match(described.details?.join(" ") ?? "", /refused to run the call/);
});

test("a refusal is still a failure when every endpoint reverts", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    _input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    if (method === "eth_call") {
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 3, message: "execution reverted", data: "0x" },
      });
    }
    return successFor(method);
  });

  assert.equal((await performCall(target)).status, "reverted");
});

test("a refusal cannot rescue endpoints that disagree on the bytes", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    if (method === "eth_call" && String(input) === endpointUrls[0]) {
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 3, message: "execution reverted", data: "0x" },
      });
    }
    return successFor(
      method,
      String(input) === endpointUrls[1] ? "0xaa" : "0xbb",
    );
  });

  assert.equal((await performCall(target)).status, "disagreement");
});

test("a refusal cannot mask a differing block hash", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    if (method === "eth_call" && String(input) === endpointUrls[0]) {
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 3, message: "execution reverted", data: "0x" },
      });
    }
    if (method === "eth_getBlockByNumber" && String(input) === endpointUrls[1]) {
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        result: { number: BLOCK_NUMBER, hash: `0x${"cd".repeat(32)}` },
      });
    }
    return successFor(method);
  });

  assert.equal((await performCall(target)).status, "disagreement");
});

test("a single executing endpoint cannot form a quorum on its own", async (context) => {
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    if (method === "eth_call" && String(input) !== endpointUrls.at(-1)) {
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        error: { code: 3, message: "execution reverted", data: "0x" },
      });
    }
    return successFor(method);
  });

  assert.equal((await performCall(target)).status, "disagreement");
});

test("providers are compared at the same available block", async (context) => {
  const blockTags: unknown[] = [];
  const blockSelectors: unknown[] = [];
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const request = requestBody(init);
    if (request.method === "eth_blockNumber") {
      return rpcResponse({
        jsonrpc: "2.0",
        id: 1,
        result: String(input) === endpointUrls[0] ? "0x100" : "0x101",
      });
    }
    if (request.method === "eth_getBlockByNumber") {
      blockTags.push(request.params[0]);
    }
    if (request.method === "eth_getCode" || request.method === "eth_call") {
      blockSelectors.push(request.params[1]);
    }
    return successFor(request.method);
  });

  const result = await performCall(target);

  assert.equal(result.status, "returned");
  assert.equal(result.status === "returned" ? result.blockNumber : "", "0x100");
  assert.deepEqual(blockTags, endpointUrls.map(() => "0x100"));
  assert.deepEqual(
    blockSelectors,
    endpointUrls.flatMap(() =>
      Array.from({ length: 2 }, () => ({
        blockHash: BLOCK_HASH,
        requireCanonical: true,
      })),
    ),
  );
});

test("transient provider throttling is retried once", async (context) => {
  let throttledRequests = 0;
  context.mock.method(globalThis, "fetch", async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const method = requestMethod(init);
    if (
      String(input) === endpointUrls[0] &&
      method === "eth_chainId" &&
      throttledRequests++ === 0
    ) {
      return new Response("rate limited", {
        status: 429,
        headers: { "Retry-After": "0" },
      });
    }
    return successFor(method);
  });

  const result = await performCall(target);

  assert.equal(result.status, "returned");
  assert.equal(throttledRequests, 2);
});

test("every outcome maps to stable user-facing copy", () => {
  const observations = ["host-a: returned no bytes", "host-b: returned 1 byte"];

  assert.deepEqual(
    describeResult({
      status: "returned",
      bytes: "0xaa",
      byteLength: 1,
      blockNumber: "0x100",
      providers: 3,
    }),
    {
      ok: true,
      message:
        "passed: 3 public Ethereum servers agreed at block 256 that the contract code exists and the call returns the same 1 bytes.",
    },
  );
  assert.deepEqual(describeResult({ status: "empty" }), {
    ok: false,
    message: "failed: the call returned no bytes.",
  });
  assert.deepEqual(
    describeResult({ status: "mismatch", actualBytes: 2, expectedBytes: 1 }),
    { ok: false, message: "failed: the call returned 2 bytes; the entry expects 1." },
  );
  assert.deepEqual(describeResult({ status: "no-code" }), {
    ok: false,
    message: "failed: no contract code exists at this address.",
  });
  assert.deepEqual(describeResult({ status: "reverted", reason: "nope" }), {
    ok: false,
    message: "failed: the contract rejected the call: nope",
  });
  assert.deepEqual(describeResult({ status: "disagreement", observations }), {
    ok: false,
    message: "failed: the public Ethereum servers returned different results.",
    details: observations,
  });
  assert.deepEqual(
    describeResult({
      status: "unconfirmed",
      result: { status: "empty" },
      observations,
    }),
    {
      ok: false,
      message:
        "not confirmed: fewer than two public Ethereum servers completed the same check.",
      details: observations,
    },
  );
  assert.deepEqual(describeResult({ status: "unreachable", message: "down" }), {
    ok: false,
    message: "could not complete the check: down",
  });
});

const dynamicTarget: PreparedCallTarget = {
  ...target,
  call: { calldata: "0x1234", note: "custom input", returnShape: "svg" },
};

function stringResult(value: string): string {
  const bytes = Buffer.from(value);
  return "0x" + (32).toString(16).padStart(64, "0") + bytes.length.toString(16).padStart(64, "0")
    + bytes.toString("hex").padEnd(Math.ceil(bytes.length / 32) * 64, "0");
}

test("custom calls accept variable result sizes only when the output format and RPC bytes agree", async (context) => {
  let output = stringResult("<svg/>");
  context.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => successFor(requestMethod(init), output));
  assert.equal((await performCall(dynamicTarget)).status, "returned");
  output = stringResult('<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20"/></svg>');
  const result = await performCall(dynamicTarget);
  assert.equal(result.status, "returned");
  if (result.status === "returned") {
    assert.equal(result.byteLength, (output.length - 2) / 2);
    assert.equal(result.providers, endpointUrls.length);
  }
  output = stringResult("not an SVG");
  const invalid = await performCall(dynamicTarget);
  assert.equal(invalid.status, "invalid-output");
  assert.deepEqual(invalid, {
    status: "invalid-output",
    bytes: output,
    byteLength: 96,
    expectedShape: "svg",
    blockNumber: BLOCK_NUMBER,
    providers: endpointUrls.length,
  });
  const description = describeResult(invalid);
  assert.equal(description.ok, false);
  assert.deepEqual(description.details, [
    "Expected output format: svg.",
    `${endpointUrls.length} public Ethereum servers agreed at block 256 on 96 returned bytes.`,
  ]);
  output = stringResult("<svg/>").slice(0, -2);
  assert.equal((await performCall(dynamicTarget)).status, "invalid-output");
});

test("custom output formats never bypass byte agreement or the two-provider requirement", async (context) => {
  let single = false;
  context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const first = String(input) === endpointUrls[0];
    if (single && !first) return new Response("down", { status: 500 });
    return successFor(requestMethod(init), stringResult(first ? "<svg/>" : "<svg />"));
  });
  assert.equal((await performCall(dynamicTarget)).status, "disagreement");
  single = true;
  assert.equal((await performCall(dynamicTarget)).status, "unconfirmed");
});

test("custom output is decoded once after agreement, and never for disagreement or a lone provider", async (context) => {
  const metadata = JSON.stringify({ image: "data:image/gif;base64,R0lGODlh" });
  const uri = "data:application/json;base64," + Buffer.from(metadata).toString("base64");
  const output = stringResult(uri);
  const originalAtob = globalThis.atob;
  const decode = context.mock.method(globalThis, "atob", originalAtob);
  let mode: "agreed" | "different" | "single" = "agreed";
  context.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const first = String(input) === endpointUrls[0];
    if (mode === "single" && !first) return new Response("down", { status: 500 });
    return successFor(requestMethod(init), mode === "different" && !first ? stringResult("unexpected") : output);
  });
  const entry: PreparedCallTarget = {
    ...target,
    call: { calldata: target.call.calldata, note: "custom input", returnShape: "token-uri" },
  };
  assert.equal((await performCall(entry)).status, "returned");
  assert.equal(decode.mock.callCount(), 1);
  decode.mock.resetCalls();
  mode = "different";
  assert.equal((await performCall(entry)).status, "disagreement");
  assert.equal(decode.mock.callCount(), 0);
  mode = "single";
  assert.equal((await performCall(entry)).status, "unconfirmed");
  assert.equal(decode.mock.callCount(), 0);
});

test("agreed empty program text passes output validation", async (context) => {
  const output = stringResult("");
  context.mock.method(globalThis, "fetch", async (_input: RequestInfo | URL, init?: RequestInit) => successFor(requestMethod(init), output));
  const entry: PreparedCallTarget = {
    ...target,
    call: { calldata: target.call.calldata, note: "custom input", returnShape: "text" },
  };
  const result = await performCall(entry);
  assert.equal(result.status, "returned");
  assert.equal(result.status === "returned" ? result.byteLength : 0, 64);
});
