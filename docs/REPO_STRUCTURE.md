# Repository Structure

## Applications
- apps/mobile: Buyer mobile app (React Native in implementation phase).
- apps/staff-scanner: Staff check-in scanner app.
- apps/organizer-portal: Organizer web portal.

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

## Smart Contracts
- contracts: Foundry project for TicketNFT, Marketplace, Paymaster, GuardianAccount.

## Infrastructure
- infra/terraform: IaC modules and environment stacks.
- infra/k8s: Kubernetes manifests skeleton.
- infra/docker: Dockerfile templates.
- infra/db: SQL migrations and local/dev seed fixtures.

## Scripts
- scripts/bootstrap.sh: Local setup helper.
- scripts/checklist-status.sh: Quick checklist status helper.
- scripts/check-error-codes.sh: Validate service error codes against shared dictionary.
- scripts/validate-migrations.sh: Enforce forward-only DB migration policy.
- scripts/sign-artifacts.sh: Generate SHA-256 checksum manifest for build artifacts.

## Operational Docs
- docs/ops: Observability alerts and incident runbooks.
- docs/ci: CI pipeline and migration policy documentation.
- docs/product: MVP scope and requirement decision records.
- docs/testing: Unit targets and UAT checklists.
