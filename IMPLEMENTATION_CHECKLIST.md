# Ticket Platform Implementation Checklist

Source:
- REQUIREMENTS.md
- DESIGN.md
- ANALYSIS.md

Legend:
- [ ] pending
- [x] completed

## Phase 0 - Discovery and Scope

- [x] Read and map REQUIREMENTS.md to current repository scope.
- [x] Read and map DESIGN.md smart-contract expectations.
- [x] Identify current code baseline and test baseline.
- [x] Define MVP delivery boundary for this repository (on-chain contracts + tests).

## Phase 1 - TicketNFT Hardening

- [x] Prevent transfer of used tickets.
- [x] Prevent transfer of refunded tickets.
- [x] Prevent transfer of tickets for cancelled events.
- [x] Restrict refund marking to cancelled events and unused tickets only.
- [x] Add/update unit tests for all TicketNFT restrictions.

## Phase 2 - Marketplace Escrow and Listing Integrity

- [x] Enforce listing restrictions for used/refunded tickets.
- [x] Add EscrowSettlementPayloadV1 struct support in completeSale.
- [x] Validate escrow payload version/currency/gateway/split/token/seller/buyer.
- [x] Keep replay protection by escrowData hash.
- [x] Add/update unit tests for payload validation and replay protection.

## Phase 3 - Account Abstraction Supporting Contracts

- [x] Implement TicketPaymaster contract from ITicketPaymaster interface.
- [x] Implement daily gas budget tracking per user.
- [x] Implement session policy + signer verification flow.
- [x] Implement GuardianAccount contract from IGuardianAccount interface.
- [x] Implement recovery flow: initiate, complete after delay, cancel.
- [x] Add unit tests for TicketPaymaster.
- [x] Add unit tests for GuardianAccount.

## Phase 4 - Verification and Progress Tracking

- [x] Run contract formatting check if needed.
- [x] Run test suite with offline mode: forge test --offline.
- [x] Capture final status and unresolved gaps.

Verification evidence:
- `cd contracts && forge fmt --check` passed.
- `cd contracts && forge test --offline` passed with 29/29 tests.
- Foundry online trace mode still crashes in this environment; offline mode is used as stable verification path.

## Phase 5 - Non-Contract Full Process Backlog (for next repos/services)

- [x] Backend payment webhook + idempotency + mint worker.
- [x] Backend eKYC gate for resale listing.
- [ ] Escrow transfer ledger in PostgreSQL.
- [x] Check-in QR verification service with atomic DB marking.
- [x] Event cancellation/refund workflow service.
- [x] Wallet recovery service orchestration.
- [x] Dispute management service.
- [ ] Observability and operations runbooks.
- [x] Decomposed backlog into detailed execution phases (Phase 6-17).

## Phase 6 - Program Setup and Monorepo Foundation (BE + FE + Contracts)

- [ ] Finalize product scope for MVP (MoSCoW) and Phase 1+ backlog.
- [ ] Confirm unresolved requirement decisions (USDT flow, organizer onboarding, event creation details).
- [x] Define target monorepo structure (`apps/mobile`, `apps/staff`, `apps/organizer`, `services/*`, `contracts`).
- [x] Set coding standards, branching model, PR template, release tags.
- [x] Setup shared TypeScript config, lint, format, commit hooks.
- [x] Setup package manager and build orchestration (pnpm/turbo or equivalent).
- [x] Setup environment strategy (`dev`, `staging`, `prod`) + env var contracts.

## Phase 7 - Infrastructure and Platform Foundation

- [ ] Provision cloud base with IaC (VPC, subnets, NAT, security groups).
- [ ] Provision PostgreSQL 15 + Redis + queue (Kafka/SQS) + object storage.
- [ ] Provision API gateway/WAF/CDN and TLS certificates.
- [ ] Provision observability stack (metrics, tracing, centralized logs, alerts).
- [ ] Setup secrets management (KMS + Secrets Manager), key rotation policy.
- [ ] Setup blockchain connectivity (Base RPC primary + fallback).
- [ ] Setup wallet provider project (Privy or selected provider) for all environments.
- [ ] Setup payment gateway sandbox accounts (Momo primary, VNPAY backup).
- [ ] Setup eKYC sandbox (VNPT/FPT.AI) and quota monitoring.

## Phase 8 - Database and Data Contracts

- [ ] Create migration baseline for user/identity domain tables.
- [ ] Create migration baseline for event/ticketing domain tables.
- [ ] Create migration baseline for marketplace/escrow domain tables.
- [ ] Create migration baseline for payments/refunds/webhooks domain tables.
- [ ] Create migration baseline for check-ins/disputes/support domain tables.
- [ ] Add indexes/constraints for high-traffic paths (`reservations`, `check_ins`, `listings`, `webhook_events`).
- [ ] Add enum/constraint strategy for status fields (avoid free-form states).
- [ ] Add seed strategy for local/dev fixtures.
- [ ] Add data retention and PII encryption plan (`pgcrypto` + key separation).

## Phase 9 - Smart Contract Completion and Production Readiness

- [ ] Add escrow payload signature verification path aligned with `escrowHook` model.
- [ ] Finalize admin governance model (Safe multi-sig + timelock config).
- [ ] Add pause/emergency runbook coverage for critical contract functions.
- [ ] Add property tests (Echidna) for price cap, replay, recovery delay invariants.
- [ ] Add fuzz tests for race conditions (`completeSale` vs `cancelListing`, replay variants).
- [ ] Prepare deployment scripts for Base testnet/mainnet with deterministic config artifacts.
- [ ] Execute external security audit and remediate findings.
- [ ] Generate ABI + contract address registry for FE/BE consumption.

## Phase 10 - Backend Core Services (Node.js/TypeScript)

- [x] Runtime skeleton implemented for `api-gateway` and `auth-service` with live HTTP smoke test.
- [x] Runtime skeleton implemented for `user-service` and integrated via `api-gateway`.
- [x] Runtime skeleton implemented for `kyc-service` and integrated via `api-gateway`.
- [x] Runtime skeleton implemented for `event-service` and integrated via `api-gateway`.
- [x] Runtime skeleton implemented for `ticketing-service` and integrated via `api-gateway`.
- [ ] Auth Service: OTP request/verify, token refresh, session/device management, rate limits.
- [ ] User Service: profile, email backup, freeze/unfreeze state, audit logs.
- [ ] KYC Service: initiate/upload/face match/status, provider abstraction, fallback handling.
- [ ] Event Service: event listing/details/availability, organizer event management.
- [ ] Ticketing Service: reservation (15-min TTL), inventory lock, purchase initiation.
- [x] Payment Orchestrator: webhook verification, idempotency, reconciliation, retry handling.
- [x] Mint Worker: consume paid events, call `TicketNFT.mint`, retry policy + support queue.
- [x] Marketplace Service: create/cancel listing, escrow payload assembly, complete sale trigger.
- [x] Check-in Service: QR signature verification + atomic DB check-in + async `markAsUsed`.
- [x] Refund Service: cancellation policy, refund queue, payout status sync.
- [x] Recovery Service: initiate, dual verification, hold timer, guardian rotation workflow.
- [x] Dispute Service: tiered SLA flow, auto-rules, escalation and evidence storage.
- [x] Notification Service: SMS/email/push templates and event-driven triggers.
- [ ] Admin/Internal APIs: settlements finalize endpoint, support moderation endpoints.

## Phase 11 - Frontend Delivery (Mobile + Staff + Organizer)

- [ ] Mobile buyer app foundation (auth shell, state management, secure storage).
- [ ] Registration/wallet onboarding flow (phone OTP + invisible wallet creation UX).
- [ ] Event discovery flow (list/filter/detail/ticket type availability).
- [ ] Purchase flow (reserve → pay → success/fail/pending states).
- [ ] My Tickets flow (ticket list/detail + rotating QR every 3s).
- [ ] Marketplace flow (list for sale, browse listings, purchase resale).
- [ ] Refund/cancellation visibility in ticket timeline.
- [ ] Recovery UX (lost device flow, hold status, security messaging).
- [ ] Dispute UX (create case, message thread, status timeline).
- [ ] Staff scanner app (scan QR, success/fail reason, gate metrics).
- [ ] Organizer web portal MVP (event CRUD, ticket type setup, cancellation trigger, basic analytics).
- [ ] Accessibility and localization baseline (VN first, i18n-ready structure).

## Phase 12 - API Contracts and Integration

- [x] Publish OpenAPI spec for public APIs and internal APIs.
- [ ] Implement request/response validation and shared error code dictionary.
- [ ] Implement idempotency-key support for critical mutating endpoints.
- [ ] Implement webhook signature verification middleware.
- [ ] Build FE typed SDK/client from OpenAPI for consistency.
- [ ] Build contract-event consumer pipeline for ownership/status sync.
- [ ] Add integration tests for each critical journey:
- [ ] Registration + wallet provisioning.
- [ ] Purchase + payment webhook + mint.
- [ ] Resale listing + purchase + escrow settlement.
- [ ] Check-in success + duplicate/race rejection.
- [ ] Event cancellation + refund.
- [ ] Recovery + dispute escalation.

## Phase 13 - Quality Engineering and Verification

- [ ] Unit test targets agreed per service and FE module.
- [ ] Backend integration test suite with sandbox mocks for payment/KYC/wallet.
- [ ] Contract test suite in CI (`forge test --offline` + fuzz/property jobs).
- [ ] End-to-end tests for mobile and staff critical paths.
- [ ] Load tests for event release and gate check-in peaks.
- [ ] Chaos tests: RPC outage, payment webhook delay, KYC provider outage.
- [ ] UAT checklist with product + operations + support teams.

## Phase 14 - Security, Compliance, and Risk Controls

- [ ] Complete STRIDE threat model sign-off for all five core flows.
- [ ] Implement WAF, auth hardening, RBAC, and privileged access controls.
- [ ] Implement PII encryption at rest + redaction in logs.
- [ ] Implement anti-bot controls (rate limits, CAPTCHA, purchase throttles).
- [ ] Implement minter key controls (KMS, scoped IAM, alerting).
- [ ] Implement paymaster budget monitoring and automatic safeguards.
- [ ] Complete legal/compliance review for VN data residency and digital asset framing.
- [ ] Conduct penetration test and close critical/high issues before launch.

## Phase 15 - CI/CD and Environment Promotion

- [ ] Setup CI pipeline: lint -> typecheck -> tests -> build -> artifact signing.
- [ ] Setup CD pipeline with blue/green deploy and rollback automation.
- [ ] Setup DB migration pipeline with forward-only migration policy.
- [ ] Setup contract deployment pipeline with environment-specific config checks.
- [ ] Setup staging parity checks (same topology as prod where possible).
- [ ] Define release candidate checklist and go/no-go criteria.
- [ ] Define incident rollback criteria for app/backend/contracts.

## Phase 16 - Production Deployment and Launch Readiness

- [ ] Dry-run full production deployment in staging.
- [ ] Validate all third-party production credentials and callback URLs.
- [ ] Run pilot event simulation end-to-end with real operational staff.
- [ ] Verify monitoring dashboards, alert routes, and runbook links.
- [ ] Verify support workflows for refunds/recovery/disputes.
- [ ] Confirm business continuity plan and DR restoration drill.
- [ ] Execute soft launch, monitor KPIs, and gate full rollout by SLO.

## Phase 17 - Post-Launch Operations and Iteration

- [ ] Weekly KPI review (conversion, mint latency, check-in p95, dispute resolution SLA).
- [ ] Security posture review (key rotation, incident logs, abuse patterns).
- [ ] Cost/performance optimization review (RPC, queue, database, CDN).
- [ ] Prioritize Phase 1+ backlog (push notifications, search, ticket gifting).
- [ ] Prepare Phase 2 roadmap (VNeID, VNPAY full support, advanced analytics).

## Cross-Phase Exit Criteria (Definition of Done)

- [ ] Product sign-off: all MVP must-have flows accepted.
- [ ] Engineering sign-off: all P0/P1 defects closed or formally waived.
- [ ] Security sign-off: no unresolved critical/high vulnerabilities.
- [ ] Operations sign-off: runbooks, on-call, and alerting validated.
- [ ] Business sign-off: payment/KYC vendors and organizer pilot ready.
