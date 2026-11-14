<!-- To add a model, include models/<slug>.json and its date-evidence row
     in models/README.md, in chronological order.
     See CONTRIBUTING.md for the full rules. -->

## What this adds

<!-- In one or two sentences, say what the model is, where the weights are
     stored, and where the model runs (inside the EVM, or in the browser). -->

## Checklist

- [ ] The file name matches `slug`
- [ ] `year` and `month` (1–12) record the model's mainnet release, not the deployment of a shared core contract
- [ ] The release date is not in the future
- [ ] Linked date evidence added to `models/README.md` in chronological order
- [ ] `npm run check` passes the registry and code checks
- [ ] `npm run verify` gets the same bytecode and the same call result from two RPC endpoints
- [ ] The CONTRACT link points at the entry's address on evm.now
- [ ] The description says where the weights are stored and where the model runs
