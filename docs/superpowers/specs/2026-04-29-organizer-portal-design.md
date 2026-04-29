# Organizer Portal Design

## Goal

Upgrade `apps/organizer-portal` from a TypeScript skeleton into a dedicated web portal for event organizers. The portal should give a single `Organizer Admin` a clear operational command center for event setup, ticket inventory, live check-in, refund/dispute handling, settlement, and service health.

The first design milestone is intentionally UI-first. It defines the product surface, information architecture, status language, and integration boundaries before implementation starts.

## Scope

This scope includes:

- A dedicated React web app in `apps/organizer-portal`.
- A light "Clean Blue SaaS" admin interface, separate from the dark attendee app.
- One role for the first version: `Organizer Admin`.
- Overview dashboard for all organizer events.
- Event creation, editing, cancellation, and ticket type setup.
- Ticket inventory visibility across sold, locked, and available counts.
- Live check-in metrics, gate breakdown, invalid scan reasons, and mark-as-used job visibility.
- Refund queue visibility after event cancellation or refund requests.
- Dispute queue visibility with SLA and moderation status.
- Settlement and reconciliation visibility for primary sales, resale royalties, and payout readiness.
- System health view for service readiness and operational job failures.

This scope excludes:

- Multi-role RBAC in the first version.
- A public organizer self-onboarding flow. Organizer verification remains manual and ops-assisted for MVP.
- Replacing attendee web/mobile surfaces.
- Building new backend capabilities not represented by existing services or documented requirements.

## Current Context

`apps/organizer-portal` currently exposes baseline TypeScript logic:

- create organizer events
- set ticket types
- cancel events
- summarize analytics from event sales snapshots

The wider repo already provides relevant service surfaces and product requirements:

- `event-service`: event list/detail/create/update/cancel, ticket types, availability, organizer ownership via `x-organizer-id`
- `ticketing-service`: inventory sync, reservation and ticket ownership flows
- `checkin-service`: verify QR, event stats, gate stats, mark-as-used job list
- `refund-service`: refund requests, user refund status, sync
- `dispute-service`: dispute creation, messaging, escalation, internal moderation
- `marketplace-service`: resale listings, sales, settlement finalization
- product docs: VND-only MVP, manual organizer onboarding, event cancellation/refund workflow, atomic check-in, support/dispute baseline, launch readiness expectations

The portal should use these existing patterns rather than invent a separate domain model.

## Design Direction

The approved direction is **Operations Command Center** with a **Clean Blue SaaS** visual system.

The UI should feel like a modern management website: bright background, white data surfaces, restrained borders, clear tables, predictable filters, and visible operational status. It must not inherit the attendee app's dark, brutalist visual language. This distinction matters because organizers use the portal for repeated operational work, comparison, and exception handling.

Core visual tokens:

- Page background: very light slate, `#F8FAFC`
- Surface/card: white, `#FFFFFF`
- Primary/action blue: `#2563EB`
- Primary blue soft background: `#DBEAFE`
- Border: `#E2E8F0`
- Main text: `#162033` or equivalent slate near `#0F172A`
- Secondary text: `#64748B`
- Radius: 6-8px for cards, badges, buttons, and drawers

## Information Architecture

### Overview

The default landing page is the operational command center. It should include:

- KPI cards: gross sales, tickets sold, check-in rate, open risk items
- active event operations table
- live gate/check-in summary
- risk queue cards for refunds, disputes, settlement, and sync/job failures
- refresh timestamp and export affordance

The page answers: "What needs attention right now?"

### Events

The Events section manages organizer-owned events:

- list events with status, date, city, venue, inventory, and risk flags
- create event with required fields: `title`, `city`, `venue`, `startAt`, `endAt`
- attach or edit ticket types: `name`, `price`, `quantity`
- cancel event with a confirmation flow and visible refund impact
- open a detail drawer or page for event-specific operations

The existing ownership rule applies: only the organizer from `x-organizer-id` can update or cancel the event.

### Ticket Inventory

The inventory view shows capacity and sales health:

- ticket type table by event
- quantity, sold, locked, available, and sell-through rate
- low inventory warnings
- sync status from event-service to ticketing-service

This view should make inventory discrepancies visible without requiring operators to inspect raw APIs.

### Live Check-In

The live check-in view uses checkin-service stats:

- event selector
- total scans, valid scans, invalid scans
- invalid scan reasons such as expired QR, invalid signature, nonce replay, already used
- gate breakdown with success counts
- mark-as-used job queue with pending, retrying, processed, and failed states

This page should prioritize fast scanning health and venue risk. Duplicate and invalid scans are warning or critical states depending on reason and volume.

### Refunds

The refunds section is a work queue:

- refund request list with event, ticket, amount, method, status, retry count, and timestamps
- filters for pending, processing, completed, and failed
- event cancellation context where relevant
- detail drawer with audit notes and payout reference

For MVP, the portal should surface visibility and safe actions. It should avoid adding irreversible payout actions unless backend support is clearly available.

### Disputes

The disputes section is an SLA-oriented queue:

- dispute list with category, event, ticket, amount, tier, SLA deadline, and current status
- filters by category, severity, SLA, and event
- detail drawer showing gathered evidence, message thread, audit log, and moderation state
- escalation and moderation affordances when backed by existing internal endpoints

The UI should distinguish platform/user/organizer disputes and make manual review obvious.

### Settlement

The settlement section shows money movement:

- primary sales totals
- resale royalty totals
- platform fee and organizer payout estimates
- reconciliation status
- settlement readiness or blocked reasons
- finalize action only behind confirmation and internal endpoint support

Financial states should be conservative: pending and reconciling are not success states.

### System Health

The health view gives organizers and ops a readable service status:

- service health checks for event, ticketing, check-in, refund, dispute, marketplace, and gateway
- stale sync warnings
- failed jobs: mint support queue, mark-as-used failures, refund retries, settlement failures where available
- last refreshed timestamp

This is not a full observability replacement. It is a product-level readiness view for organizer operations.

## Status Color System

Colors must be consistent across badges, tables, filters, chart legends, alerts, and detail drawers. The UI must pair color with text labels and, where useful, icons. Do not communicate status by color alone.

### Core Meaning

- Blue `#2563EB`: draft, scheduled, upcoming, selected, normal in-progress, ready informational state
- Green `#16A34A`: active, live, completed, paid, valid, resolved, processed successfully
- Amber `#D97706`: attention needed, pending, duplicate, low inventory, retrying, SLA approaching
- Red `#DC2626`: cancelled, failed, invalid, blocked, expired, SLA breached
- Slate `#64748B`: neutral, archived, ended, inactive, not started, no data
- Purple `#9333EA`: manual review, reconciliation, moderation, support investigation

### Business Mapping

Event statuses:

- `Draft`: Blue
- `Scheduled` or newly created but not yet started: Blue
- `Upcoming`: Blue
- `Active` or currently live: Green
- `Postponed`: Amber
- `Cancelled`: Red
- `Ended` or archived: Slate

Check-in statuses:

- `Valid`: Green
- `Duplicate` or `Already used`: Amber
- `QR expired`: Amber
- `Invalid signature`: Red
- `Wrong event`: Red
- `Sync retry`: Purple or Amber depending on whether manual review is needed
- `Mark-as-used failed`: Red

Refund statuses:

- `Open`: Blue
- `Pending payout`: Amber
- `Processing`: Blue
- `Completed`: Green
- `Failed`: Red
- `Manual review`: Purple

Dispute statuses:

- `Open`: Blue
- `In review`: Purple
- `Awaiting user evidence`: Amber
- `Escalated`: Amber or Purple
- `Resolved`: Green
- `Rejected` or `SLA expired`: Red

Settlement statuses:

- `Ready`: Blue
- `Reconciling`: Purple
- `Pending payout`: Amber
- `Paid`: Green
- `Blocked` or `Failed`: Red

## Interaction Patterns

Use consistent admin patterns:

- Sidebar navigation for primary sections.
- Top bar with current context, event selector when needed, refresh timestamp, and primary action.
- Tables for operational entities, with search, filters, sorting, and pagination where lists can grow.
- Right-side drawers for details, evidence, audit logs, and secondary actions.
- Confirmation dialogs for destructive or financial actions such as event cancellation and settlement finalization.
- Skeleton loading for dashboard cards and tables.
- Empty states that explain what is missing and how to proceed.
- Error states that preserve partial data when one service fails.

## Data Flow

The portal should use a small organizer API/client layer rather than direct fetch calls scattered through components.

Expected integration boundaries:

- events: `GET /v1/events?organizerId=...`, `POST /v1/events`, `PUT /v1/events/:id`, `POST /v1/events/:id/cancel`, `GET /v1/events/:id/availability`
- check-in: `GET /v1/checkin/events/:eventId/stats`, `GET /v1/checkin/events/:eventId/gates`, `GET /v1/checkin/mark-as-used/jobs`
- refunds: `GET /v1/refunds...` or service-backed queue endpoints as available
- disputes: `GET /v1/disputes...`, `POST /v1/internal/disputes/:id/moderate` when internal moderation is in scope
- marketplace/settlement: marketplace sales and internal settlement finalization endpoints as available
- health: gateway and service health/readiness endpoints

Where a backend endpoint is not yet available for organizer-level aggregation, the first implementation may use typed mock adapters with clear fallback labels. The UI should be structured so mock data can be replaced by service data without redesign.

## Error Handling

The portal should handle partial service failure explicitly:

- If event-service fails, show a blocking state for event-dependent screens.
- If checkin-service fails, keep event data visible and mark live check-in unavailable.
- If refund/dispute/settlement endpoints fail, show the queue card as unavailable and provide retry.
- If health checks fail, use Red only for failed service states and Amber for stale or degraded states.
- If an action fails, keep the drawer open, show the error, and do not optimistically mark high-risk actions complete.

## Accessibility

Accessibility requirements:

- Status always has text labels and does not rely on color alone.
- Buttons and table row actions have visible focus states.
- Tap/click targets are at least 40px high in dense tables and 44px for primary actions.
- Contrast must meet WCAG AA for text and badges.
- Drawer focus should be trapped while open and restored on close.
- Destructive actions must be keyboard accessible and confirmable.

## Testing And Verification

When implementation starts, tests should cover:

- status-to-color mapping for event, check-in, refund, dispute, and settlement states
- organizer event create/update/cancel request shapes and ownership headers
- analytics summary cards from event/ticket/check-in snapshots
- table filtering and empty/error states
- drawer open/close and destructive confirmation behavior
- partial service failure rendering
- route coverage for all primary sections

Manual visual verification should include:

- 375px, 768px, 1024px, and 1440px widths
- long event names and venue names
- empty queues and high-volume queues
- color contrast on all badges
- no overlap in dense dashboard cards or table cells

## Open Decisions

The following decisions are intentionally deferred to implementation planning:

- Exact charting library, if charts are needed beyond simple metric cards.
- Whether `apps/organizer-portal` should share shadcn components from `apps/web` or own a minimal local UI layer.
- Which refund and settlement actions are enabled in the first coded milestone versus read-only.

These are implementation choices, not blockers for the approved product design.
