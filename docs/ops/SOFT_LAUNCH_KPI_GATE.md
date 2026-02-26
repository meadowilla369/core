# Soft Launch KPI Gate

## Gate Metrics

- Conversion: no regression > 10% versus staging baseline.
- Mint latency p95: within agreed SLO.
- Check-in validation success rate: >= 99%.
- Dispute first response SLA: >= 95% within target window.

## Rollout Rule

- Expand rollout only when all KPI gates pass for 48 hours.
- Freeze rollout and trigger incident review if any KPI gate fails.

Final status: **Soft launch KPI gate defined for controlled production rollout.**
