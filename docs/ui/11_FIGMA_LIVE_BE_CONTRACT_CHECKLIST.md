# Figma UI Live BE/Contract Integration Checklist

Goal: run `apps/figma-ui` as the final separated UI product while consuming real backend flows and contract-aligned logic on localhost.

## Phase 1 - Baseline Setup

- [x] Promote Figma UI code into monorepo app (`apps/figma-ui`)
- [x] Add workspace scripts for Figma UI (`ui:figma:dev`, `ui:figma:build`, `ui:figma:typecheck`)
- [x] Add Vite proxy `/v1 -> api-gateway` for local integration
- [x] Add local stack runner for required services (`scripts/run-ui-live-stack.sh`)

## Phase 2 - Runtime Contract Alignment

- [x] Map buyer flows to real APIs (`events`, `tickets`, `marketplace`, `kyc`, `checkin`)
- [x] Map staff scanner flow to real QR payload and check-in verify API
- [x] Map organizer dashboard to live data endpoints
- [x] Align ticket QR signing format with check-in validator (HMAC payload contract)

## Phase 3 - Frontend Code Health

- [x] Normalize UI component imports to avoid case-collision issues
- [x] Add missing UI component props compatibility (`fullWidth`, `label`, `helperText`, `error`)
- [x] Fix TypeScript entry/import issues in `main.tsx`
- [x] Make `apps/figma-ui` typecheck pass
- [x] Make `apps/figma-ui` production build pass

## Phase 4 - Live Smoke Validation

- [x] Verify API gateway and dependent services boot on localhost
- [x] Verify `GET /v1/events` and `GET /v1/events/:id` through gateway
- [x] Verify purchase flow: reserve -> purchase -> confirm
- [x] Verify ticket QR generation and staff check-in verification
- [x] Verify resale listing create/cancel endpoints
- [ ] Manual browser UAT on buyer/staff/organizer flows by product owner

## Run Commands

- Start backend stack: `./scripts/run-ui-live-stack.sh`
- Start Figma UI: `npm run ui:figma:dev`
- Typecheck: `npm run ui:figma:typecheck`
- Build: `npm run ui:figma:build`

