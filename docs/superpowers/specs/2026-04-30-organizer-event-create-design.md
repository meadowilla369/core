# Organizer Event Create Design

## Goal

Build an end-to-end event creation flow for organizer users so the event created in `apps/organizer-portal` supplies all content needed by the attendee-facing `apps/web` event detail experience.

The milestone must support draft-first creation, a review page, and a development publish path for testing the attendee app before platform-admin approval exists.

## Decisions

- Use the end-to-end approach: update backend schema/API, SDK types, organizer portal, and `apps/web`.
- Store rich event detail fields in a separate `event_metadata` table instead of widening the core `events` table.
- Use a four-step wizard with a persistent mobile event detail preview.
- Create events as drafts first.
- Add a review page with two actions: `Submit for review` and `Dev publish`.
- Use local/mock image upload in the organizer portal. Images are converted to data URLs and stored in metadata for this milestone.
- Update `apps/web` to render real event metadata and images when available, with existing fallback behavior when fields are absent.
- Ticket tiers support `name`, `price`, `quantity`, and `perks[]` in this milestone.

## Current Context

`apps/web/src/pages/EventDetailPage.tsx` currently renders:

- category
- title
- date and time
- location and address
- attendee count
- description
- lineup
- ticket tiers with price and perks

`apps/web/src/lib/adapters.ts` currently derives much of that detail from the event core record and fallback text because `event-service` only returns:

- `id`
- `organizerId`
- `title`
- `city`
- `venue`
- `startAt`
- `endAt`
- `status`
- `ticketTypes`

`services/event-service/src/server.ts` currently supports create event through `POST /events`, but it only persists core event fields and basic ticket type fields. It also requires `x-organizer-id`.

`apps/organizer-portal/src/pages/EventsPage.tsx` already has a `Create event` button, but it is not wired to a create flow.

## Data Model

### Core Event

The core event record remains responsible for operational fields:

- `id`
- `organizerId`
- `title`
- `city`
- `venue`
- `startAt`
- `endAt`
- `status`

Allowed statuses for this milestone:

- `draft`: created by organizer and editable.
- `in_review`: submitted for platform review; visible to organizer but not attendee discover.
- `active`: published and visible to attendee discover/detail.
- `cancelled`: no longer active.

`Dev publish` moves a draft or in-review event to `active` directly so the app can be tested end-to-end before platform-admin approval is implemented.

### Event Metadata

Add an `event_metadata` table with one row per event:

- `event_id`
- `category`
- `address`
- `description`
- `lineup`
- `hero_image_data_url`
- `poster_image_data_url`
- `updated_at`

`lineup` is stored as structured string array data. The implementation plan may choose JSONB in Postgres or a normalized child table, but the API contract must expose it as `string[]`.

Image data URL fields are intentionally non-production storage. They exist to support local/mock upload and end-to-end rendering in this milestone. A future storage service can replace these fields with durable media URLs without changing the organizer flow shape.

### Ticket Types

Ticket type records keep existing fields:

- `id`
- `name`
- `price`
- `quantity`
- `soldCount`

Add:

- `perks: string[]`

The attendee app uses `perks` directly. If a legacy ticket type has no perks, `apps/web` falls back to the existing generated availability details.

## API Contract

### Create Draft Event

`POST /v1/events`

Headers:

- `x-organizer-id`

Payload:

```json
{
  "title": "Cyber Symphony 2026",
  "city": "Ho Chi Minh",
  "venue": "Riverside Arena",
  "startAt": "2026-08-14T19:00:00.000Z",
  "endAt": "2026-08-14T23:00:00.000Z",
  "status": "draft",
  "metadata": {
    "category": "Hòa nhạc",
    "address": "Riverside Arena, Thu Duc, Ho Chi Minh",
    "description": "A full event description for attendee detail.",
    "lineup": ["Neural Beats", "Quantum Strings"],
    "heroImageDataUrl": "data:image/png;base64,...",
    "posterImageDataUrl": "data:image/png;base64,..."
  },
  "ticketTypes": [
    {
      "name": "General Admission",
      "price": 900000,
      "quantity": 5000,
      "perks": ["Vào cổng", "Khu vực đứng"]
    }
  ]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "evt_...",
    "organizerId": "org_...",
    "title": "Cyber Symphony 2026",
    "city": "Ho Chi Minh",
    "venue": "Riverside Arena",
    "startAt": "2026-08-14T19:00:00.000Z",
    "endAt": "2026-08-14T23:00:00.000Z",
    "status": "draft",
    "metadata": {
      "category": "Hòa nhạc",
      "address": "Riverside Arena, Thu Duc, Ho Chi Minh",
      "description": "A full event description for attendee detail.",
      "lineup": ["Neural Beats", "Quantum Strings"],
      "heroImageDataUrl": "data:image/png;base64,...",
      "posterImageDataUrl": "data:image/png;base64,..."
    },
    "ticketTypes": [
      {
        "id": "tt_...",
        "name": "General Admission",
        "price": 900000,
        "quantity": 5000,
        "soldCount": 0,
        "perks": ["Vào cổng", "Khu vực đứng"]
      }
    ]
  }
}
```

### Update Draft Event

`PUT /v1/events/:eventId`

Requirements:

- Requires `x-organizer-id`.
- Allows organizer to update core fields, metadata, ticket type fields, and ticket perks while event is `draft`.
- Does not allow editing another organizer's event.
- Rejects updates to non-draft events except status transitions handled by dedicated actions.

### Submit For Review

`POST /v1/events/:eventId/submit-review`

Behavior:

- Requires `x-organizer-id`.
- Validates publish-readiness fields.
- Changes `draft` to `in_review`.
- Does not expose the event in attendee discover because `apps/web` lists active events.

### Dev Publish

`POST /v1/events/:eventId/dev-publish`

Behavior:

- Requires `x-organizer-id`.
- Validates the same publish-readiness fields as submit review.
- Changes `draft` or `in_review` to `active`.
- Exists only to support local development and end-to-end validation before platform-admin approval.

## Organizer Portal UX

### Entry Point

The `Create event` button on `/events` navigates to `/events/new`.

### Wizard Layout

Use a three-column desktop layout:

- Left: step navigation and draft health.
- Center: active step form.
- Right: mobile event detail preview matching `apps/web` structure.

On tablet/mobile widths:

- Step navigation becomes a horizontal stepper.
- Preview moves below the form or into a preview tab.
- Form controls keep at least 40px touch targets.

### Step 1: Basic Info

Fields:

- title
- category
- city
- venue
- address
- start date/time
- end date/time

Validation:

- title is required.
- category is required for publish readiness.
- city is required.
- venue is required.
- address is required for publish readiness.
- start and end are required.
- end must be after start.

### Step 2: Story And Media

Fields:

- description
- lineup
- hero image upload
- poster image upload

Behavior:

- Lineup is edited as a repeatable list of artist/speaker names.
- Image upload accepts local files, converts them to data URLs, and shows preview.
- Hero image feeds the event detail hero.
- Poster image feeds discover/poster surfaces.

Validation:

- description is required for publish readiness.
- hero image is required for publish readiness.
- poster image is required for publish readiness.
- lineup may be empty, but the preview should show the same empty-state copy as `apps/web`.

### Step 3: Ticket Tiers

Fields per tier:

- tier name
- price in VND
- quantity
- perks

Behavior:

- At least one tier must exist before publishing.
- Perks are edited as repeatable short text values.
- The preview shows tier names, formatted prices, and perks exactly as `apps/web` will render them.

Validation:

- tier name is required.
- price must be zero or greater.
- quantity must be greater than zero.
- perks may be empty, but publish readiness warns when a tier has no perks.

### Step 4: Review Gates

Shows:

- missing required fields
- warnings for weak but allowed content
- mobile event detail preview
- payload summary

Actions:

- `Save draft`: persists the draft and stays in the wizard or moves to review depending on current state.
- `Continue to review`: saves draft and navigates to `/events/:eventId/review`.

### Review Page

Route:

- `/events/:eventId/review`

Shows:

- status badge
- attendee-facing preview
- publish-readiness checklist
- event metadata summary
- ticket tier summary

Actions:

- `Submit for review`: changes status to `in_review`.
- `Dev publish`: changes status to `active`.
- `Back to edit`: returns to `/events/:eventId/edit` while event is draft.

The review page is the place where a future platform-admin approval workflow can be introduced without changing the create wizard.

## apps/web Behavior

### Event Detail

`EventDetailPage` continues to consume `EventDetailView` and `TicketTierView`, but adapters map real metadata into those view models:

- `category` from metadata when present.
- `description` from metadata when present.
- `lineup` from metadata when present.
- `address` from metadata when present.
- `heroImageDataUrl` passed through to the detail view.
- `attendees` still derived from sold ticket counts.
- ticket tier perks from backend when present.

When metadata is absent, existing fallback derivation remains.

### Discover And Poster Surfaces

Discover card/poster conversion uses `posterImageDataUrl` when present. Existing visual fallback remains for seed or legacy events without poster metadata.

## SDK And Shared Types

Update `@ticket-platform/sdk-client` event types:

- `EventSummary.status`: use the union `draft | in_review | active | cancelled`.
- `EventDetail.metadata`.
- `TicketType.perks`.
- Add client methods for create/update/submit-review/dev-publish if not already present.

Update `@ticket-platform/shared-types` view types:

- Add optional `heroImageDataUrl` to `EventDetailView`.
- Add optional `posterImageDataUrl` to `EventCardView` and poster view models used by discover.

Use one naming style consistently in implementation. Because this milestone stores data URLs, prefer `heroImageDataUrl` and `posterImageDataUrl` in API types.

## Validation And Error Handling

Validation exists in two layers:

- Client-side validation for immediate wizard feedback.
- Backend validation for create/update/status transition safety.

Backend returns structured errors for:

- missing organizer header
- invalid payload
- event not found
- organizer mismatch
- invalid status transition
- publish-readiness failures

Organizer portal maps those errors to visible inline or page-level messages.

## Testing Strategy

Backend:

- Create draft with metadata and ticket perks.
- Reject create without organizer header.
- Reject invalid core fields.
- Update draft metadata and perks.
- Reject editing event owned by another organizer.
- Submit review only when publish-ready.
- Dev publish only when publish-ready.
- List active events excludes draft and in-review.
- Event detail returns metadata and perks.

SDK:

- Event types include metadata and perks.
- Client methods call expected endpoints and pass organizer headers.

Organizer portal:

- Domain/view-model builder validates required fields.
- Payload builder converts wizard state to API payload.
- Image helper converts file to data URL.
- Events page Create button routes to `/events/new`.
- Wizard save draft calls adapter and routes to review.

apps/web:

- `toEventDetailView` maps metadata category, address, description, lineup, and hero image.
- `toTicketTierViews` uses tier perks when present.
- Discover/poster adapters use poster image metadata when present.
- Existing fallback behavior remains when metadata is absent.

## Non-Goals

- Production media storage.
- Platform-admin approval UI.
- Seat maps or zone inventory.
- Sale windows per ticket tier.
- Rich text editor for description.
- Multi-organizer role management.

## Open Extension Points

- Replace data URL image fields with durable media URLs.
- Add platform-admin review queue using the `in_review` status.
- Add submitted review snapshots if event drafts should remain editable after submission.
- Add sale windows and zone inventory to ticket tiers.
