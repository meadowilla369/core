# Secrets and Key Rotation Policy

## Key Management

- Use environment-scoped KMS keys from `infra/terraform/modules/secrets`.
- Enforce automatic annual key rotation in KMS.

## Secret Rotation Cadence

- Webhook secrets: every 90 days.
- Internal API keys: every 90 days.
- Provider API credentials (wallet/payment/KYC): every 90 days.
- Database credentials: every 60 days.

## Rotation Procedure

1. Create new secret version in Secrets Manager.
2. Deploy services with dual-read support if needed.
3. Validate health and callback signatures.
4. Decommission old credential version within 7 days.
5. Record rotation metadata in security audit log.
