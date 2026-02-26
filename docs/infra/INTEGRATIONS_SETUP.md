# Third-Party Integrations Setup

## Blockchain (Base RPC)

- Configuration file: `config/integrations/blockchain.base.json`
- Enforces primary + fallback RPC endpoints.
- Failover activates after 3 consecutive failures.

## Wallet Provider (Privy)

- Configuration file: `config/integrations/wallet_provider.json`
- Requires app/client IDs for `dev`, `staging`, and `prod`.

## Payment Gateways

- Configuration file: `config/integrations/payment_gateways.json`
- Momo primary, VNPAY backup.
- Sandbox callback URLs pinned to staging API gateway.

## eKYC Providers

- Configuration file: `config/integrations/kyc_provider.json`
- VNPT primary, FPT.AI fallback.
- Quota monitoring thresholds included for alerting.
