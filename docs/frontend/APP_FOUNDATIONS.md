# Frontend Foundations

## Mobile Buyer App

Implemented modules in `apps/mobile/src`:

- Auth shell + OTP onboarding + session/wallet secure storage.
- Event discovery filtering + availability summarization.
- Purchase state machine (`reserved -> payment_pending -> success/failed`).
- My tickets + rotating QR payload helper.
- Marketplace listing validation and listing creation.
- Refund timeline augmentation.
- Recovery hold-state flow.
- Dispute thread creation/message updates.

## Staff Scanner

Implemented modules in `apps/staff-scanner/src`:

- QR payload evaluation with reason codes.
- Gate-level metrics aggregation (success/duplicate/failure).

## Organizer Portal

Implemented modules in `apps/organizer-portal/src`:

- Event CRUD baseline.
- Ticket type setup.
- Cancellation action.
- Basic analytics aggregation.

## Accessibility + Localization Baseline

- VN-first locale dictionary with EN fallback in `apps/mobile/src/i18n`.
- Accessibility labels for key primitives (event cards, ticket QR).
- Locale switch exposed at app state level.
