# Adding a model to the registry

Each model has one JSON file in `models/`. To add a model, open a pull request
that adds its file.

## What qualifies

A **neural network** whose weights and program are both stored on Ethereum
mainnet. The model can run in one of two places:

- Inside the EVM. A read-only `eth_call` returns the model output.
- In the browser. The browser reads the renderer program from Ethereum and
  runs it.

The description must say which.

What does **not** qualify:

- ZK or optimistic proofs of offchain inference. In these systems, Ethereum
  checks a proof of the result but does not run the model.
- Weights or model code on IPFS, Arweave, or a server.
- Statistical models without a neural architecture (for example, Markov chains).
- Anything without a deployed contract address and a reproducible read-only call.

## How

1. Copy an existing file in `models/` and fill in your entry.
   `schema/model.schema.json` documents the complete shape.
2. Name the file `<slug>.json`. The name must match the `slug` field.
3. Fill in the `facts` table. Each row answers one of the reader's questions
   listed under "Facts" below.
4. Set `year` and `month` (1–12) to the model's release date on mainnet. For a
   shared contract, use the project's release date, not the deployment date of
   the core contract. The list puts the oldest model first. It sorts by year,
   then month, then slug. The page shows only the year. Record the date
   evidence in `models/README.md`.
5. Set `call.calldata` to the pre-encoded calldata of the function that runs
   the model or returns its renderer program. Calldata is the hex data that a
   call sends to a contract. It must have an even number of hex digits.
6. Set `call.expectedReturnBytes` to the exact length of the raw JSON-RPC
   result, including ABI framing. For example, a dynamic 1024-byte payload
   returns 1088 raw bytes: a 32-byte offset, a 32-byte length, and the payload.
7. Fill in `links` (see "Links" below). The CONTRACT link to your address on
   evm.now is required. SITE and ABOUT are optional.
8. Run `npm run check` and `npm run verify`. The live check requires two
   public RPC endpoints to agree at one block. CI fails if either command
   fails.
9. Open the pull request. Say where the weights are stored and where the model
   runs.

## Description style

Write the description for a reader who is new to blockchains and to AI models:

- About 60 to 90 words. The schema rejects more than 700 characters.
- Short sentences of 25 words or fewer. One idea in each sentence. Active
  voice.
- Say where the weights are stored and where the model runs.
- Explain a technical term in a few words the first time you use it.
- Put technical detail (layer shapes, quantization, encodings) in `facts`
  and `call.note`, not in the description.
- Use plain words: "public Ethereum servers", "runs inside Ethereum".
  Function names belong in `call.note`.

This repo ships a Claude Code skill that checks prose against these rules:
`.claude/skills/simplified-technical-english-asd-ste100`. If you write your
entry with an AI agent, run the skill on your `description`, `call.note`, and
`preview.note` before you open the PR.

## Facts

`facts` is the entry's table. It answers a first-time reader's questions in
one fixed order. Every entry uses the same labels, so a reader can compare
entries without new vocabulary. Validation rejects any other label, any other
order, and any value that breaks the rules in the table below.

**Required, in this order:**

| Label | The reader's question | Example |
| --- | --- | --- |
| `TYPE` | What kind of network is this? | `single-layer perceptron` |
| `SIZE` | How big is it? The value must contain a number. | `1,024 weights (hashed text n-grams)` |
| `STORAGE` | Where do the weights live? The value must name one of: `contract storage`, `data contracts`, `bytecode`, `derived at read time`. | `data contracts (SSTORE2); int16 fixed-point` |
| `OUTPUT` | What does it produce? | `the XOR result as one boolean` |

**Optional:** one `TRAINING` row, between `STORAGE` and `OUTPUT`. Add it when
the training method is an important fact about the model.

| Label | The reader's question | Example |
| --- | --- | --- |
| `TRAINING` | How did it learn? | `learns inside Ethereum: weights update when each question settles` |

Value style: plain words first, with the precise technical term in
parentheses, for example `data contracts (SSTORE2)`. Detail that does not
answer one of these questions belongs in the description or `call.note`.

Do not add `ADDRESS`, `YEAR`, `MONTH`, or `DATE` facts. The site shows the
address and the year from the top-level fields.

## Links

`links` works like `facts`. Every entry offers the same links in the same
order, and validation rejects any other label or order.

| Label | What it points at | Required |
| --- | --- | --- |
| `SITE` | The project itself: its site, app, or repository | optional |
| `ABOUT` | A writeup: an essay, whitepaper, or about page | optional |
| `CONTRACT` | The entry's address on evm.now, exactly `https://evm.now/address/<address>` | required |

evm.now shows the verified source code and lets readers run the read
functions. Use each link label at most once.

## Output preview (optional, encouraged)

A first-time visitor cannot read raw returned bytes. The optional `preview`
field declares how to decode them. After a live check passes, the site shows
the decoded result. Choose the `kind` that matches the return type of your
call (`schema/model.schema.json` has the full shapes):

- `grayscale-image`: one byte for each pixel, row by row. The bytes are raw or
  in ABI framing.
  `{ "kind": "grayscale-image", "width": 32, "height": 32 }`
- `fields`: static ABI return values, one 32-byte word for each field.
  `{ "kind": "fields", "fields": [{ "label": "OUTPUT", "type": "bool" }] }`
- `logits`: an ABI dynamic array of signed logits, which are the raw scores of
  the model. The preview shows the tokens with the highest scores.
  `{ "kind": "logits", "topK": 5 }`
- `svg`: an ABI-encoded string that contains an SVG document. The site shows
  it as an image.
- `token-uri`: an ABI-encoded string that contains base64 ERC-721 JSON
  metadata. The site shows the image inside the metadata. The image must be a
  `data:` URI. The site does not load an image that the metadata links to
  offchain.
- `words`: a fallback that lists each 32-byte word.
- `text`: one ABI string that contains a stored program part. The site shows
  it as text and does not run it.
- `market-state`: the `(uint256, string, uint256, string)` saved-state tuple
  that `stateAt` returns. The site decodes both block numbers and both
  strings.

Validation checks the preview against `expectedReturnBytes`. Add a `note` that
says what the preview cannot show. For example, token IDs need an offchain
vocabulary to become text.

## Custom inputs

Keep `call.calldata` and `call.expectedReturnBytes` as a reproducible example
for CI. Add `call.input` when the registered read-only function has an input
that the visitor can change. Every input needs `label`, `hint`, and `example`.
The example must encode to exactly the registered calldata. Validation rejects
an example that encodes to any other calldata.

- `uint`: `word` is the zero-based position of the argument word to replace,
  and `max` is a decimal string. IDs use decimal digits. Set `allowHex: true`
  for a seed that also accepts `0x` hexadecimal. The selector, the address,
  and the other argument words stay fixed.
- `text`: replaces the single string argument. `pattern` is a JavaScript
  regular expression, used with the Unicode flag. Use `^` and `$` to match the
  complete input. `patternMessage` tells the visitor which text is allowed.
  `maxBytes` limits the UTF-8 size, and `maxWords` limits the number of words
  separated by whitespace. For example, the HELLO WORLD COMPUTER entry allows
  only lowercase letters and spaces.
- `uint-array`: replaces the single `uint16[]` argument. `maxValue` limits
  each vocabulary token ID, and `maxItems` limits the sequence length.

Check the types and the limits against the deployed contract source. The
current text limits come from `FeatureExtraction.extract` in [HELLO WORLD
COMPUTER's verified source](https://repo.sourcify.dev/1/0x6901afceb66564a9b6e7193561fb78f0878b5906).
The 512-token limit comes from the attention buffers in [OnChainLMv2's
verified source](https://repo.sourcify.dev/1/0x5f8e7d750e75b44747c058a204d8dea0d18fa5d3).
Public RPC endpoints can refuse expensive calls even within those limits.

When a custom input can change the result length, set `call.manualReturn`
to `text`, `svg`, `token-uri`, or `market-state` and use the matching preview.
After the RPC endpoints agree, the site validates the ABI offsets, lengths,
and padding of the custom result. Then it decodes the output. An empty ABI
string is valid program text. The registered example still requires its exact
byte count. Do not remove the agreement check. At least two RPC endpoints must
return the same block, the same contract code, and the same result bytes.

## PR checklist

- [ ] The file name matches `slug`
- [ ] `npm run check` passes the registry and code checks
- [ ] `npm run verify` gets the same bytecode and the same call result from two RPC endpoints
- [ ] The CONTRACT link points at the entry's address on evm.now
- [ ] The description says where the weights are stored and where the model runs
