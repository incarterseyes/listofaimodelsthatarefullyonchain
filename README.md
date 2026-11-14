# ONCHAIN MODEL REGISTRY

[![validate](https://github.com/incarterseyes/listofaimodelsthatarefullyonchain/actions/workflows/validate.yml/badge.svg)](https://github.com/incarterseyes/listofaimodelsthatarefullyonchain/actions/workflows/validate.yml)

**Live site: [listofaimodelsthatarefullyonchain.com](https://listofaimodelsthatarefullyonchain.com)**

A registry of neural networks whose weights and programs are stored on Ethereum
mainnet. The weights are the numbers that a network learned. Mainnet is the
main Ethereum network. Each day, CI runs a live check of every entry against
public RPC endpoints. An RPC endpoint is a server that answers requests about
Ethereum. The badge above shows the result of the most recent run.

Each entry gives a contract address on Ethereum mainnet, a read-only call, and
the exact size of the raw result. The live check requires at least two public
RPC endpoints to agree at one block. They must return the same contract
bytecode and the same call result. This agreement shows that anyone can repeat
the call and get the same bytes. It does not show that the contract code is
the neural network that the entry describes. A person must still review the
linked source code and project evidence.

Some entries accept an input. For these entries, the input box shows the
registered example when the page opens. You can change the input, then select
**Run check**. **Use example** restores the registered example but does not
run the live check. The page rejects an invalid input before it sends a
request to Ethereum. A change to the input clears the previous result.

| Model | Custom input |
| --- | --- |
| Aragnation | Program part 0–6, within project 401 |
| INCHAINPEPEGAN | Token ID (the generator also draws IDs that nobody has minted) |
| CONCRETE | 128-bit seed, in decimal or `0x` hexadecimal |
| I. | Program part 0–23, within project 0 |
| AUTOMATE ATTENTION | 1–512 vocabulary token IDs, each from 0–2047, separated by spaces or commas |
| SLONKS | CryptoPunk number 0–9999 |
| HELLO WORLD COMPUTER | Lowercase letters and spaces; at most 8 words and 64 bytes |
| THE MARKET IS TALKING | Block number for saved inputs and mood |
| remanence | Existing token ID; burned tokens cannot return an image |

The XOR and ARTIFICIAL AFTER ALL calls take no input. For Aragnation and I.,
the live check shows one stored part of the program as text. For THE MARKET IS
TALKING, it shows saved state. These three live checks do not run the programs
that draw the output in a browser. A long input can exceed the computation
limits of public RPC endpoints.

CI checks only the registered example and requires its exact result size. A
custom input can return a result of a different length. For that result, the
site first requires the RPC endpoints to agree. Then it checks the ABI
encoding and decodes the output. ABI encoding is the standard layout of
Ethereum call data. In both cases, at least two RPC endpoints must agree on
the block, the contract code, and every byte of the result. If the output has
the wrong format, the page shows the expected format and the raw bytes.

## What qualifies

A neural network qualifies only if Ethereum mainnet stores both its weights
and its program. The model can run inside Ethereum, as EVM code, or in the
visitor's browser. Each entry's description says which. A proof of offchain
computation does not qualify. A pointer to files stored offchain, for example
on IPFS or Arweave, does not qualify.

## Add a model

Each model has one JSON file in [`models/`](models/). The build and the tests
check each entry against [`schema/model.schema.json`](schema/model.schema.json)
and against extra rules in [`lib/models.ts`](lib/models.ts), such as the fixed
`facts` labels and valid links. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Develop

```sh
npm install
npm run dev        # local development server
npm run check      # types, lint, and tests (the tests cover the schema and the registry rules)
npm run verify     # live check of every entry (eth_getCode and eth_call)
npm run build      # static export to out/
```

The app uses Next.js 16 with the App Router and `output: "export"`. It has no
application server or database. Live check requests go directly from the
visitor's browser to the public RPC endpoints listed in
[`lib/ethCall.ts`](lib/ethCall.ts).

## Deploy

Vercel hosts the site. Its Git integration builds the static export and
publishes it to production on every push to `main`. Pull requests get preview
deployments.

Set `NEXT_PUBLIC_SITE_URL` to the exact production origin when you build a
public release. The Vercel project sets it for the Production environment
only. If the variable is not set, the build leaves out the canonical and Open
Graph URLs. This stops preview builds from claiming the production domain.

The exported asset URLs assume that the site is hosted at an origin root. A
subpath deployment requires a matching Next.js `basePath` configuration and a
rebuild.

## License

[MIT](LICENSE)
