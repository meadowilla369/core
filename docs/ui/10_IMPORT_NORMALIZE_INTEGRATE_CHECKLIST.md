# UI Import Normalize Integrate Checklist

Goal: bring Figma AI generated UI code in `tmp/Event Ticketing Marketplace UI` into this monorepo without breaking existing FE/BE contracts.

## Phase 1 - Import

- [x] Confirm source drop location and branch strategy (`feat/ui` only)
- [x] Add safe ignore rules for temporary imported UI source
- [x] Create import manifest generator from the `tmp` drop
- [x] Generate first manifest snapshot (`docs/ui/import-manifest.json`)
- [x] Commit Phase 1 changes

## Phase 2 - Normalize

- [ ] Define raw UI mock data contracts (based on Figma drop shape)
- [ ] Define normalized contracts mapped to existing monorepo types
- [ ] Implement mapper functions (raw -> normalized)
- [ ] Add fixture data and mapper smoke tests
- [ ] Commit Phase 2 changes

## Phase 3 - Integrate

- [ ] Create app-level adapters for `mobile`, `staff-scanner`, `organizer-portal`
- [ ] Wire adapters into each app public API surface
- [ ] Add integration tests for adapter outputs
- [ ] Run typecheck/tests for changed workspaces
- [ ] Commit Phase 3 changes

## Validation Commands

- `node scripts/ui/generate-import-manifest.mjs`
- `npm run typecheck`
- `node --test packages/ui-integration/tests/*.test.mjs`

## Commit Plan

1. `chore(ui): add import-normalize-integrate execution checklist`
2. `chore(ui): add figma drop import manifest pipeline`
3. `feat(ui): add raw-to-normalized data mappers`
4. `feat(ui): integrate normalized ui adapters into apps`
