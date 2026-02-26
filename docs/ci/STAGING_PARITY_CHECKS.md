# Staging Parity Checks

## Goal

Ensure staging mirrors production topology as closely as possible.

## Automated Check

- Script: `./scripts/check-staging-parity.sh`.
- Compares Terraform module declarations in:
- `infra/terraform/envs/staging/main.tf`
- `infra/terraform/envs/prod/main.tf`

## Report

- Output artifact: `artifacts/parity/staging-parity.json`.

Final status: **Staging parity validation automated and enforced in CI.**
