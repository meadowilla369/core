# Observability and Operations Runbooks

## Scope

Applies to API gateway and all backend services under `services/*`.

## Core Signals

- Availability: `/healthz` and `/readyz` for gateway and each service.
- Latency: p50/p95/p99 for public and internal endpoints.
- Error rate: 4xx and 5xx per route and per upstream service.
- Queue depth and retry counters:
- `payment-orchestrator`: webhook retry queue.
- `worker-mint`: pending jobs and support queue.
- `refund-service`: payout sync queue.

## Alert Baselines

1. `gateway_5xx_rate > 2%` for 5 minutes.
2. `gateway_p95_latency > 1500ms` for 10 minutes.
3. `webhook_retry_backlog > 200` for 10 minutes.
4. `mint_support_queue_count > 0` for 15 minutes.
5. `checkin_duplicate_spike > 3x baseline` for 10 minutes.

## Incident Triage Flow

1. Confirm blast radius:
- Gateway-wide or one upstream service.
- Public endpoints or internal/admin paths.
2. Check readiness fan-out via `GET /readyz`.
3. Inspect service logs by correlation key (`requestId`, `paymentId`, `reservationId`, `disputeId`).
4. Identify retryable vs non-retryable failures.
5. Apply mitigation and document timeline.

## Playbook: Payment Webhook Delay

1. Check `payment-orchestrator` health and retry queue metrics.
2. Inspect signature errors (`WEBHOOK_SIGNATURE_INVALID`, `WEBHOOK_TIMESTAMP_OUT_OF_RANGE`).
3. Trigger one manual retry cycle if queue is stalled.
4. Verify idempotency key collisions are not blocking new events.
5. Escalate to payment provider if callback latency exceeds SLA.

## Playbook: Mint Backlog

1. Check `worker-mint` queue depth and retry counts.
2. Validate contract RPC reachability (primary/fallback).
3. Confirm minter signer/key access path is healthy.
4. Drain support queue with controlled batch replay.
5. Notify support for customer-facing delay messaging.

## Playbook: Check-in Degradation

1. Validate `checkin-service` health and gate-level metrics.
2. Inspect invalid signature and duplicate scan rates.
3. If scanner network unstable, switch gate devices to backup network.
4. Continue first-scan-wins policy and log rejected duplicates.
5. Publish status update to operations channel every 15 minutes.

## Playbook: Recovery and Dispute Surge

1. Monitor `recovery-service` active holds and `dispute-service` SLA breaches.
2. Prioritize Tier 1 auto-rule eligible cases.
3. Escalate blocked recoveries (hold expired but not rotated) to on-call engineer.
4. Apply pre-approved goodwill credits where policy allows.

## Post-Incident Checklist

1. Root cause statement with impacted time window.
2. Customer impact summary and affected volume.
3. Corrective actions with owners and due dates.
4. Detection/alert gap updates.
5. Runbook update if manual workaround was required.
