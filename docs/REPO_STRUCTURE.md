# Repository Structure

## Applications
- apps/mobile: Buyer mobile app (MVP flow modules + state shell).
- apps/staff-scanner: Staff check-in scanner app.
- apps/organizer-portal: Organizer web portal.
- apps/ui-simulator: Browser-based UI runner for user testing across all three app flows.

## Backend Services
- services/api-gateway
- services/auth-service
- services/user-service
- services/kyc-service
- services/event-service
- services/ticketing-service
- services/payment-orchestrator
- services/marketplace-service
- services/checkin-service
- services/refund-service
- services/recovery-service
- services/dispute-service
- services/notification-service
- services/contract-sync-service
- services/worker-mint

## Shared Packages
- packages/shared-types: Shared domain types and DTOs.
- packages/sdk-client: Shared typed API client scaffolding.
- packages/config-typescript: Shared tsconfig presets.
- packages/integration-suite: Integration/e2e/load/chaos/contracts quality test harness.

## Smart Contracts
- contracts: Foundry project for TicketNFT, Marketplace, Paymaster, GuardianAccount.

## Infrastructure and Configuration
- infra/terraform: IaC modules and environment stacks.
- infra/k8s: Kubernetes manifests skeleton.
- infra/docker: Dockerfile templates.
- infra/db: SQL migrations and local/dev seed fixtures.
- config/integrations: Third-party provider and RPC configuration contracts.
- config/security: Security policies (WAF, RBAC, PII, anti-bot, key/budget controls).

## Scripts
- scripts/bootstrap.sh: Local setup helper.
- scripts/checklist-status.sh: Quick checklist status helper.
- scripts/check-error-codes.sh: Validate service error codes against shared dictionary.
- scripts/validate-migrations.sh: Enforce forward-only DB migration policy.
- scripts/sign-artifacts.sh: Generate SHA-256 checksum manifest for build artifacts.
- scripts/run-contract-quality-gates.sh: Offline + fuzz/property contract quality suite.
- scripts/check-staging-parity.sh: Compare staging/prod topology modules.
- scripts/deploy-bluegreen.sh: Blue/green deployment automation.
- scripts/rollback-release.sh: Release rollback automation.
- scripts/validate-contract-deploy-config.sh: Contract env config validation.
- scripts/release-candidate-gate.sh: Release readiness doc gate.
- scripts/incident-rollback-gate.sh: Rollback criteria gate.
- scripts/security/*: Security monitoring and log-redaction utilities.

## Operational Docs
- docs/ops: Observability, launch readiness, and operations cadence.
- docs/ci: CI/CD, contract deploy, and staging parity documentation.
- docs/product: MVP scope, requirement decisions, and roadmap prioritization.
- docs/testing: Unit targets and UAT checklists.
- docs/infra: Infrastructure/integration setup and secrets rotation policy.
- docs/contracts: Governance model, contract emergency runbooks.
- docs/security: Threat model sign-off, hardening baseline, audit/compliance artifacts.
- docs/frontend: Mobile/staff/organizer frontend foundations and UX flow mapping.
- docs/release: Release candidate and rollback criteria.
- docs/signoff: Cross-functional final sign-off records.
