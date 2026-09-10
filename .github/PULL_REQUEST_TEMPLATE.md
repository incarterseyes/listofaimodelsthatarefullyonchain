<!-- Adding a model? Include models/<slug>.json and its date-evidence row
     in models/README.md, in chronological order.
     Full rules: CONTRIBUTING.md -->

## What this adds

<!-- One or two sentences: what the model is, where the weights live, and
     where execution runs (EVM_INFERENCE or ONCHAIN_RENDERER). -->

## Checklist

- [ ] File name matches `slug`
- [ ] `year` and `month` (1–12) record the model's mainnet release, not a shared core contract's deployment, and are not in the future
- [ ] Linked date evidence added to `models/README.md` in chronological order
- [ ] `npm run check` passes deterministic registry and code checks
- [ ] `npm run verify` gets matching bytecode and call results from two RPCs
- [ ] Links to verified source code included
- [ ] Description states plainly where the weights live and where execution runs
