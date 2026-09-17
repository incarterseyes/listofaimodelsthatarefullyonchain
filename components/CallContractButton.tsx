"use client";

import { useRef, useState } from "react";
import { describeResult, type CallResult } from "@/lib/ethCall";
import { prepareCall } from "@/lib/callInput";
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
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const input = target.call.input;
  const outputId = `${target.slug}-call-output`;
  const bytesId = `${outputId}-bytes`;
  const inputId = `${target.slug}-input`;

  function updateInput(value: string) {
    setInputValue(value);
    setInputError(null);
    setState({ phase: "idle" });
    setExpanded(false);
  }

  async function run() {
    let prepared;
    try {
      prepared = prepareCall(target, inputValue);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : String(error));
      inputRef.current?.focus();
      return;
    }
    setInputError(null);
    setState({ phase: "calling" });
    setExpanded(false);
    try {
      const { performCall } = await import("@/lib/ethCall");
      setState({ phase: "done", result: await performCall(prepared) });
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
    "The check reads the contract code and runs the call on public Ethereum servers.";
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
    <form onSubmit={(event) => { event.preventDefault(); void run(); }} noValidate>
      {input && (
        <div className="call-input">
          <label htmlFor={inputId}>{input.label}</label>
          <input
            ref={inputRef}
            id={inputId}
            name="model-input"
            type="text"
            inputMode={input.kind === "uint" && !input.allowHex ? "numeric" : "text"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={inputValue}
            placeholder={`e.g. ${input.example}`}
            disabled={state.phase === "calling"}
            aria-describedby={`${inputId}-hint${inputError ? ` ${inputId}-error` : ""}`}
            aria-invalid={Boolean(inputError)}
            onChange={(event) => updateInput(event.target.value)}
          />
          <p className="text dim input-hint" id={`${inputId}-hint`}>{input.hint}</p>
          {inputError && <p className="text input-error" id={`${inputId}-error`} role="alert">{inputError}</p>}
        </div>
      )}
      <div className="row-between call-actions">
        <button className="action" type="submit" disabled={state.phase === "calling"} aria-controls={outputId}>
          <span className="action-marker" aria-hidden="true">↵</span>
          <span className="action-label">{state.phase === "calling" ? "CHECKING…" : "RUN CHECK"}</span>
        </button>
        {input && (
          <button className="action example-action" type="button" disabled={state.phase === "calling"}
            onClick={() => { updateInput(input.example); inputRef.current?.focus(); }}>
            USE EXAMPLE
          </button>
        )}
      </div>
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
        Requests go from your browser to public third-party Ethereum servers.
      </p>
    </form>
  );
}
