<!-- Adding a model? One JSON file in models/ is all a PR should touch.
     Full rules: CONTRIBUTING.md -->

## What this adds

<!-- One or two sentences: what the model is, where the weights live, and
     where execution runs (EVM_INFERENCE or ONCHAIN_RENDERER). -->

## Checklist

- [ ] File name matches `slug`
- [ ] `npm run check` passes deterministic registry and code checks
- [ ] `npm run verify` gets matching bytecode and call results from two RPCs
- [ ] Links to verified source code included
- [ ] Description states plainly where the weights live and where execution runs
