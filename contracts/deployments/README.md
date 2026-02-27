# Contract Deployment Artifacts

- `address-registry.json`: canonical contract addresses by network for FE/BE consumers.
- Update this file immediately after each deployment.
- Keep ABI files in `contracts/abi` synchronized with deployed bytecode.

## Localhost Deployment (Anvil)

1. Start local chain:
   - `anvil --chain-id 31337`
2. Create env file:
   - `cp contracts/deploy-config/localhost.env.example contracts/deploy-config/localhost.env`
3. Deploy:
   - `cd contracts && ./script/deploy-local.sh`

Deployment broadcast files are written to `contracts/broadcast/`.
