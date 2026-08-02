# Adding a model to the register

One model = one JSON file in `models/`. Open a pull request that adds yours.

## What qualifies

A **neural network** whose weights and executable model program are stored on
Ethereum mainnet. The model can run inside the EVM (a read-only `eth_call`
returns the model output) or in the client (the renderer program is fetched
from the chain and run in the browser). The description must state which.

What does **not** qualify:

- ZK/optimistic proofs of off-chain inference. A chain that checks a receipt did
  not run a model.
- Weights or executable model code on IPFS, Arweave, or a server.
- Statistical models without a neural architecture (for example, Markov chains).
- Anything without a deployed contract address and a reproducible read-only call.

## How

1. Copy an existing file in `models/` and fill in your entry. The complete shape
   is documented in `schema/model.schema.json`.
2. Name the file `<slug>.json`, matching the `slug` field.
3. Fill in the `facts` table from the closed vocabulary below.
4. `call.calldata` must be even-length, pre-encoded calldata for the inference or
   renderer-artifact function itself.
5. Set `call.expectedReturnBytes` to the exact raw JSON-RPC result length,
   including ABI framing. A dynamic 1024-byte payload, for example, returns 1088
   raw bytes (offset + length + payload).
6. Include at least one HTTPS evidence link. Verified source and an explorer
   deployment link are strongly preferred.
7. Run `npm run check` and `npm run verify`. Live verification requires two
   public RPCs to agree at one block; deterministic and live failures block CI.
8. Open the pull request. State plainly where the weights live and where
   execution runs.

## Description style

Write the description for the general public:

- 50-60 words. The schema rejects more than 700 characters.
- Short sentences, 25 words or fewer. One idea per sentence. Active voice.
- Say where the weights live and where the model runs.
- Put technical detail (layer shapes, quantization, encodings) in `facts`
  and `call.note`, not in the description.
- Use plain words: "public Ethereum servers", "runs inside Ethereum". Exact
  function signatures belong in `call.note`.

This repo ships a Claude Code skill that checks prose against these rules:
`.claude/skills/simplified-technical-english-asd-ste100`. If you write your
entry with an AI agent, run the skill on your `description`, `call.note`, and
`preview.note` before you open the PR.

## Facts

`facts` is a list of `["LABEL", "value"]` pairs rendered as the entry's table.
Labels come from a closed vocabulary so entries stay comparable; an unknown
label fails validation with the list of valid ones. Extend the vocabulary in
`lib/models.ts` via PR if your model genuinely needs a label no existing one
covers.

**Required** (every entry):

| Label | What to enter | Example |
| --- | --- | --- |
| `ARCHITECTURE` | The network in one phrase | `2-2-1 MLP` |
| `WEIGHTS` | Where and how the weights are stored | `int32 × 1024, packed in uint256[128] storage` |
| `OUTPUT` | What the model produces | `the XOR result as one boolean` |

**Optional** (use what applies):

`TASK`, `TRAINING`, `INFERENCE`, `RENDERER`, `PIPELINE`, `DIMENSIONS`,
`PARAMETERS`, `NEURONS`, `FEATURES`, `VOCABULARY`, `ACTIVATION`, `INPUTS`,
`MATH`, `INITIAL STATE`, `CONTRACTS`, `DEPENDENCIES`

Do not add `ADDRESS` or `YEAR` facts — the site renders those rows from the
top-level fields.

## Output preview (optional, encouraged)

Raw return bytes mean little to a first-time visitor. The optional `preview`
field declares how to decode them; after a successful live check the site
renders the decoded result. Pick the `kind` matching your call's return type
(full shapes in `schema/model.schema.json`):

- `grayscale-image` — one byte per pixel, row-major; raw or ABI-framed.
  `{ "kind": "grayscale-image", "width": 32, "height": 32 }`
- `fields` — static ABI return values, one 32-byte word per field.
  `{ "kind": "fields", "fields": [{ "label": "OUTPUT", "type": "bool" }] }`
- `logits` — ABI dynamic array of signed logits; shows the top-scoring token
  indices. `{ "kind": "logits", "topK": 5 }`
- `svg` — ABI-encoded string containing an SVG document; rendered as an image.
- `token-uri` — ABI-encoded string containing base64 ERC-721 JSON metadata;
  renders the embedded image. The image must be a self-contained `data:` URI —
  metadata pointing at an offchain image will not render.
- `words` — fallback that lists each 32-byte word.

Validation checks the preview against `expectedReturnBytes`. Add a `note`
stating anything the preview cannot honestly show (for example, token IDs
that need an offchain vocabulary to become text).

## PR checklist

- [ ] File name matches `slug`
- [ ] `npm run check` passes deterministic registry and code checks
- [ ] `npm run verify` gets matching bytecode and call results from two RPCs
- [ ] Links to verified source code included
- [ ] Description states plainly where the weights live and where execution runs
