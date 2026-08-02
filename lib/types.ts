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
  | { kind: "words"; note?: string };

export interface ModelEntry {
  slug: string;
  title: string;
  author: string;
  year: number;
  address: `0x${string}`;
  facts: [string, string][];
  description: string;
  call: {
    calldata: `0x${string}`;
    expectedReturnBytes: number;
    note: string;
  };
  links: { label: string; url: string }[];
  preview?: OutputPreview;
}

export type CallTarget = Pick<
  ModelEntry,
  "slug" | "address" | "call" | "preview"
>;
