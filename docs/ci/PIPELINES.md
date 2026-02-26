# CI/CD Pipeline Overview

## CI Workflow

GitHub Actions workflow: `.github/workflows/ci.yml`

Execution order:

1. Install dependencies.
2. Validate DB migration policy (`scripts/validate-migrations.sh`).
3. Validate staging parity (`scripts/check-staging-parity.sh`).
4. Run lint + typecheck.
5. Run integration suite (`packages/integration-suite`).
6. Run contract quality gates (`scripts/run-contract-quality-gates.sh`).
7. Run build.
8. Generate artifact checksum manifest (`scripts/sign-artifacts.sh`).

## CD Workflow

Workflow: `.github/workflows/cd.yml`

- Blue/green deploy: `scripts/deploy-bluegreen.sh`.
- Rollback automation: `scripts/rollback-release.sh`.
- Release and rollback gates:
- `scripts/release-candidate-gate.sh`
- `scripts/incident-rollback-gate.sh`

## Contract Deploy Workflow

Workflow: `.github/workflows/contracts-deploy.yml`

- Validates environment-specific deploy config.
- Runs offline/fuzz/property quality gates before deploy approval.

## Forward-Only Migration Policy

Validation script enforces:

- Filename format: `0001_description.sql`.
- Strictly increasing migration prefixes.
- No rollback/down migration files.
- No destructive statements (`DROP TABLE`, `DROP TYPE`, `TRUNCATE TABLE`).

## Artifact Signing

Current signing implementation is checksum-based:

- SHA-256 manifest at `artifacts/signatures/checksums.sha256`.
- Manifest uploaded as CI artifact on each run.

Next hardening step: KMS-backed cryptographic signatures.
