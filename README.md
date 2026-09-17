# ONCHAIN MODEL REGISTER

[![validate](https://github.com/incarterseyes/listofaimodelsthatarefullyonchain/actions/workflows/validate.yml/badge.svg)](https://github.com/incarterseyes/listofaimodelsthatarefullyonchain/actions/workflows/validate.yml)

**Live site: [listofaimodelsthatarefullyonchain.com](https://listofaimodelsthatarefullyonchain.com)**

A reproducible register of neural-network programs whose weights and executable
model artifacts are stored on Ethereum mainnet. CI re-verifies every entry
against public RPCs daily — the badge above is green only while every claim
still reproduces.

Each entry declares a deployed Ethereum mainnet address, read-only call, and
exact raw return size. Automated verification requires at least two public RPCs to agree,
at one block, on the deployed bytecode and exact call result. That is strong
evidence of a reproducible onchain execution path; it is not, on its own, proof
that arbitrary bytes implement the architecture described by an entry. The
linked source and project evidence still require human review.

Visitors can enter their own input in each supported entry, then select **Run
check**. **Use example** fills in the registered example without running it.
Inputs are checked before any request goes to Ethereum. Changing an input
clears the previous result.

| Model | Manual input |
| --- | --- |
| Aragnation | Program part 0–6, within project 401 |
| INCHAINPEPEGAN | Token ID (the generator also accepts unminted IDs) |
| CONCRETE | 128-bit seed, in decimal or `0x` hexadecimal |
| I. | Program part 0–23, within project 0 |
| AUTOMATE ATTENTION | 1–512 vocabulary IDs, each from 0–2047, separated by spaces or commas |
| SLONKS | CryptoPunk number 0–9999 |
| HELLO WORLD COMPUTER | Lowercase letters and spaces; at most 8 words and 64 bytes |
| THE MARKET IS TALKING | Block number for saved inputs and mood |
| remanence | Existing token ID; burned tokens cannot return an image |

The XOR and ARTIFICIAL AFTER ALL checks take no arguments. Program-part
checks show stored source text, and the market check shows saved state;
these checks do not run the browser renderers. Long model inputs can exceed
public RPC execution limits.

Automated verification keeps the registered example and its exact return
size. Custom calls that can return different lengths validate their ABI
format and decoded output instead. Both paths still require at least two
RPCs to agree on the block, contract code, and complete return bytes.

## What qualifies

A neural network qualifies only if both its weights and its executable model
program are stored on Ethereum mainnet. The model can execute in EVM opcodes
or in the client; each entry's description states which. Proofs of off-chain
inference and off-chain storage pointers do not qualify.

## Add a model

One JSON file per model lives in [`models/`](models/). Entries are checked
against [`schema/model.schema.json`](schema/model.schema.json) plus registry
invariants such as the standard facts vocabulary and valid evidence links. See
[CONTRIBUTING.md](CONTRIBUTING.md).

## Develop

```sh
npm install
npm run dev        # local development server
npm run check      # types, lint, and tests (tests cover schema + invariants)
npm run verify     # strict live eth_getCode + eth_call verification
npm run build      # static export to out/
```

The app uses Next.js 16 with the App Router and `output: "export"`. It has no
application server or database. Live verification requests go directly from the
visitor's browser to the public Ethereum RPC endpoints listed in
[`lib/ethCall.ts`](lib/ethCall.ts).

## Deploy

Every push to `main` builds the static export and publishes it to GitHub Pages
via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

Set `NEXT_PUBLIC_SITE_URL` to the exact production origin when building a public
release (the deploy workflow does this). Canonical and Open Graph URLs are
omitted when it is unset, which keeps preview builds from claiming the
production domain.

The exported asset URLs assume the site is hosted at an origin root. A subpath
deployment requires a matching Next.js `basePath` configuration and rebuild.

## License

[MIT](LICENSE)
