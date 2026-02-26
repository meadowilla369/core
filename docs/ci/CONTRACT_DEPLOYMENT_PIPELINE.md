# Contract Deployment Pipeline

## Workflow

- Workflow file: `.github/workflows/contracts-deploy.yml`.
- Config validation script: `./scripts/validate-contract-deploy-config.sh`.
- Contract quality gate script: `./scripts/run-contract-quality-gates.sh`.

## Environment-specific Checks

- Enforces required vars in deploy config files.
- Runs offline tests + fuzz/property checks before any deployment action.

Final status: **Contract deployment pipeline with environment checks configured.**
