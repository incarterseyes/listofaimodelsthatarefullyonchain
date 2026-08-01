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

## Qualification modes

- `EVM_INFERENCE` — the forward pass executes in EVM opcodes.
- `ONCHAIN_RENDERER` — the weights and renderer program are stored onchain, but
  execute in the client.

Proofs of off-chain inference and off-chain storage pointers do not qualify.

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
