# Release Candidate Checklist and Go/No-Go Criteria

## Required Gates

1. CI green on `dev` and release candidate branch.
2. Integration suite green (`critical`, `backend`, `e2e`, `load`, `chaos`).
3. Contract quality gates green.
4. Staging parity check passes.
5. Security and compliance artifacts up to date.

## Go/No-Go Criteria

- `GO` only if all required gates pass and no unresolved P0/P1 defects.
- `NO-GO` if any critical control (security, payments, minting, check-in) is degraded.

Final status: **Release candidate criteria defined.**
