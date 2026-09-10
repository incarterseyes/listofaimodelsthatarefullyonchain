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
3. Fill in the `facts` table: answer the reader's questions listed below.
   Set `year` and `month` (1–12) to the model's mainnet release date. For a
   shared contract, use the project's release date, not the core contract's
   deployment date. The list sorts oldest first by year, then month, then slug
   alphabetically for entries in the same month. A model with a later date
   will appear at the bottom automatically. The page displays only the year;
   the month is used for sorting. Record the date evidence in
   `models/README.md`.
4. `call.calldata` must be even-length, pre-encoded calldata for the inference or
   renderer-artifact function itself.
5. Set `call.expectedReturnBytes` to the exact raw JSON-RPC result length,
   including ABI framing. A dynamic 1024-byte payload, for example, returns 1088
   raw bytes (offset + length + payload).
6. Fill in `links` (see "Links" below). The CONTRACT link to your address on
   evm.now is required; SITE and ABOUT are optional.
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

`facts` is the entry's table: the questions a first-time reader asks, answered
in one fixed order. Every entry uses the same labels, so a reader compares
entries without learning new vocabulary. Validation rejects any other label,
any other order, and the value shapes noted below.

**Required, in this order:**

| Label | The reader's question | Example |
| --- | --- | --- |
| `TYPE` | What kind of network is this? | `single-layer perceptron` |
| `SIZE` | How big is it? The value must contain a number. | `1,024 weights (hashed text n-grams)` |
| `STORAGE` | Where do the weights live? The value must name one of: `contract storage`, `data contracts`, `bytecode`, `derived at read time`. | `data contracts (SSTORE2); int16 fixed-point` |
| `OUTPUT` | What does it produce? | `the XOR result as one boolean` |

**Optional** — one `TRAINING` row, placed between `STORAGE` and `OUTPUT`, for
when how the model learned is part of the story:

| Label | The reader's question | Example |
| --- | --- | --- |
| `TRAINING` | How did it learn? | `learns inside Ethereum — weights update when each question settles` |

Value style: plain words first, with the precise technical term in parentheses
— `data contracts (SSTORE2)`. Detail that does not answer one of these
questions belongs in the description or `call.note`.

Do not add `ADDRESS`, `YEAR`, `MONTH`, or `DATE` facts — the site renders the
address and year from the top-level fields.

## Links

`links` follows the same idea as facts: every entry offers the same links in
the same order, so validation rejects any other label or order.

| Label | What it points at | Required |
| --- | --- | --- |
| `SITE` | The project itself: its site, app, or repository | optional |
| `ABOUT` | A writeup: an essay, whitepaper, or about page | optional |
| `CONTRACT` | The entry's address on evm.now, exactly `https://evm.now/address/<address>` | required |

evm.now shows the verified source, lets readers run the read functions, and
covers what separate explorer and source links used to. One link label of
each kind, at most three links total.

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
- [ ] CONTRACT link points at the entry's address on evm.now
- [ ] Description states plainly where the weights live and where execution runs
