# Flow 0 Registration + Wallet Bootstrap Design

## Summary

This spec defines the first end-to-end implementation of `Flow 0` for Ticket Platform:

- real phone number input
- dev-mode OTP verification
- local wallet generation in `apps/web`
- backend wallet registration
- one-time initial gas prefund on local dev chain
- explicit onboarding UI and status surfaces

The goal is to make this flow work as a real product journey, not only as backend plumbing.

## Goals

- Make `Flow 0` work end-to-end in local development using a real phone number and dev OTP.
- Implement the user-facing onboarding flow in `apps/web`.
- Add the right modal/sheet/page surfaces for OTP, wallet creation, prefund, retry, and success.
- Connect `entr-landing` to the onboarding flow in a way that preserves the landing page's acquisition purpose.
- Keep the prefund logic real and idempotent against the local dev chain.

## Non-Goals

- Integrating a real SMS provider.
- Implementing the same onboarding flow in `apps/mobile` in this phase.
- Extending beyond Flow 0 into purchase, resale, recovery, or check-in.
- Turning the landing page into a full auth surface.

## Chosen Product Direction

### User Journey

The chosen path is:

1. `entr-landing` remains an acquisition and trust-building surface.
2. A CTA on landing hands the user off to a dedicated `apps/web` onboarding route.
3. `apps/web` executes the full `Flow 0` end-to-end.

This preserves the original purpose of landing while giving the team a real web demo path for onboarding and localchain integration.

### Environment Choice

The chosen OTP mode is:

- real phone number
- dev OTP returned by backend response

This keeps the flow technically real enough to test registration, wallet bootstrap, and prefund, without introducing SMS vendor dependencies.

## Landing Page Role

`entr-landing` should not directly perform OTP or wallet bootstrap.

It should:

- sell the product story
- explain trust and user value
- drive download intent for mobile
- offer a secondary CTA for trying the web onboarding demo

### Landing Changes

#### Hero

The hero should expose two clear paths:

- primary CTA: `Tải app`
- secondary CTA: `Trải nghiệm web demo`

The supporting line beneath or near the CTA should briefly explain the Flow 0 promise:

- `Phone OTP`
- `Ví tự tạo`
- `Gas khởi tạo tự động`

#### How It Works

The current `No Wallet Needed` messaging should be updated so it reflects the chosen onboarding truth.

Replace messaging like:

- `Email Signup`

With messaging aligned to Flow 0:

- `Phone OTP`
- `Invisible wallet bootstrap`
- `First gas prefund handled for you`

#### Bottom CTA

The final CTA area should become the strongest handoff point:

- app download remains present
- web onboarding demo is explicitly available
- the user should understand that mobile remains the main destination, while web onboarding is the demo and local-dev proof path

## Web App Role

`apps/web` is the primary execution surface for Flow 0 in this phase.

It should implement a dedicated onboarding route, such as:

- `/onboarding`

This route should own the full state machine for:

- phone entry
- OTP request
- OTP verification
- wallet generation
- wallet registration
- prefund waiting
- ready state

## Backend Boundary

### `auth-service`

Responsible for:

- requesting OTP
- verifying OTP
- returning session or auth state derived from the verified phone number

In dev mode, this service may expose the OTP code in its response so the flow is testable with a real phone number but no SMS delivery.

### `payment-orchestrator`

Responsible for:

- wallet bootstrap registration
- enforcing one-time prefund behavior
- sending initial native-token prefund to the generated wallet on localchain
- persisting prefund status and metadata
- exposing prefund status to the web app

### `user-service`

May ensure the user profile shell exists after auth verification, but should not become the primary owner of wallet bootstrap behavior in this phase.

### Local Dev Chain

The chain remains the real execution layer for the prefund transaction.

The frontend should not send prefund transactions directly.

The frontend should only:

- generate the local EOA
- submit wallet registration
- wait for backend-managed prefund completion

## Detailed UX Flow

### Screen 1: Phone Entry

Purpose:

- collect the user's real phone number
- explain why the phone number is needed

Required UI:

- phone input
- `Nhận mã OTP` primary CTA
- help entry point explaining why phone is needed

Supporting modal:

- `WhyPhoneModal`

This modal should explain:

- phone is used for login
- phone is the first recovery anchor
- phone helps reduce abuse and duplicate registrations

### Screen 2: OTP Verify

Purpose:

- verify the user through the dev-mode OTP flow

Required UI:

- 6-digit OTP surface
- countdown
- resend action
- clear error state rendering

Supporting modal:

- `OtpHelpModal`

This modal should explicitly explain that in dev mode, OTP comes from backend response rather than SMS delivery.

Required error states:

- incorrect OTP
- expired OTP
- rate limited OTP request

### Screen 3: Wallet Bootstrap

Purpose:

- transition the user from verified identity to invisible wallet setup

Required UI:

- progress/state timeline
- copy that reassures the user no crypto complexity is required

Supporting modal:

- `WhatIsThisWalletModal`

This modal should explain:

- the app creates a wallet automatically
- the user does not need to manually configure a wallet to begin
- the wallet will be used for tickets and future on-chain actions

### Screen 4: Prefund Pending

Purpose:

- show the technical bootstrap state in a trustworthy, understandable way

This is the most important status screen in Flow 0.

Required UI:

- explicit state timeline
- `wallet registered`
- `prefund submitted`
- `waiting confirmation`

Supporting modal:

- `WhyInitialGasModal`

This modal should explain that the platform only provides the initial gas bootstrap once so the first transaction can work cleanly.

Required error states:

- prefund delayed
- prefund submission failed
- RPC unavailable
- retry available

### Screen 5: Ready

Purpose:

- clearly communicate that the account is ready for the first transaction

Required UI:

- phone verified state
- shortened wallet address
- prefund transaction hash
- `Ready for first transaction` message

Primary CTA:

- `Khám phá sự kiện`

Secondary CTA:

- `Xem chi tiết ví`

Supporting surface:

- `WalletReadySheet`

This sheet can include:

- copy wallet address
- view prefund tx
- explain next steps

## Global Modal and Sheet Surfaces

The first implementation should include dedicated surfaces for:

- `WhyPhoneModal`
- `OtpHelpModal`
- `WhatIsThisWalletModal`
- `WhyInitialGasModal`
- `OtpExpiredModal`
- `RateLimitModal`
- `BootstrapFailedModal`
- `PrefundRetrySheet`
- `WalletReadySheet`

These should reuse the existing web UI primitives and follow the same visual system as the refreshed `Home/Discover` work:

- dark surfaces
- strong typography
- operational trust-first status blocks
- restrained accent usage

## State Model

The onboarding route should explicitly model these states:

- `phone_entered`
- `otp_requested`
- `otp_verifying`
- `otp_verified`
- `wallet_generating`
- `wallet_registering`
- `prefund_pending`
- `prefund_confirmed`
- `ready`

This state machine should drive both page content and modal availability.

## Refresh and Resume Behavior

The flow should not collapse if the user refreshes during onboarding.

Expected resume behavior:

- after OTP request: user may resume OTP entry if request is still valid
- after OTP verification: wallet generation or bootstrap can resume without restarting auth
- after wallet registration: prefund polling can resume using the stored wallet address and auth context
- if prefund is already done: user should jump directly to `ready`

## Error Handling

### OTP Errors

- invalid OTP
- expired OTP
- request rate limit exceeded

The user should always understand whether they can:

- retry OTP entry
- resend OTP
- wait for cooldown

### Wallet/Bootstrap Errors

- wallet generation failed locally
- wallet registration failed at backend
- wallet already registered
- wallet already prefunded

These states should be explicit and idempotent, not ambiguous.

### Prefund Errors

- prefund transaction not submitted
- prefund submitted but confirmation delayed
- prefund polling failed due to network or backend issues

The user should not be forced back to step 1 for later-stage technical errors.

## Technical Boundaries

### `entr-landing`

Must not own:

- auth logic
- OTP logic
- wallet bootstrap logic
- chain polling

It only owns:

- acquisition
- trust framing
- CTA handoff

### `apps/web`

Owns:

- onboarding UI
- local wallet generation
- auth + bootstrap orchestration
- prefund polling UX

### `auth-service`

Owns:

- OTP request
- OTP verify
- auth/session responses

### `payment-orchestrator`

Owns:

- register wallet
- prefund once
- prefund persistence
- prefund status lookup

## Testing Requirements

### Happy Path

The full path must succeed:

1. enter real phone number
2. request OTP
3. verify using dev OTP returned by backend
4. create local wallet
5. register wallet with backend
6. send initial prefund on localchain
7. poll until confirmed
8. display ready state

### Idempotency

The system must prove:

- wallet registration can be retried safely
- prefund is only sent once per wallet
- repeated visits after completion do not send another prefund

### UI Verification

Verify:

- desktop browser flow
- mobile browser widths
- refresh mid-flow
- modal/sheet behavior
- long prefund wait state
- retry state
- ready state

### Integration Verification

There should be both:

- direct API/script validation for debugging
- user-facing UI flow validation in `apps/web`

## Success Criteria

The work is successful if:

- the user can complete Flow 0 end-to-end in `apps/web`
- the phone number is real, but OTP remains dev-delivered
- wallet bootstrap and prefund happen against the local dev chain
- prefund is confirmed before the UI declares readiness
- the landing page and onboarding route feel like one coherent product journey
- the landing page still remains primarily a mobile app acquisition surface

## Rollout Boundaries

In this phase:

- implement onboarding UI in `apps/web`
- update landing copy and CTAs in `entr-landing`
- connect real backend/localchain behavior for Flow 0

Out of scope:

- real SMS provider
- mobile app onboarding
- Flow 1 purchase
- recovery flows
- broader auth hardening

## Recommended Rollout Order

1. Update landing CTA and copy for correct handoff.
2. Build the onboarding route and UI state machine in `apps/web`.
3. Connect OTP request and verify to `auth-service`.
4. Connect wallet registration and prefund status to `payment-orchestrator`.
5. Verify idempotent localchain prefund behavior.
6. Polish modal/sheet/error states and resume behavior.
