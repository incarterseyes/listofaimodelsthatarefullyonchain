export type PreviewFieldType = "bool" | "uint8" | "uint256" | "int256";

// Declares how to decode the call's verified return bytes into a
// human-readable preview. Rendering happens in components/OutputPreview.tsx.
export type OutputPreview =
  | { kind: "grayscale-image"; width: number; height: number; note?: string }
  | {
      kind: "fields";
      fields: { label: string; type: PreviewFieldType }[];
      note?: string;
    }
  | { kind: "logits"; topK: number; note?: string }
  | { kind: "words"; note?: string }
  | { kind: "svg"; note?: string }
  | { kind: "token-uri"; note?: string }
  | { kind: "text"; note?: string }
  | { kind: "market-state"; note?: string };

export type ReturnShape = "text" | "svg" | "token-uri" | "market-state";

type InputDetails = { label: string; example: string; hint: string };
export type CallInput = InputDetails & (
  | { kind: "uint"; word: number; max: string; allowHex?: boolean }
  | { kind: "text"; maxBytes: number; maxWords: number; pattern: string; patternMessage: string }
  | { kind: "uint-array"; maxValue: number; maxItems: number }
);

export interface ModelEntry {
  slug: string;
  title: string;
  author: string;
  year: number;
  month: number;
  address: `0x${string}`;
  facts: [string, string][];
  description: string;
  call: {
    calldata: `0x${string}`;
    expectedReturnBytes: number;
    note: string;
    input?: CallInput;
    // Custom inputs may change the encoded return length. CI still checks
    // the exact expectedReturnBytes of the reproducible example above.
    manualReturn?: ReturnShape;
  };
  links: { label: string; url: string }[];
  preview?: OutputPreview;
}

export type CallTarget = Pick<
  ModelEntry,
  "slug" | "address" | "call" | "preview"
>;

export type PreparedCallTarget = Omit<CallTarget, "call"> & {
  call: { calldata: `0x${string}`; note: string } & (
    | { expectedReturnBytes: number; returnShape?: never }
    | { expectedReturnBytes?: never; returnShape: ReturnShape }
  );
};
