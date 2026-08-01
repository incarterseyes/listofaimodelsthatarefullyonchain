"use client";

import { useState } from "react";
import { describeResult, type CallResult } from "@/lib/ethCall";
import type { CallTarget } from "@/lib/types";
import { OutputPreview } from "./OutputPreview";

const TRUNCATE_AT = 202; // "0x" + 200 hex characters

type UiState =
  | { phase: "idle" }
  | { phase: "calling" }
  | { phase: "done"; result: CallResult };

export function CallContractButton({ target }: { target: CallTarget }) {
  const [state, setState] = useState<UiState>({ phase: "idle" });
  const [expanded, setExpanded] = useState(false);
  const outputId = `${target.slug}-call-output`;
  const bytesId = `${outputId}-bytes`;

  async function run() {
    setState({ phase: "calling" });
    setExpanded(false);
    try {
      const { performCall } = await import("@/lib/ethCall");
      setState({ phase: "done", result: await performCall(target) });
    } catch (error) {
      setState({
        phase: "done",
        result: {
          status: "unreachable",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  let line: React.ReactNode =
    "Checks deployed code, then runs eth_call through configured public RPCs.";
  let className = "text out";
  let returnedResult: Extract<CallResult, { status: "returned" }> | null = null;
  let observations: string[] | null = null;

  if (state.phase === "calling") {
    line = "checking ETHEREUM...";
  } else if (state.phase === "done") {
    const result = state.result;
    const described = describeResult(result);
    className = described.ok ? "text out out-returned" : "text out out-fail";
    line = described.message;
    observations = described.details ?? null;
    if (result.status === "returned") {
      returnedResult = result;
    }
  }

  return (
    <>
      <p
        className={className}
        id={outputId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-busy={state.phase === "calling"}
      >
        {line}
      </p>
      {returnedResult && (() => {
        const isLong = returnedResult.bytes.length > TRUNCATE_AT;
        const visibleBytes =
          expanded || !isLong
            ? returnedResult.bytes
            : `${returnedResult.bytes.slice(0, TRUNCATE_AT)}…`;
        const hiddenBytes = Math.max(
          0,
          (returnedResult.bytes.length - TRUNCATE_AT) / 2,
        );

        return (
          <p className="text out raw-result">
            <span className="sr-only">Raw return bytes: </span>
            <span id={bytesId}>{visibleBytes}</span>
            {isLong && (
              <>
                {" "}
                <button
                  className="action result-toggle"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={bytesId}
                  aria-label={
                    expanded
                      ? "Collapse returned bytes"
                      : `Show all ${returnedResult.byteLength} returned bytes`
                  }
                  onClick={() => setExpanded((current) => !current)}
                >
                  [{expanded ? "collapse" : `+${hiddenBytes} bytes`}]
                </button>
              </>
            )}
          </p>
        );
      })()}
      {returnedResult && target.preview && (
        <OutputPreview spec={target.preview} bytes={returnedResult.bytes} />
      )}
      {observations && (
        <ul className="text dim rpc-observations">
          {observations.map((observation) => (
            <li key={observation}>{observation}</li>
          ))}
        </ul>
      )}
      <p className="text dim">{target.call.note}</p>
      <p className="text dim rpc-notice">
        The requests go from your browser to third-party public RPC endpoints.
      </p>
      <div className="row-between">
        <button
          className="action"
          type="button"
          onClick={run}
          disabled={state.phase === "calling"}
          aria-controls={outputId}
        >
          <span className="action-marker" aria-hidden="true">
            ↵
          </span>
          <span className="action-label">RUN CHECK</span>
        </button>
        <span className="mode-label">{target.mode.replaceAll("_", " ")}</span>
      </div>
    </>
  );
}
