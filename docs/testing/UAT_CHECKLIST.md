# UAT Checklist (Product + Operations + Support)

## Product Validation

1. Registration/login flow works with OTP retry and expiration handling.
2. Event discovery and event detail pages show consistent inventory.
3. Purchase flow shows correct pending/success/failure states.
4. Marketplace listing and purchase show fee and payout transparency.
5. Recovery and dispute UX copy is clear and policy-aligned.

## Operations Validation

1. Check-in scanner handles success, duplicate, and invalid signature outcomes.
2. Event cancellation triggers refund pipeline visibility.
3. Observability dashboards show key KPIs and alert routes.
4. Internal moderation and settlement endpoints are reachable with correct auth keys.
5. Runbook links are accessible from on-call handoff documentation.

## Support Validation

1. Support can inspect refund/recovery/dispute status using internal APIs.
2. Escalation tiers and SLA timestamps are visible for disputes.
3. Support queue for mint failures is queryable and actionable.
4. Standard response templates exist for payment delay, check-in rejection, and recovery hold.
5. Goodwill credit policy triggers are clear and auditable.

## Sign-Off

- Product Lead: ____________________ Date: __________
- Operations Lead: __________________ Date: __________
- Support Lead: _____________________ Date: __________
