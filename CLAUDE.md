# CLAUDE.md

## What this is

A static registry site (listofaimodelsthatarefullyonchain.com) of neural
networks whose weights and inference/renderer code are stored entirely on
Ethereum mainnet. Every entry names a deployed contract and a read-only
`eth_call` that anyone — the site, CI, or a visitor's browser — can replay to
check the claim.

One qualification rule: both the weights and the inference/renderer program
are stored on Ethereum mainnet. The model can execute in EVM opcodes or
client-side; each entry's description states which.

Editorial rules (deliberate, don't relitigate them in PRs): neural networks
only — statistical models such as Markov chains were reviewed and excluded;
ZK/optimistic proofs of off-chain inference never qualify; IPFS/Arweave
pointers are not onchain storage. Full contributor rules: CONTRIBUTING.md.

## How it works

- `models/*.json` — the registry. One file per model; filename must equal the
  `slug` field. This is the only thing most PRs should touch.
- `schema/model.schema.json` — JSON Schema for entries. `lib/models.ts` layers
  extra invariants on top (closed facts vocabulary with required
  ARCHITECTURE/WEIGHTS/OUTPUT labels, valid links) and fails the build on any
  violation.
- `lib/ethCall.ts` — verification core, framework-free JSON-RPC (no viem/ethers
  by design). It probes the hardcoded Ethereum mainnet RPC list (`RPC_URLS`),
  pins the endpoints to one block hash, checks deployed bytecode, runs the
  call, and requires ≥2 endpoints to agree byte-for-byte with the entry's
  `expectedReturnBytes`. Used by both the browser button and
  `scripts/verify-models.ts`.
- `lib/preview.ts` + `components/OutputPreview.tsx` — decode a verified
  result's bytes per the entry's declarative `preview` field (image, ABI
  fields, logits, raw words) and render it after a successful check.
- `app/` + `components/` — Next.js App Router, `output: "export"`, no server.
  The terminal/TUI look lives in `app/globals.css`; components are thin wrappers
  over those classes.

## Commands

- `npm run check` — typecheck + lint + tests (the tests exercise the schema
  and registry invariants). Run before any commit.
- `npm run verify` — strict live verification of every entry against public
  RPCs. Requires network; CI runs it on PRs and a daily cron.
- `npm run build` — static export to `out/`.

## Conventions

- Verify a new entry's address and calldata against a live node *before*
  adding it — never trust a README or project site for deployment claims.
- `NEXT_PUBLIC_SITE_URL` is set only for production builds (see .env.example)
  so preview builds don't claim the production domain.
- Byte-agreement across RPCs proves a reproducible call, not that the bytes
  implement the described architecture — keep site/README copy honest about
  this distinction.
