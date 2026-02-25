# Contributing Guide

## Branch Model

- `main`: production-ready code.
- `develop`: integration branch for next release.
- Feature branches: `feat/<scope>-<short-description>`
- Fix branches: `fix/<scope>-<short-description>`
- Chore branches: `chore/<scope>-<short-description>`

## Commit Style

Use conventional-style prefixes:
- `feat:`
- `fix:`
- `chore:`
- `docs:`
- `test:`
- `refactor:`

Examples:
- `feat(auth): add otp verify endpoint skeleton`
- `chore(infra): add terraform env placeholders`

## Pull Request Rules

- Keep PRs focused by domain (BE, FE, contracts, infra).
- Link checklist items from `IMPLEMENTATION_CHECKLIST.md`.
- Include exact commands used to verify changes.

## Release Tags

- Staging tags: `staging-vX.Y.Z`
- Production tags: `vX.Y.Z`

## Coding Standards

- TypeScript strict mode must remain enabled.
- Keep API and DB state transitions explicit (no implicit status strings).
- Avoid breaking contract/event payload formats without migration notes.
