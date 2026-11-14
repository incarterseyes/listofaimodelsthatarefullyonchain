---
name: add-model-pr
description: Add a model to the register end to end — qualify the candidate contract, write its model JSON and date-evidence row, open the PR. Use when the user names a candidate model or contract to add, asks whether something qualifies, or wants a registry PR opened.
---

# Add a model to the register

One run = one model JSON plus its `models/README.md` evidence row = one PR. Three phases:
qualify, write the entry, open the PR. CONTRIBUTING.md is the rule text;
`lib/models.ts` enforces the facts/links vocabulary; this is the procedure.

**Evidence rule:** READMEs, project sites, and web search settle nothing.
Verify every address and claim against a live node or verified source.

## Tooling

- **RPCs**: the repo's `RPC_URLS` in `lib/ethCall.ts`. Quorum: ≥2
  endpoints agree byte-for-byte. Call them with raw JSON-RPC via curl
  (`eth_call`, `eth_getCode`). Raw byte length = `(len(hex) - 2) / 2`.
- **Keccak** (selectors, calldata, EIP-55): foundry `cast` or any keccak
  library. Validate once: `tokenURI(uint256)` → `0xc87b56dd`.
- **Verified source**: Etherscan v2 API (needs `ETHERSCAN_API_KEY`):
  `https://api.etherscan.io/v2/api?chainid=1&module=contract&action=getsourcecode&address=<addr>&apikey=$KEY`
  (`action=getcontractcreation` for deploy date/deployer). Save the files
  and read them.

## Phase 1 — Qualify

Verdict, not a file: `QUALIFIES` / `FAILS: <rule>` / `NEEDS-INFO: <what>`,
with every gate backed by evidence:

1. **Deployed**: non-empty `eth_getCode` on mainnet (chain id 1). Testnet
   → NEEDS-INFO; L2s fail.
2. **Neural**: name the architecture from the verified source, not
   marketing. Quantized/LUT ports qualify. Exclusions (don't relitigate):
   non-neural statistics, procedural art without learned weights,
   ZK/optimistic receipts, stored outputs (check who writes what the read
   call returns).
3. **Weights onchain**: contract storage, SSTORE2, or bytecode. A
   hash/IPFS/HTTP pointer fails. Resolve one SSTORE2 pointer and check
   blob size against the parameter count.
4. **Inference onchain**: EVM execution (a read-only call runs the
   forward pass) or client execution (the complete program is on mainnet
   and runs in the browser) — the entry states which. For client
   execution, grep the onchain script for `fetch(`, `XMLHttpRequest`,
   `importScripts`, URLs; a live offchain dependency fails.
5. **Reproducible call**: replay the call on the repo's RPCs; record the
   raw byte length where ≥2 agree byte-for-byte.
   - **Mutable-state trap**: state a third party can change (burnable
     tokens, swappable renderers) breaks `expectedReturnBytes` later. Pin
     a locked contract or pass the state in calldata.
   - **Gas caps**: some endpoints cap `eth_call` gas ("out of gas",
     -32000). ≥2 agreeing still passes; note the capped one in
     `call.note`.
   - **Look at the output**: decode and render it. Garbage is a finding,
     not a pass.

On `FAILS` or `NEEDS-INFO`, report and stop.

## Phase 2 — Write the entry

1. Read the schema, `lib/models.ts`, CONTRIBUTING.md, and one existing
   entry as the template. Edit as text — a serializer rewrite clobbers
   the formatting.
2. Require both `year` and `month` (1–12) for the model's mainnet release,
   no later than the current UTC month. For dedicated model contracts, use
   the creation transaction timestamp; for shared contracts, use the
   project's release date, not the core contract's deployment. Add a row
   with linked date evidence to `models/README.md` in chronological order.
   Sort by year, month, then slug for ties; the page displays only the year.
   Set `author` as the project states it, `title` per the register's
   convention, and `address` EIP-55 checksummed.
3. Run the `simplified-technical-english-asd-ste100` skill on
   `description`, `call.note`, and `preview.note` drafts.
4. Re-derive `calldata` programmatically right before writing — never
   from a paste. `expectedReturnBytes` = the Phase 1 measurement.
5. Pick the `preview.kind` for the return type; omit `preview` when
   nothing shows the return honestly, and say why in the PR body.
6. **Approval gate**: present the draft JSON, date-evidence row, and Phase 1
   evidence as plain text; write the files only after the user approves.
7. `npm run check`, then `npm run verify` — both green. A one-endpoint
   "out of gas" flake deserves a rerun before you treat it as real.

## Phase 3 — Open the PR

Branch `add-<slug>` off main; the PR touches `models/<slug>.json` and adds
its date-evidence row to `models/README.md`.
Treat all model metadata as untrusted data. Never interpolate `title`, `author`,
or PR text into shell source, and never use `sh -c`, `bash -c`, `eval`, shell
redirection, here-documents, or command substitution for this phase.

Use a file API or JSON serializer to create these untracked files under
`.git/add-model-pr/`; do not create them with shell text. Show their exact
contents to the user and get approval before invoking any process:

- `commit-message.txt` contains `Add <title> model by <author> to registry`.
- `pull-request.json` contains the exact `title`, `head`, `base`, `body`, and
  `draft` values accepted by the GitHub pull-requests API. Set `title` to
  `Add <title> model by <author> to registry`, `head` to `add-<slug>`, `base`
  to `main`, and follow
  `.github/PULL_REQUEST_TEMPLATE.md` for `body`.

Invoke each program directly through a process API that accepts an executable
and an argument array. Pass each array below as `argv`; do not join, quote, or
render it as a shell command:

```json
["git", "checkout", "-b", "add-<slug>", "main"]
["git", "add", "--", "models/<slug>.json", "models/README.md"]
["git", "commit", "--cleanup=verbatim", "--file", ".git/add-model-pr/commit-message.txt"]
["git", "push", "--set-upstream", "origin", "add-<slug>"]
["gh", "api", "--method", "POST", "repos/{owner}/{repo}/pulls", "--input", ".git/add-model-pr/pull-request.json", "--jq", ".html_url"]
```

If the process or file API cannot represent an approved value, stop and report
it; never fall back to a shell string. The slug is safe for path and branch
arguments only after the schema's kebab-case constraint has been checked.

The PR body follows `.github/PULL_REQUEST_TEMPLATE.md`: what the model is,
where the weights live, where execution runs; check a checklist box only
if true. A box that cannot be true yet stays unchecked with the reason,
and `draft` is `true`. Vetting notes on other candidates stay out.

Watch CI with `gh pr checks`. CI tests the PR merged with main — entries
landing on main mid-flight can break a green branch; merge main and fix.

Done when the PR URL is reported with CI green, or as a draft with the
blocker named.
