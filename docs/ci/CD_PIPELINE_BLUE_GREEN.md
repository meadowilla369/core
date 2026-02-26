# CD Pipeline (Blue/Green + Rollback)

## Workflow

- Workflow file: `.github/workflows/cd.yml`.
- Deploy path: `./scripts/deploy-bluegreen.sh`.
- Rollback path: `./scripts/rollback-release.sh`.
- Gates:
- Release candidate gate: `./scripts/release-candidate-gate.sh`.
- Rollback criteria gate: `./scripts/incident-rollback-gate.sh`.

## Artifact Evidence

- Blue/green report: `artifacts/deploy/bluegreen-<env>.json`.
- Rollback report: `artifacts/deploy/rollback-<env>.json`.

Final status: **CD pipeline and rollback automation configured.**
