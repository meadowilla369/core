# Design Tokens And Component Contract

## Token Contract (required before full implementation)

Expected source files:

- `docs/ui/tokens/ui_tokens.json`
- `docs/ui/tokens/typography_scale.json`
- `docs/ui/tokens/spacing_scale.json`

Minimum token groups:

- `color`: background, surface, border, text, primary, success, warning, danger
- `typography`: font family, size scale, line height, weight
- `space`: 4/8/12/16/24/32 baseline
- `radius`: sm/md/lg/xl
- `elevation`: card, modal, overlay
- `motion`: duration/easing for transitions and QR refresh pulse
- `breakpoint`: mobile, tablet, web

## Component Inventory

P0 components:

- AppBar
- TabBar
- EventCard
- PriceBreakdownCard
- QuantityStepper
- PaymentMethodSelector
- TicketCard
- DynamicQrPanel
- KycStepper
- ScanResultCard
- DataTable (web)
- ConfirmDialog

## Interaction Rules

- Button variants: primary, secondary, ghost, danger
- Input variants: default, focused, error, disabled
- Card variants: default, selected, disabled, warning
- Motion budget: avoid long transitions (>300ms) for transactional actions

## Accessibility Baseline

- Minimum color contrast ratio 4.5:1 for body text
- Touch target minimum 44x44
- Web keyboard focus visible for all interactive controls
- Error text paired with field-level semantics
