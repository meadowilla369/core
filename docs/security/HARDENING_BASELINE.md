# Security Hardening Baseline

## WAF, Auth Hardening, RBAC, Privileged Access

- WAF policy: `config/security/waf-policy.json`.
- RBAC policy and privileged action set: `config/security/rbac-policy.json`.
- Internal privileged endpoints require internal API key and audited role ownership.

## PII Encryption and Log Redaction

- Data encryption plan: `docs/db/DATA_RETENTION_AND_PII_ENCRYPTION.md`.
- PII redaction policy: `config/security/pii-redaction.json`.
- Redaction helper script: `scripts/security/redact-log-line.mjs`.

## Anti-bot Controls

- Rate limits, CAPTCHA requirements, purchase throttles: `config/security/anti-bot-controls.json`.

## Minter Key Controls

- KMS alias, scoped IAM actions, rotation cadence, alert thresholds: `config/security/minter-key-controls.json`.

## Paymaster Budget Safeguards

- Budget thresholds and automatic guard actions: `config/security/paymaster-budget-controls.json`.
- Monitoring utility: `scripts/security/paymaster-budget-monitor.mjs`.

Final status: **Hardening controls baseline implemented and documented.**
