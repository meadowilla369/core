# Home/Discover Poster-First Design

## Summary

This spec defines a focused UI refresh for `apps/web` limited to `Home` and `Discover`.

The direction is:

1. Keep the app's dark, mobile-first, border-driven visual language.
2. Make `Home` and `Discover` feel like a real event product by putting poster-style imagery at the center of browsing.
3. Preserve Ticket Platform trust signals through explicit metadata, badges, and panels rather than flattening the interface into a generic media feed.

This is a presentation-layer redesign only. It does not change routes, backend contracts, or transactional purchase flows in the first rollout.

## Goals

- Increase visual appeal of `Home` and `Discover` without breaking the existing product identity.
- Make browsing feel richer and more event-native through image-led cards and varied section rhythm.
- Keep trust visible within the first glance through `Verified`, `Resale safe`, `Official seller`, price, and sync metadata.
- Reuse the current app structure, hooks, and mobile layout to minimize regression risk.

## Non-Goals

- Redesigning the full app.
- Changing marketplace, purchase, tickets, or profile flows in this phase.
- Requiring new backend fields before shipping the first version.
- Replacing the overall dark theme or global typography system.

## Design Direction

### Visual Language

The chosen direction is a hybrid of:

- `Poster mosaic discover` for content structure and imagery.
- `Dark still primary` for overall surfaces and restraint.

That means:

- Dark surfaces remain dominant.
- Event posters, covers, or artwork provide most of the visual energy.
- Accent color is used sparingly and intentionally for trust/status UI, chips, and primary CTAs.
- Trust remains bold enough to fit Ticket Platform, but does not visually overpower the poster-led discovery experience.

### Product Tone

The intended tone is:

- trustworthy
- contemporary
- slightly underground / premium nightlife
- operational, not decorative

The result should feel like a credible ticket platform with real event energy, not a generic entertainment feed and not a sterile transactional dashboard.

## Home Structure

`Home` becomes a layered discovery surface with stronger rhythm between sections.

### Top Area

- Sticky top area remains.
- Header stays compact and mobile-first.
- Category rail remains available, but it should visually support discovery rather than dominate the screen.

### Poster Spotlight Hero

The first major block is a large `PosterSpotlightHero`:

- large poster/cover image
- dark overlay for readability
- event title, date/location, and starting price
- trust badges such as `Verified` and `Resale safe`
- compact trust panel below or within the lower portion of the hero
- clear CTA to event detail

This block should establish both emotional pull and transactional confidence immediately.

### Discovery Blocks

Below the hero, `Home` should use varied discovery sections rather than repeating identical grids.

Recommended sections:

- `Hot now`
- `Near you`
- `Editor picks`
- `By mood`

These sections should use mixed poster layouts:

- one large lead tile
- paired smaller poster cards
- narrow horizontal rails where appropriate

The page should feel curated, not mechanically list-based.

### Trust Layer

Trust on `Home` is explicit but compact:

- small badges on cards
- concise metadata under prominent cards
- one or more inline trust panels where useful

Trust content can include:

- starting price
- save/interest count
- sync status
- official seller status
- refund or resale-safe indicators

## Discover Structure

`Discover` evolves from a simple searchable grid into a richer browsing feed.

### Search and Filters

The top of `Discover` should include:

- a stronger search header
- persistent filter chips
- access to a deeper filter sheet

The search UI should remain fast, legible, and mobile-friendly. Filtering should not block the page from feeling content-rich.

### Poster Mosaic Feed

The main body becomes a `poster mosaic` feed with mixed block sizes.

Feed composition can include:

- large hero-style tiles
- two-up cards
- category or mood strips
- compact poster cards with stronger metadata

The point is controlled variation. The feed should feel editorial while still predictable enough for repeated use.

### Trust Presentation

`Discover` keeps a strong trust layer, but it sits below imagery in the visual hierarchy.

Each meaningful event card should expose enough information for fast evaluation:

- category
- date/location
- starting price label
- trust badges if applicable
- interest count or inventory cue where available

Trust terms should never be implied when no supporting data exists.

## Components To Add

### New Components

- `PosterSpotlightHero`
- `PosterMosaicRail`
- `DiscoverSearchHeader`
- `FilterChipRow`
- `TrustPanelInline`
- `EventPosterCard`
- `EditorialSectionBlock`
- `EmptyStateDiscover`

### New Modal / Sheet Surfaces

- `QuickPreviewModal`
- `FilterSheet`
- `TrustInfoModal`
- `SavedEventsSheet`
- `LocationMoodPickerModal`

These should reuse existing `shadcn` primitives already present in `apps/web`, especially `dialog`, `sheet`, `badge`, and `card`.

## Data Model Strategy

The first rollout should not depend on backend changes.

`HomePage` and `DiscoverPage` should continue using `useEventCatalog()` and current fallback sources.

The UI layer may add optional presentation-oriented fields such as:

- `imageUrl`
- `heroImageUrl`
- `mood`
- `isVerified`
- `isOfficialSeller`
- `syncStatus`
- `interestCount`
- `startingPriceLabel`
- `locationCluster`

If real data is unavailable:

- derive what can be derived from existing fields
- use neutral fallback labels
- hide unsupported trust claims rather than fabricating certainty

## Loading, Error, and Fallback States

### Loading

`Home` should render:

- poster hero skeleton
- mosaic tile skeletons

`Discover` should render:

- search header immediately
- mosaic skeleton feed below

The layout should remain stable during loading.

### Error / Fallback

If `event-service` fails:

- continue rendering the poster-based UI
- use `fallback-data`
- show only a small operational notice

The fallback experience should still look intentional and complete.

### Image Failure

If event imagery is missing or unreliable:

- use gradient poster placeholders
- preserve overlay and metadata structure
- keep every card readable regardless of image brightness or contrast

## Interaction Design

### Quick Preview

Tapping a prominent poster can optionally open a quick preview modal that shows:

- larger art
- date
- venue
- price range
- trust state
- CTA to full detail

This is useful if the team wants richer browsing without forcing navigation for every glance.

### Filters

Deep filtering should move into a mobile sheet rather than overloading the main header area.

Examples:

- vibe
- location
- budget
- verified-only

### Trust Explanation

Because trust is central to Ticket Platform, a dedicated modal should explain terms like:

- `Verified`
- `Resale safe`
- `Official seller`
- `On-chain synced`

This should reduce ambiguity without cluttering the feed.

## Implementation Boundaries

Phase 1 scope is intentionally narrow:

- `apps/web/src/pages/HomePage.tsx`
- `apps/web/src/pages/DiscoverPage.tsx`
- supporting mobile components used only by those screens

Out of scope for this phase:

- `EventDetail`
- purchase pages
- marketplace flows
- tickets/profile redesign
- backend schema changes

Existing components may remain in place during the transition. The old `EventCard` does not need to be removed immediately.

## Verification Requirements

The implementation must be checked at minimum on:

- `375px`
- `390px`
- `430px`
- one desktop preview width

The following states must be verified for both `Home` and `Discover`:

- loading
- success with data or fallback
- service error using fallback notice

The following UI conditions must also be checked:

- posters with strong color
- posters with poor contrast
- no poster available
- modal and sheet open/close behavior
- readable text over all poster treatments
- visible focus states
- no broken bottom navigation behavior

## Success Criteria

The design is successful if:

- `Home` feels materially more attractive and event-native than the current version.
- `Discover` no longer reads as a plain filtered grid.
- Trust remains understandable within the first one to two seconds of scanning a card or hero.
- The redesign feels like an evolution of the current app rather than a different product.
- The new experience remains stable even when running entirely on fallback data.

## Open Decisions Already Resolved

These choices have been made during brainstorming:

- Focus area: `Home/Discover`
- Discovery style: `Poster mosaic discover`
- Trust weight: `Strong`
- Surface direction: hybrid, leaning toward `Dark still primary`

## Recommended Rollout Order

1. Introduce new poster-first components alongside existing components.
2. Upgrade `HomePage` first.
3. Upgrade `DiscoverPage` second.
4. Add modal/sheet surfaces after the core browsing layout is stable.
5. Reassess whether the same language should extend to other parts of the web app.
