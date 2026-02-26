# Data Retention and PII Encryption Plan

## Scope

This plan applies to PostgreSQL data in `users`, `kyc_records`, `payments`, `refund_requests`, `check_ins`, and `disputes` domains.

## Encryption Strategy

1. Use `pgcrypto` for column-level encryption of PII (`legal_name_enc`, `national_id_enc`, `date_of_birth_enc`).
2. Do not store plaintext PII columns once encrypted fields are active.
3. Use envelope encryption:
- Data Encryption Key (DEK) generated per environment.
- DEK encrypted by KMS Customer Managed Key (CMK).
- Application loads decrypted DEK from Secrets Manager at runtime.
4. Separate secrets by environment (`dev`, `staging`, `prod`) and rotate quarterly.

## Key Separation

- `prod/pii-encryption-key`: encrypt/decrypt PII only.
- `prod/kyc-object-storage-key`: encrypt KYC files in object storage.
- `prod/log-redaction-key`: signing/tokenization for log-safe identifiers.

No workload should have IAM permission to all keys simultaneously.

## Retention Policy

- OTP/request traces: 30 days.
- Webhook raw payloads: 180 days.
- Payment/refund records: 7 years (financial compliance).
- Check-in logs: 2 years.
- Disputes/messages/audit logs: 3 years.
- KYC artifacts in object storage: 5 years or legal minimum; then purge.
- Soft-deleted user profile PII: purge after 30 days unless legal hold.

## Purge and Archival

1. Daily archival job moves expired operational rows to cold storage exports.
2. Purge job hard-deletes rows beyond retention windows.
3. Legal hold table (`compliance_holds`) blocks purge for selected user/dispute IDs.
4. Purge jobs write immutable audit records (`purge_audit_log`).

## Logging and Access

- Mask PII values in application logs before emitting structured events.
- Restrict direct DB access with least-privilege roles.
- Enforce break-glass procedure for production read access.
- Alert on anomalous query patterns for PII tables.
