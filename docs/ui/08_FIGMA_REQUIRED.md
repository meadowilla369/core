# Figma Input Needed (High Priority)

These are the screens where visual/interaction ambiguity is highest.  
Please share Figma Dev Mode links for these first.

## P0 Required Before UI Implementation Starts

| Screen ID | Why Figma Is Required | Deliverables Needed |
|---|---|---|
| `bs_explore` | Card density and section hierarchy drive retention | Mobile + web layouts, card specs, badges, spacing |
| `bs_event_detail` | CTA logic and offer grouping need precise hierarchy | Hero, offer modules, sticky CTA behavior |
| `bs_checkout` | Conversion-critical transactional screen | Summary layout, payment selector states, terms/error states |
| `bs_ticket_detail` | QR panel and secure viewing UX | QR area, refresh indicator, blocked/error states |
| `bs_resale_create` | Complex price + policy explanation in one screen | Price input behavior, fee breakdown, warning banners |
| `bs_kyc_stepper` | Multi-step capture flow with camera handoff | Stepper, capture guidance, result states |
| `stf_scan` | Camera overlay and quick actions are operational-critical | Scanner frame, manual input fallback, status footer |
| `stf_result` | Fast decision UI for gate staff | Valid/invalid templates, tone hierarchy, auto-return behavior |
| `btc_dashboard` | Dense data visualization on web | KPI cards, list/table layout, empty/error view |
| `plt_disputes` | Triage productivity depends on table/filter UX | Queue table, SLA indicators, filter bar |
| `plt_dispute_detail` | Decision safety and auditability | Evidence panel, action panel, timeline layout |

## P1 Can Be Implemented After P0

- `bs_search`
- `bs_profile`
- `stf_history`
- `btc_checkin_ops`
- `plt_refunds`
- `plt_recovery`
- `plt_contract_sync`

## Figma Handoff Checklist

For each P0 frame, include:

1. Component variants and interactive states
2. Spacing and typography tokens
3. Breakpoint behavior (mobile/web)
4. Empty/error/loading visuals
5. Notes for motion/transition where relevant
