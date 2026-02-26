# CI Pipeline Overview

## Workflow

GitHub Actions workflow: `.github/workflows/ci.yml`

Execution order:

1. Install dependencies.
2. Validate DB migrations (`scripts/validate-migrations.sh`).
3. Run `lint`.
4. Run `typecheck`.
5. Run `test`.
6. Run contracts tests offline (`forge test --offline`).
7. Run `build`.
8. Generate artifact checksum manifest (`scripts/sign-artifacts.sh`).

## Forward-Only Migration Policy

Validation script enforces:

- Filename format: `0001_description.sql`.
- Strictly increasing migration prefixes.
- No rollback/down migration files.
- No destructive statements (`DROP TABLE`, `DROP TYPE`, `TRUNCATE TABLE`).

## Artifact Signing

Current signing implementation is checksum-based for reproducibility:

- SHA-256 manifest at `artifacts/signatures/checksums.sha256`.
- Manifest uploaded as CI artifact on each run.

The next hardening step is integrating KMS-backed cryptographic signatures.
