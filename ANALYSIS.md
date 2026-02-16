# Ticket Platform - Analysis Document

> **Project**: Blockchain-Based Event Ticketing Platform
> **Version**: 1.0
> **Last Updated**: 2026-01-15
> **Status**: Analysis Phase
> **Prerequisites**: [REQUIREMENTS.md](./REQUIREMENTS.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [Use Cases & User Stories](#use-cases--user-stories)
4. [Third-Party Integration Analysis](#third-party-integration-analysis)
5. [API Contract Overview](#api-contract-overview)
6. [MVP Prioritization](#mvp-prioritization)
7. [Risk Register](#risk-register)
8. [Technical Feasibility](#technical-feasibility)
9. [Gap Analysis](#gap-analysis)
10. [Next Steps](#next-steps)

---

## Executive Summary

### Purpose
This document analyzes the requirements from Phase 1 (Requirements Gathering) to:
- Validate technical feasibility
- Identify gaps and risks
- Define data models and relationships
- Prioritize features for MVP
- Evaluate third-party integrations

### Key Findings

| Area | Status | Notes |
|------|--------|-------|
| Core Requirements | Complete | All 7 major flows defined |
| Entity Model | Defined | 15 core entities identified |
| Third-Party Dependencies | 5 critical | Wallet, Payment, eKYC, SMS, Blockchain |
| MVP Scope | Defined | 12 must-have, 8 nice-to-have features |
| High Risks | 3 identified | Regulatory, Wallet Provider, Payment Integration |

### Recommendation
Proceed to Design Phase with identified risks mitigated through:
1. Early proof-of-concept for wallet integration
2. Legal review for NFT/crypto regulations in Vietnam
3. Payment gateway sandbox testing

---

## Entity Relationship Diagram

### Core Entities Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY OVERVIEW                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USERS & AUTH           EVENTS & TICKETS         TRANSACTIONS               │
│  ┌──────────┐           ┌──────────┐             ┌──────────┐              │
│  │  User    │           │  Event   │             │ Payment  │              │
│  ├──────────┤           ├──────────┤             ├──────────┤              │
│  │  Device  │           │  Ticket  │             │ Refund   │              │
│  ├──────────┤           ├──────────┤             ├──────────┤              │
│  │  Wallet  │           │ TicketType│            │ Escrow   │              │
│  ├──────────┤           └──────────┘             └──────────┘              │
│  │   KYC    │                                                               │
│  └──────────┘           MARKETPLACE              SUPPORT                    │
│                         ┌──────────┐             ┌──────────┐              │
│  ORGANIZERS             │ Listing  │             │ Dispute  │              │
│  ┌──────────┐           ├──────────┤             ├──────────┤              │
│  │Organizer │           │ Purchase │             │ Message  │              │
│  ├──────────┤           └──────────┘             ├──────────┤              │
│  │  Venue   │                                    │ Credit   │              │
│  └──────────┘           CHECK-IN                 └──────────┘              │
│                         ┌──────────┐                                        │
│                         │ CheckIn  │                                        │
│                         ├──────────┤                                        │
│                         │   Gate   │                                        │
│                         └──────────┘                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                    ERD                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │  ORGANIZER  │
                                    ├─────────────┤
                                    │ id          │
                                    │ name        │
                                    │ email       │
                                    │ wallet_addr │
                                    │ verified    │
                                    └──────┬──────┘
                                           │
                                           │ 1:N (creates)
                                           ▼
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│    USER     │                    │    EVENT    │                    │    VENUE    │
├─────────────┤                    ├─────────────┤                    ├─────────────┤
│ id          │                    │ id          │◄───────────────────│ id          │
│ phone       │                    │ organizer_id│    N:1 (held at)   │ name        │
│ email       │                    │ venue_id    │                    │ address     │
│ name        │                    │ title       │                    │ capacity    │
│ wallet_addr │                    │ description │                    │ city        │
│ is_frozen   │                    │ start_date  │                    └─────────────┘
│ kyc_status  │                    │ end_date    │
└──────┬──────┘                    │ status      │
       │                           │ max_tickets │
       │                           └──────┬──────┘
       │                                  │
       │                                  │ 1:N (has)
       │                                  ▼
       │                           ┌─────────────┐
       │                           │ TICKET_TYPE │
       │                           ├─────────────┤
       │                           │ id          │
       │                           │ event_id    │
       │                           │ name        │
       │                           │ price       │
       │                           │ quantity    │
       │                           │ sold_count  │
       │                           └──────┬──────┘
       │                                  │
       │ 1:N (owns)                       │ 1:N (instances)
       │                                  ▼
       │                           ┌─────────────┐
       └──────────────────────────▶│   TICKET    │◄─────────────────┐
                                   ├─────────────┤                  │
                                   │ token_id    │ (PK, NFT ID)     │
                                   │ event_id    │                  │
                                   │ ticket_type │                  │
                                   │ owner_id    │                  │
                                   │ owner_addr  │                  │
                                   │ seat_info   │                  │
                                   │ original_px │                  │
                                   │ is_used     │                  │
                                   │ used_at     │                  │
                                   │ status      │                  │
                                   └──────┬──────┘                  │
                                          │                         │
              ┌───────────────────────────┼─────────────────────────┤
              │                           │                         │
              │ 1:N                       │ 1:1                     │ 1:N
              ▼                           ▼                         │
       ┌─────────────┐             ┌─────────────┐                  │
       │   LISTING   │             │  CHECK_IN   │                  │
       ├─────────────┤             ├─────────────┤                  │
       │ id          │             │ id          │                  │
       │ ticket_id   │             │ ticket_id   │                  │
       │ seller_id   │             │ gate_id     │                  │
       │ price       │             │ scanned_at  │                  │
       │ status      │             │ staff_id    │                  │
       │ created_at  │             │ qr_nonce    │                  │
       │ expires_at  │             └─────────────┘                  │
       └──────┬──────┘                    ▲                         │
              │                           │                         │
              │ 1:1                       │ N:1                     │
              ▼                           │                         │
       ┌─────────────┐             ┌─────────────┐                  │
       │  PURCHASE   │             │    GATE     │                  │
       ├─────────────┤             ├─────────────┤                  │
       │ id          │             │ id          │                  │
       │ listing_id  │             │ event_id    │                  │
       │ buyer_id    │             │ name        │                  │
       │ payment_id  │             │ location    │                  │
       │ status      │             └─────────────┘                  │
       │ completed_at│                                              │
       └─────────────┘                                              │
                                                                    │
┌─────────────┐       ┌─────────────┐       ┌─────────────┐        │
│   PAYMENT   │       │   REFUND    │       │   ESCROW    │        │
├─────────────┤       ├─────────────┤       ├─────────────┤        │
│ id          │       │ id          │       │ id          │        │
│ user_id     │──────▶│ payment_id  │       │ listing_id  │        │
│ ticket_id   │───────│ ticket_id   │───────│ buyer_id    │────────┘
│ amount      │       │ amount      │       │ amount      │
│ method      │       │ status      │       │ status      │
│ gateway_ref │       │ processed_at│       │ released_at │
│ status      │       └─────────────┘       └─────────────┘
│ confirmed_at│
└─────────────┘


┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   DISPUTE   │       │DISPUTE_MSG  │       │GOODWILL_CREDIT│
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │◄──────│ dispute_id  │       │ id          │
│ filed_by    │       │ sender_type │       │ user_id     │
│ ticket_id   │       │ message     │       │ dispute_id  │
│ category    │       │ created_at  │       │ amount      │
│ status      │       └─────────────┘       │ expires_at  │
│ current_tier│                             └─────────────┘
│ resolution  │
└─────────────┘


┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   DEVICE    │       │   WALLET    │       │  KYC_RECORD │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ user_id     │       │ user_id     │       │ user_id     │
│ fingerprint │       │ address     │       │ provider    │
│ device_name │       │ provider    │       │ status      │
│ is_current  │       │ created_at  │       │ verified_at │
│ revoked_at  │       └─────────────┘       │ cccd_number │
└─────────────┘                             └─────────────┘


┌─────────────┐
│  RECOVERY   │
├─────────────┤
│ id          │
│ user_id     │
│ type        │
│ status      │
│ hold_expires│
│ new_device  │
└─────────────┘
```

### Entity Definitions

#### 1. User Domain

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **User** | Platform user (buyer/seller) | phone, email, wallet_address, kyc_status, is_frozen |
| **Device** | User's registered devices | fingerprint, device_name, is_current, revoked_at |
| **Wallet** | Embedded wallet info | address, provider, created_at |
| **KYC_Record** | Identity verification | provider, status, verified_at, cccd_number |
| **Recovery** | Account recovery requests | type, status, hold_expires, new_device_fingerprint |

#### 2. Organizer Domain

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Organizer** | Event creators | name, email, wallet_address, verified, royalty_percent |
| **Venue** | Event locations | name, address, capacity, city |

#### 3. Event Domain

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Event** | Events/concerts | title, organizer_id, venue_id, start_date, status |
| **Ticket_Type** | Ticket categories | event_id, name, price, quantity, sold_count |
| **Ticket** | NFT ticket instance | token_id (NFT), owner_id, seat_info, is_used, status |

#### 4. Transaction Domain

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Payment** | VND payments | user_id, ticket_id, amount, method, gateway_ref, status |
| **Refund** | Refund records | payment_id, ticket_id, amount, status |
| **Escrow** | Resale escrow | listing_id, buyer_id, amount, status |

#### 5. Marketplace Domain

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Listing** | Resale listings | ticket_id, seller_id, price, status, expires_at |
| **Purchase** | Resale purchases | listing_id, buyer_id, payment_id, status |

#### 6. Check-in Domain

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Gate** | Event entry points | event_id, name, location |
| **Check_In** | Check-in records | ticket_id, gate_id, scanned_at, qr_nonce |

#### 7. Support Domain

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Dispute** | User disputes | filed_by, ticket_id, category, status, current_tier |
| **Dispute_Message** | Dispute thread | dispute_id, sender_type, message |
| **Goodwill_Credit** | Platform credits | user_id, amount, expires_at |

### Cardinality Summary

| Relationship | Cardinality | Description |
|--------------|-------------|-------------|
| User → Ticket | 1:N | User owns many tickets |
| User → Device | 1:N | User has many devices |
| User → Wallet | 1:1 | User has one wallet |
| Organizer → Event | 1:N | Organizer creates many events |
| Event → Ticket_Type | 1:N | Event has many ticket types |
| Ticket_Type → Ticket | 1:N | Type has many instances |
| Ticket → Listing | 1:N | Ticket can be listed multiple times (over time) |
| Listing → Purchase | 1:1 | One purchase per listing |
| Ticket → Check_In | 1:1 | Ticket checked in once |
| Event → Gate | 1:N | Event has many gates |
| User → Dispute | 1:N | User can file many disputes |

---

## Use Cases & User Stories

### Actor Definitions

| Actor | Description |
|-------|-------------|
| **Buyer** | End user purchasing/owning tickets |
| **Seller** | User listing tickets for resale |
| **Organizer** | Event creator and manager |
| **Staff** | Gate/venue staff for check-in |
| **Support Agent** | Customer support team |
| **System** | Automated platform processes |

### Use Case Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USE CASES                                       │
└─────────────────────────────────────────────────────────────────────────────┘

  BUYER                           SYSTEM                          ORGANIZER
    │                               │                                │
    ├── UC01: Register Account      │                                │
    ├── UC02: Browse Events         │                                │
    ├── UC03: Purchase Ticket ──────┼── UC-S1: Mint NFT              │
    ├── UC04: View My Tickets       │                                │
    ├── UC05: List for Resale ──────┼── UC-S2: Lock NFT              │
    ├── UC06: Buy Resale Ticket ────┼── UC-S3: Transfer NFT          │
    ├── UC07: Check-in at Event ────┼── UC-S4: Verify & Mark Used    │
    ├── UC08: Request Refund        │                                │
    ├── UC09: File Dispute          │                                │
    ├── UC10: Recover Account       │                                │
    │                               │                                │
    │                               │                                ├── UC20: Create Event
    │                               │                                ├── UC21: Manage Tickets
    │                               │                                ├── UC22: View Sales
    │                               │                                ├── UC23: Cancel Event
    │                               │                                ├── UC24: View Royalties
    │                               │                                │
  SELLER                          STAFF                         SUPPORT
    │                               │                                │
    ├── UC05: List for Resale       ├── UC30: Scan QR                ├── UC40: Review Dispute
    ├── UC11: Cancel Listing        ├── UC31: Manual Entry           ├── UC41: Issue Refund
    ├── UC12: View Sales History    │                                ├── UC42: Freeze Account
    │                               │                                ├── UC43: Process Recovery
```

### Detailed User Stories

#### Epic 1: User Registration & Wallet

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-1.1 | As a buyer, I want to register with my phone number so I can start using the platform | - OTP sent within 30s<br>- Wallet created invisibly<br>- Profile creation after OTP | Must |
| US-1.2 | As a buyer, I want to add my email for account recovery | - Email verification OTP<br>- Shown during onboarding | Should |
| US-1.3 | As a user, I want to complete KYC so I can sell tickets | - CCCD photo upload<br>- Face match verification<br>- Result within 2 minutes | Must |
| US-1.4 | As a user, I want to recover my account on a new device | - Phone OTP verification<br>- 48-hour hold for security<br>- Email alert sent | Must |

#### Epic 2: Event Discovery & Purchase

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-2.1 | As a buyer, I want to browse upcoming events | - Filter by date, location, category<br>- Search by name<br>- See availability status | Must |
| US-2.2 | As a buyer, I want to view event details | - Title, date, venue, description<br>- Ticket types and prices<br>- Availability count | Must |
| US-2.3 | As a buyer, I want to select tickets and checkout | - Choose ticket type and quantity (max 4)<br>- 15-minute reservation timer<br>- Multiple payment options | Must |
| US-2.4 | As a buyer, I want to pay via Momo/Bank | - Redirect to payment app<br>- Auto-return on completion<br>- Confirmation notification | Must |
| US-2.5 | As a buyer, I want to receive my NFT ticket | - Ticket visible in "My Tickets" within 1 minute<br>- Push notification sent<br>- QR accessible | Must |

#### Epic 3: Resale Marketplace

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-3.1 | As a seller, I want to list my ticket for resale | - KYC required<br>- Set price (max 120% of original)<br>- Biometric confirmation<br>- NFT locked in escrow | Must |
| US-3.2 | As a buyer, I want to browse resale listings | - Filter by event<br>- See original vs resale price<br>- Seller rating (v2) | Must |
| US-3.3 | As a buyer, I want to purchase a resale ticket | - Pay via Momo/Bank<br>- NFT transferred to me<br>- Seller receives payment minus fees | Must |
| US-3.4 | As a seller, I want to cancel my listing | - Cancel before purchase<br>- NFT returned to my wallet<br>- No fees charged | Should |
| US-3.5 | As a seller, I want to see my sale proceeds | - Amount after 10% fees<br>- Payment timeline<br>- Transaction history | Must |

#### Epic 4: Event Check-in

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-4.1 | As a buyer, I want to display my QR for check-in | - Biometric to open QR screen<br>- QR rotates every 3 seconds<br>- Screenshot blocked | Must |
| US-4.2 | As staff, I want to scan attendee QR codes | - Camera-based scanner<br>- Green/red result within 1 second<br>- Show seat info on success | Must |
| US-4.3 | As staff, I want to see why a scan failed | - Clear error message (expired, used, wrong event, etc.)<br>- Suggest next steps | Must |
| US-4.4 | As a buyer, I want assurance only I can use my ticket | - Cryptographic signature verification<br>- Atomic check-in (first scan wins) | Must |

#### Epic 5: Refunds & Cancellations

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-5.1 | As an organizer, I want to cancel my event | - All tickets become refundable<br>- Active listings cancelled<br>- Ticket holders notified | Must |
| US-5.2 | As a buyer, I want to request a refund for a cancelled event | - Tap "Request Refund" on ticket<br>- Confirm payment method<br>- Refund processed within 14 days | Must |
| US-5.3 | As a buyer (resale), I want to know my refund amount | - Original price only (not premium paid)<br>- Clear message before purchase | Must |
| US-5.4 | As a buyer, I want to keep my ticket for a postponed event | - Ticket valid for new date<br>- Option to request refund within 7 days | Should |

#### Epic 6: Dispute Resolution

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-6.1 | As a buyer, I want to file a dispute | - Select category and describe issue<br>- Upload evidence<br>- Receive case ID and timeline | Must |
| US-6.2 | As a buyer, I want my dispute auto-resolved if possible | - Clear-cut cases resolved instantly<br>- Notification of resolution | Should |
| US-6.3 | As a buyer, I want to escalate unresolved disputes | - Request escalation<br>- Higher tier review within SLA | Should |
| US-6.4 | As support, I want to review dispute evidence | - Blockchain records<br>- Payment gateway data<br>- Platform logs | Must |

#### Epic 7: Organizer Management

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-7.1 | As an organizer, I want to create an event | - Enter event details<br>- Set ticket types and prices<br>- Upload images<br>- Publish | Must |
| US-7.2 | As an organizer, I want to track ticket sales | - Real-time sales dashboard<br>- Revenue by ticket type<br>- Buyer demographics (v2) | Must |
| US-7.3 | As an organizer, I want to receive my royalties | - 5% of resale transactions<br>- Visible in dashboard<br>- Weekly payout | Must |
| US-7.4 | As an organizer, I want to manage check-in | - Add gates and staff<br>- View check-in progress<br>- Real-time attendance count | Should |

### Use Case Flow: Purchase Ticket (UC03)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UC03: PURCHASE TICKET - FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

BUYER                          SYSTEM                         PAYMENT GATEWAY
  │                              │                                   │
  │  1. Select event             │                                   │
  ├─────────────────────────────▶│                                   │
  │                              │                                   │
  │  2. Choose ticket type/qty   │                                   │
  ├─────────────────────────────▶│                                   │
  │                              │                                   │
  │                              │  3. Check availability            │
  │                              ├──┐                                │
  │                              │  │                                │
  │                              │◀─┘                                │
  │                              │                                   │
  │                              │  4. Reserve tickets (15 min)      │
  │                              ├──┐                                │
  │                              │  │                                │
  │                              │◀─┘                                │
  │                              │                                   │
  │  5. Confirm order            │                                   │
  │◀─────────────────────────────┤                                   │
  │                              │                                   │
  │  6. Select payment method    │                                   │
  ├─────────────────────────────▶│                                   │
  │                              │                                   │
  │                              │  7. Create payment request        │
  │                              ├──────────────────────────────────▶│
  │                              │                                   │
  │  8. Redirect to payment app  │                                   │
  │◀─────────────────────────────┼───────────────────────────────────┤
  │                              │                                   │
  │  9. Complete payment         │                                   │
  ├──────────────────────────────┼──────────────────────────────────▶│
  │                              │                                   │
  │                              │  10. Webhook: Payment confirmed   │
  │                              │◀──────────────────────────────────┤
  │                              │                                   │
  │                              │  11. Mint NFT to user wallet      │
  │                              ├──┐                                │
  │                              │  │ (Blockchain)                   │
  │                              │◀─┘                                │
  │                              │                                   │
  │                              │  12. Update ticket status         │
  │                              ├──┐                                │
  │                              │  │                                │
  │                              │◀─┘                                │
  │                              │                                   │
  │  13. Push notification       │                                   │
  │◀─────────────────────────────┤                                   │
  │                              │                                   │
  │  14. View ticket in app      │                                   │
  ├─────────────────────────────▶│                                   │
  │                              │                                   │
  ▼                              ▼                                   ▼
```

### Use Case Flow: Check-in (UC07)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    UC07: CHECK-IN - FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

BUYER (Mobile App)             STAFF (Scanner)                 BACKEND
  │                              │                                │
  │  1. Open ticket screen       │                                │
  ├──────┐                       │                                │
  │      │ Biometric auth        │                                │
  │◀─────┘                       │                                │
  │                              │                                │
  │  2. Start signing session    │                                │
  ├──────────────────────────────┼───────────────────────────────▶│
  │                              │                                │
  │  3. Generate QR (every 3s)   │                                │
  ├──────┐                       │                                │
  │      │ Sign: tokenId +       │                                │
  │      │ timestamp + nonce     │                                │
  │◀─────┘                       │                                │
  │                              │                                │
  │  4. Display rotating QR      │                                │
  │◀─────────────────────────────┤ 5. Scan QR                     │
  │                              ├───────────────────────────────▶│
  │                              │                                │
  │                              │                    6. Verify:  │
  │                              │                    - Timestamp │
  │                              │                    - Signature │
  │                              │                    - Ownership │
  │                              │                    - Not used  │
  │                              │                                │
  │                              │                    7. Atomic   │
  │                              │                    UPDATE      │
  │                              │                    (mark used) │
  │                              │                                │
  │                              │  8. Response (valid/invalid)   │
  │                              │◀───────────────────────────────┤
  │                              │                                │
  │                              │  9. Show result + seat info    │
  │                              ├──────┐                         │
  │                              │      │                         │
  │                              │◀─────┘                         │
  │                              │                                │
  │                              │                    10. Queue   │
  │                              │                    blockchain  │
  │                              │                    update      │
  │                              │                                │
  ▼                              ▼                                ▼
```

---

## Third-Party Integration Analysis

### Integration Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THIRD-PARTY INTEGRATIONS                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   MOBILE APP    │
                              │  (React Native) │
                              └────────┬────────┘
                                       │
                              ┌────────▼────────┐
                              │    BACKEND      │
                              │    (Node.js)    │
                              └────────┬────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
        ▼              ▼               ▼               ▼              ▼
┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐┌──────────────┐
│   WALLET     ││   PAYMENT    ││    eKYC      ││   SMS/PUSH   ││  BLOCKCHAIN  │
│   PROVIDER   ││   GATEWAY    ││   PROVIDER   ││   PROVIDER   ││   (Base L2)  │
├──────────────┤├──────────────┤├──────────────┤├──────────────┤├──────────────┤
│ • Privy      ││ • Momo       ││ • VNPT eKYC  ││ • Twilio     ││ • Base RPC   │
│ • Dynamic    ││ • VNPAY      ││ • FPT.AI     ││ • Firebase   ││ • Infura     │
│ • Thirdweb   ││ • ZaloPay    ││ • Zalo eKYC  ││ • AWS SNS    ││ • Alchemy    │
└──────────────┘└──────────────┘└──────────────┘└──────────────┘└──────────────┘
```

### 1. Embedded Wallet Provider Comparison

| Criteria | Privy | Dynamic | Thirdweb |
|----------|-------|---------|----------|
| **ERC-4337 Support** | Yes | Yes | Yes |
| **MPC Recovery** | Yes (2-of-3) | Yes | Yes |
| **Phone Auth** | Yes | Yes | Limited |
| **React Native SDK** | Yes | Yes | Yes |
| **Paymaster Integration** | Built-in | Built-in | Built-in |
| **Pricing (MVP)** | Free tier: 1K MAU | Free tier: 500 MAU | Free tier: 1K wallets |
| **Pricing (Scale)** | $0.05/MAU | $0.10/MAU | $0.03/wallet |
| **Vietnam Support** | Global | Global | Global |
| **Key Export** | Yes | Yes | Yes |
| **Documentation** | Excellent | Good | Good |
| **Community** | Large | Medium | Large |

**Recommendation: Privy**
- Best phone auth support (critical for Vietnam market)
- Generous free tier for MVP
- Strong documentation and support
- Built-in paymaster with Base L2

### 2. Payment Gateway Comparison

| Criteria | Momo | VNPAY | ZaloPay |
|----------|------|-------|---------|
| **Market Share (VN)** | ~40% | ~30% | ~15% |
| **Webhook Support** | Yes | Yes | Yes |
| **Sandbox Environment** | Yes | Yes | Yes |
| **Integration Complexity** | Medium | Medium | Easy |
| **Settlement Time** | T+1 | T+1 to T+3 | T+1 |
| **Transaction Fee** | 1-1.5% | 1-2% | 1-1.5% |
| **Bank Transfer Support** | Yes | Yes | Limited |
| **QR Pay** | Yes | Yes | Yes |
| **API Documentation** | Good | Fair | Good |
| **Refund API** | Yes | Yes | Yes |

**Recommendation: Momo (Primary) + VNPAY (Secondary)**
- Momo has highest market share
- VNPAY for bank transfer preference
- Both support webhooks for immediate confirmation

### 3. eKYC Provider Comparison

| Criteria | VNPT eKYC | FPT.AI | Zalo eKYC |
|----------|-----------|--------|-----------|
| **CCCD Recognition** | Excellent | Good | Good |
| **Face Match Accuracy** | 99.5% | 98% | 97% |
| **Liveness Detection** | Yes | Yes | Yes |
| **Response Time** | <3s | <5s | <3s |
| **Pricing (per verify)** | ~5,000 VND | ~3,000 VND | ~4,000 VND |
| **Free Tier** | 100/month | 500/month | 200/month |
| **VNeID Integration** | Planned | No | No |
| **API Stability** | High | Medium | High |
| **Compliance** | Full | Full | Full |

**Recommendation: FPT.AI (MVP) → VNPT (Scale)**
- FPT.AI has best free tier for MVP testing
- VNPT for production (higher accuracy, VNeID roadmap)

### 4. SMS/Push Notification Comparison

| Criteria | Twilio | Firebase | AWS SNS |
|----------|--------|----------|---------|
| **SMS to Vietnam** | Yes | No | Yes |
| **SMS Cost** | ~1,200 VND/msg | N/A | ~800 VND/msg |
| **Push (iOS/Android)** | Yes | Yes | Yes |
| **Push Cost** | $0.01/1K | Free | $0.50/1M |
| **Delivery Reports** | Yes | Yes | Yes |
| **Sender ID (VN)** | Supported | N/A | Supported |
| **React Native SDK** | Community | Official | Community |

**Recommendation: Firebase (Push) + AWS SNS (SMS)**
- Firebase for push: free, reliable, official RN support
- AWS SNS for SMS: lower cost for Vietnam

### 5. Blockchain RPC Provider Comparison

| Criteria | Base Public RPC | Infura | Alchemy |
|----------|-----------------|--------|---------|
| **Cost** | Free | Free tier + paid | Free tier + paid |
| **Rate Limit (Free)** | Shared | 100K req/day | 300M CU/month |
| **Reliability** | Good | Excellent | Excellent |
| **Base L2 Support** | Native | Yes | Yes |
| **Webhook (Events)** | No | No | Yes |
| **Archive Data** | No | Yes (paid) | Yes |

**Recommendation: Alchemy**
- Best free tier
- Event webhooks for blockchain monitoring
- Excellent reliability

### Integration Risk Matrix

| Integration | Risk Level | Mitigation |
|-------------|------------|------------|
| Wallet Provider | Medium | Abstract provider interface; enable switching |
| Payment Gateway | High | Dual integration (Momo + VNPAY) |
| eKYC | Low | Standard API; easy to switch |
| SMS/Push | Low | Standard services; easy to switch |
| Blockchain RPC | Low | Multiple fallback RPCs |

---

## API Contract Overview

### API Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API ARCHITECTURE                                   │
└─────────────────────────────────────────────────────────────────────────────┘

                                 MOBILE APP
                                     │
                                     │ HTTPS/REST + WebSocket
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                     │
│                         (Rate Limiting, Auth)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        ▼                            ▼                            ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   AUTH API    │           │   CORE API    │           │  WEBHOOK API  │
│               │           │               │           │               │
│ /auth/*       │           │ /events/*     │           │ /webhooks/*   │
│ /users/*      │           │ /tickets/*    │           │               │
│ /kyc/*        │           │ /marketplace/*│           │ (Momo, VNPAY) │
│ /recovery/*   │           │ /checkin/*    │           │               │
│               │           │ /disputes/*   │           │               │
└───────────────┘           └───────────────┘           └───────────────┘
```

### API Endpoints Summary

#### Authentication & Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/otp/request` | Request OTP for phone |
| POST | `/auth/otp/verify` | Verify OTP and create session |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/users/me` | Get current user profile |
| PUT | `/users/me` | Update user profile |
| POST | `/users/me/email` | Add/verify email |
| GET | `/users/me/devices` | List user devices |
| DELETE | `/users/me/devices/:id` | Revoke device |

#### KYC

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/kyc/initiate` | Start KYC process |
| POST | `/kyc/upload` | Upload CCCD images |
| POST | `/kyc/face-match` | Submit face verification |
| GET | `/kyc/status` | Check KYC status |

#### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | List events (with filters) |
| GET | `/events/:id` | Get event details |
| GET | `/events/:id/ticket-types` | Get available ticket types |
| GET | `/events/:id/availability` | Check real-time availability |

#### Tickets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tickets/reserve` | Reserve tickets (15 min) |
| POST | `/tickets/purchase` | Initiate payment |
| GET | `/tickets/me` | List user's tickets |
| GET | `/tickets/:tokenId` | Get ticket details |
| POST | `/tickets/:tokenId/qr` | Generate check-in QR data |

#### Marketplace

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/marketplace/listings` | Browse resale listings |
| POST | `/marketplace/listings` | Create listing (requires KYC) |
| DELETE | `/marketplace/listings/:id` | Cancel listing |
| POST | `/marketplace/listings/:id/purchase` | Buy resale ticket |
| GET | `/marketplace/me/sales` | Seller's sales history |

#### Check-in (Staff)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checkin/verify` | Verify and check-in ticket |
| GET | `/checkin/events/:id/stats` | Check-in statistics |
| GET | `/checkin/events/:id/gates` | List event gates |

#### Disputes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/disputes` | File new dispute |
| GET | `/disputes/me` | List user's disputes |
| GET | `/disputes/:id` | Get dispute details |
| POST | `/disputes/:id/messages` | Add message to dispute |
| POST | `/disputes/:id/escalate` | Request escalation |

#### Recovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recovery/initiate` | Start account recovery |
| POST | `/recovery/verify` | Verify identity for recovery |
| GET | `/recovery/:id/status` | Check recovery status |
| POST | `/recovery/:id/cancel` | Cancel recovery (by owner) |

#### Webhooks (Internal)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/webhooks/momo` | Momo payment confirmation |
| POST | `/webhooks/vnpay` | VNPAY payment confirmation |
| POST | `/webhooks/blockchain` | Blockchain event notifications |

### Sample API Contracts

#### POST `/auth/otp/request`

```json
// Request
{
  "phone": "+84901234567"
}

// Response (200)
{
  "success": true,
  "data": {
    "requestId": "req_abc123",
    "expiresIn": 300,
    "retryAfter": 60
  }
}
```

#### POST `/tickets/reserve`

```json
// Request
{
  "eventId": "evt_123",
  "ticketTypeId": "tt_456",
  "quantity": 2
}

// Response (200)
{
  "success": true,
  "data": {
    "reservationId": "res_789",
    "tickets": [
      { "ticketTypeId": "tt_456", "seatInfo": "GA-001" },
      { "ticketTypeId": "tt_456", "seatInfo": "GA-002" }
    ],
    "totalAmount": 2000000,
    "expiresAt": "2026-01-15T10:30:00Z"
  }
}
```

#### POST `/checkin/verify`

```json
// Request
{
  "qrData": {
    "tokenId": 12345,
    "eventId": "evt_123",
    "timestamp": 1736956800000,
    "nonce": "a1b2c3d4-e5f6",
    "walletAddress": "0xABC...",
    "signature": "0x1a2b3c..."
  },
  "gateId": "gate_001"
}

// Response (200 - Valid)
{
  "success": true,
  "data": {
    "valid": true,
    "ticketId": 12345,
    "seatInfo": "Section A, Row 5, Seat 12",
    "holderName": "Nguyen Van A"
  }
}

// Response (200 - Invalid)
{
  "success": true,
  "data": {
    "valid": false,
    "reason": "ALREADY_USED",
    "message": "This ticket was checked in at Gate 2 at 19:32"
  }
}
```

---

## MVP Prioritization

### MoSCoW Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MVP PRIORITIZATION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

MUST HAVE (MVP Phase 1)              SHOULD HAVE (MVP Phase 1+)
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ • Phone registration        │      │ • Email backup for recovery │
│ • Invisible wallet creation │      │ • Push notifications        │
│ • Event browsing            │      │ • Seller ratings            │
│ • Ticket purchase (Momo)    │      │ • Event search              │
│ • NFT minting               │      │ • Ticket transfer (gift)    │
│ • View my tickets           │      │ • Organizer dashboard       │
│ • Resale listing (KYC req)  │      │ • Check-in statistics       │
│ • Resale purchase           │      │                             │
│ • QR check-in (rotating)    │      │                             │
│ • Basic refund (cancel)     │      │                             │
│ • Account recovery          │      │                             │
│ • Basic dispute filing      │      │                             │
└─────────────────────────────┘      └─────────────────────────────┘

COULD HAVE (Phase 2)                 WON'T HAVE (Phase 3+)
┌─────────────────────────────┐      ┌─────────────────────────────┐
│ • VNPAY integration         │      │ • USDT payment (crypto)     │
│ • VNeID integration         │      │ • Collectible NFTs          │
│ • External arbitration      │      │ • Social features           │
│ • Multi-day event support   │      │ • Auction-style resale      │
│ • Seat selection            │      │ • Loyalty program           │
│ • Waitlist for sold-out     │      │ • White-label for organizers│
│ • Partial refunds           │      │ • International expansion   │
│ • SMS notifications         │      │ • Multi-language            │
└─────────────────────────────┘      └─────────────────────────────┘
```

### MVP Feature Breakdown

#### Phase 1: Core MVP (Must Have)

| Feature | Complexity | Dependencies | Notes |
|---------|------------|--------------|-------|
| Phone registration + wallet | High | Privy SDK | Critical path |
| Event listing/browsing | Low | Backend + DB | Static for MVP |
| Ticket purchase flow | High | Momo API, Blockchain | Critical path |
| NFT minting | Medium | Smart contracts | After payment |
| My Tickets view | Low | Backend | Query owned NFTs |
| Resale listing | Medium | KYC, Smart contracts | Price cap enforced |
| Resale purchase | High | Escrow, NFT transfer | Critical for marketplace |
| QR check-in | High | Signature verification | Security critical |
| Event cancellation/refund | Medium | Refund API | Basic flow |
| Account recovery | Medium | 48-hour hold logic | Security critical |
| Dispute filing | Low | Database | Tier 1 auto only |

#### Phase 1+ (Should Have, if time permits)

| Feature | Complexity | Dependencies |
|---------|------------|--------------|
| Email backup | Low | Email service |
| Push notifications | Low | Firebase |
| Event search | Low | Search index |
| Ticket transfer (gift) | Medium | NFT transfer |

### Development Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPMENT ROADMAP                                   │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: FOUNDATION (Weeks 1-4)
├── Week 1-2: Infrastructure
│   ├── Project setup (React Native, Node.js, PostgreSQL)
│   ├── Privy wallet integration
│   ├── Base L2 testnet setup
│   └── Smart contract development (TicketNFT, Marketplace)
│
├── Week 3-4: Core Flows
│   ├── User registration flow
│   ├── Event listing API
│   └── Basic UI scaffolding

PHASE 2: PURCHASE FLOW (Weeks 5-8)
├── Week 5-6: Payment Integration
│   ├── Momo sandbox integration
│   ├── Payment → Mint flow
│   └── Reservation timeout logic
│
├── Week 7-8: Ticket Management
│   ├── My Tickets screen
│   ├── QR generation (rotating)
│   └── Basic ticket details

PHASE 3: MARKETPLACE (Weeks 9-12)
├── Week 9-10: Resale Listing
│   ├── KYC integration (FPT.AI)
│   ├── Listing creation flow
│   └── Price cap enforcement
│
├── Week 11-12: Resale Purchase
│   ├── Escrow implementation
│   ├── NFT transfer logic
│   └── Fee distribution

PHASE 4: CHECK-IN & OPERATIONS (Weeks 13-16)
├── Week 13-14: Check-in System
│   ├── Staff scanner app
│   ├── Signature verification
│   └── Atomic check-in logic
│
├── Week 15-16: Operations
│   ├── Event cancellation
│   ├── Refund processing
│   ├── Account recovery
│   └── Basic dispute flow

PHASE 5: POLISH & LAUNCH (Weeks 17-20)
├── Week 17-18: Testing
│   ├── End-to-end testing
│   ├── Security audit
│   └── Performance testing
│
├── Week 19-20: Launch Prep
│   ├── Production deployment
│   ├── Momo production credentials
│   └── Soft launch with pilot event
```

---

## Risk Register

### Risk Assessment Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RISK ASSESSMENT MATRIX                               │
└─────────────────────────────────────────────────────────────────────────────┘

                        LIKELIHOOD
              Low          Medium         High
         ┌──────────┬──────────────┬──────────────┐
    High │    R5    │     R1       │              │
         │          │              │              │
IMPACT   ├──────────┼──────────────┼──────────────┤
  Medium │    R6    │   R2, R3     │     R4       │
         │          │              │              │
         ├──────────┼──────────────┼──────────────┤
    Low  │          │     R7       │              │
         │          │              │              │
         └──────────┴──────────────┴──────────────┘

R1: Regulatory/Legal Risk (HIGH PRIORITY)
R2: Wallet Provider Dependency
R3: Payment Gateway Integration
R4: Scalping/Bot Attacks
R5: Smart Contract Vulnerabilities
R6: Key Management Failure
R7: Third-party Service Outage
```

### Detailed Risk Register

| ID | Risk | Category | Impact | Likelihood | Score | Mitigation |
|----|------|----------|--------|------------|-------|------------|
| R1 | Vietnam regulations may restrict NFT/crypto for ticketing | Legal | High | Medium | **Critical** | Early legal consultation; structure as "digital collectibles"; avoid crypto terminology |
| R2 | Wallet provider (Privy) changes pricing or discontinues | Technical | Medium | Medium | **High** | Abstract wallet interface; maintain key export capability; evaluate alternatives |
| R3 | Momo/VNPAY integration delays or rejections | Integration | Medium | Medium | **High** | Start integration early; have VNPAY as backup; prepare manual fallback |
| R4 | Scalpers use bots to buy tickets faster than real users | Business | Medium | High | **High** | Rate limiting; CAPTCHA; queue system; phone verification; purchase limits |
| R5 | Smart contract bug leads to loss of funds or tickets | Technical | High | Low | **High** | Professional audit; testnet testing; gradual rollout; pause mechanism |
| R6 | Platform minter key compromised | Security | High | Low | **High** | Cloud KMS; multi-sig for admin; rate limits in contract; monitoring |
| R7 | eKYC provider outage during high-traffic event | Operational | Low | Medium | **Medium** | Cache verified status; allow 24hr grace period; backup provider |

### Risk Mitigation Details

#### R1: Regulatory Risk

```
CURRENT STATUS:
├── Vietnam Digital Industry Law (effective 1/1/2026) allows digital assets
├── NFTs for utility (ticketing) not explicitly regulated
├── Crypto payments remain restricted
└── Resolution 5/2025/NQ-CP provides sandbox opportunity

MITIGATION ACTIONS:
├── [ ] Engage legal counsel specializing in Vietnam fintech
├── [ ] Apply for regulatory sandbox if available
├── [ ] Frame NFTs as "digital tickets" not "crypto assets"
├── [ ] VND-only payments (no crypto in Phase 1)
├── [ ] Prepare compliance documentation
└── [ ] Monitor regulatory developments monthly

CONTINGENCY:
├── If NFTs restricted → Convert to traditional digital tickets with QR
├── If blockchain restricted → Keep ownership records off-chain
└── Modular architecture allows pivot without full rewrite
```

#### R4: Scalping/Bot Prevention

```
PREVENTION LAYERS:
├── Layer 1: Phone Verification
│   └── One account per phone number
│
├── Layer 2: Purchase Limits
│   └── Max 4 tickets per phone per event
│
├── Layer 3: Rate Limiting
│   └── API throttling per user/IP
│
├── Layer 4: CAPTCHA (if needed)
│   └── Invisible reCAPTCHA on purchase
│
├── Layer 5: Queue System (Phase 2)
│   └── Random queue position for high-demand events
│
└── Layer 6: KYC for Resale
    └── Can't profit from scalping without identity
```

#### R5: Smart Contract Security

```
SECURITY MEASURES:
├── Development
│   ├── Use OpenZeppelin battle-tested contracts
│   ├── Follow Solidity best practices
│   └── Comprehensive unit tests (>90% coverage)
│
├── Audit
│   ├── Internal review by senior devs
│   ├── External audit before mainnet (budget: $10-20K)
│   └── Bug bounty program post-launch
│
├── Deployment
│   ├── Testnet deployment for 4+ weeks
│   ├── Gradual mainnet rollout
│   └── Start with low-value events
│
└── Operations
    ├── Pause mechanism for emergencies
    ├── Upgrade proxy pattern (if justified)
    ├── Multi-sig for admin functions
    └── Real-time monitoring
```

---

## Security Threat Modeling

### Objectives

- Protect crown-jewel assets (custodied wallets, NFT supply, fiat escrow, KYC data).
- Identify realistic attacker goals mapped to STRIDE to guide control design and backlog.
- Align engineering, product, and ops on required monitoring, playbooks, and validation.

### Crown Jewels & Assets

| Asset | Why It Matters | Compromise Impact |
|-------|----------------|-------------------|
| Embedded ERC-4337 wallets + guardian keys | Control of users' ability to sign, transfer, and check in | Ticket theft at scale, loss of trust, regulatory exposure |
| NFT contracts (minting, marketplace, operator roles) | Source of ticket authenticity and resale enforcement | Infinite minting, bypass of resale caps, counterfeit tickets |
| Payment webhooks & VND escrow accounts | Trigger minting, release fiat to sellers | Double-spend, fraudulent payouts, accounting gaps |
| User PII/KYC artifacts (CCCD, biometrics) | Regulated identity data collected for eKYC | Privacy violations, fines, credential stuffing fuel |
| Check-in service + rotating QR signer | Determines venue access in real time | Gate crashing, denial of entry for legitimate fans |
| Admin/organizer portal + support tooling | Cancels events, issues refunds, overrides limits | Platform-wide disruption, intentional fraud |
| Recovery + freeze workflows | Last line of defense if device compromised | Adversary can hijack accounts permanently |

### Attack Surface Overview

| Entry Point | Potential Threat Agents | Notes |
|-------------|------------------------|-------|
| Mobile apps (buyer/seller) | Bot operators, malware on rooted devices | Protect OTP, biometric, embedded wallet SDK |
| Public APIs (auth, events, marketplace) | Botnets, abusive resellers, DDoS actors | Must enforce rate limits, anomaly detection |
| Payment integrations (Momo/VNPAY webhooks) | Network attackers, insider fraud | Require signature verification + idempotency |
| Blockchain interfaces (RPC, relayers, Paymaster) | Contract hackers, MEV bots | Monitor gas sponsorship and unusual ops |
| Admin portal / support tools | Rogue staff, phishing, credential reuse | Enforce SSO, MFA, least privilege, audit trails |
| Worker queues (mint, refund, recovery) | Logic bombs, replay attacks | Signed jobs + durable dedupe |
| Observability and logs | Sensitive data exposure | Redact PII, secure log sinks |

### STRIDE Analysis by Flow

#### A. Registration & Wallet Provisioning

| STRIDE | Threat | Attack Vector | Mitigations / Owners |
|--------|--------|---------------|----------------------|
| Spoofing | SIM-swap hijacks OTP | Telecom social engineering | Phone + email pairing, SIM-change risk scoring, notify legacy device |
| Tampering | Wallet key injection during provisioning | Man-in-the-middle on insecure device | TLS pinning, Privy attestation, device integrity attestation (SafetyNet/App Attest) |
| Repudiation | User denies consent to wallet creation | Lack of auditable logs | Signed registration receipts stored in append-only log |
| Information Disclosure | Intercepted OTP or wallet seed in transit | Compromised SMS aggregator or rooted OS | Use OTP via trusted provider, no seed exposure, consider push/voice fallback |
| Denial of Service | OTP brute force to lock new accounts | Automated OTP requests | Adaptive rate limit by IP/device, CAPTCHA after 3 failures, dynamic cool-off |
| Elevation of Privilege | Fake KYC payload lets attacker list tickets | Forged CCCD images | Liveness check, third-party KYC anti-spoof SDK, manual review queue |

#### B. Payment, Minting & Webhooks

| STRIDE | Threat | Attack Vector | Mitigations / Owners |
|--------|--------|---------------|----------------------|
| Spoofing | Forged payment confirmation | Webhook secret leak | Mutual TLS with gateway, rotate secrets, signature validation + replay nonce |
| Tampering | Modify ticket amount before mint | Parameter tampering via client | Server-side reservation data only, ignore client price fields |
| Repudiation | Buyer disputes payment but keeps NFT | Weak linkage between paymentID and tokenID | Persist signed payment intent, produce evidence bundle (Momo ref + on-chain tx) |
| Information Disclosure | Leakage of escrow account details | Verbose logs or errors | Mask bank IDs in logs, restrict observability access |
| Denial of Service | Flood mint queue causing timeout | Bot hits payment callback endpoint | Queue throttling per reservation, autoscale worker, circuit breaker |
| Elevation of Privilege | Backend minter key theft | Compromised CI/CD or dev laptop | KMS-backed keys, just-in-time access, hardware security module (HSM) signing |

#### C. Resale Marketplace & Escrow

| STRIDE | Threat | Attack Vector | Mitigations / Owners |
|--------|--------|---------------|----------------------|
| Spoofing | Attacker lists ticket they do not own | Offline metadata tampering | Contract ownership checks + NFT lock-on-list |
| Tampering | Seller manipulates listing cap >120% | Race condition in validation | Enforce cap in smart contract (maxMarkupBps), backend validation |
| Repudiation | Seller claims never got payout | Missing escrow trail | Append-only escrow ledger, signed release receipts |
| Information Disclosure | Exposure of resale PII/price data | Insecure admin export | Role-based access, anonymize analytics |
| Denial of Service | Mass listing cancellations via API abuse | Script hits cancel endpoint | Require biometric/embedded wallet signature, throttle cancellations |
| Elevation of Privilege | Organizer updates royalty percent arbitrarily | Missing auth separation | Distinct role for organizer vs platform, multi-sig for royalty config |

#### D. Check-in & QR Verification

| STRIDE | Threat | Attack Vector | Mitigations / Owners |
|--------|--------|---------------|----------------------|
| Spoofing | Replaying older QR to enter twice | Photo/video of screen | 3-second rotating QR with nonce, DB uniqueness constraint |
| Tampering | Altering QR payload to change seat | Crafted JSON in QR | Signature covers all fields; verify recovered address server-side |
| Repudiation | User disputes "already used" result | No audit for gate scans | Store gateId, nonce, timestamp, staffId; exportable audit log |
| Information Disclosure | Staff phones leaking wallet address | Logging raw payloads | Mask addresses on staff screen, log hashed wallet IDs |
| Denial of Service | DDoS `/verify-ticket` endpoint | Bot traffic or replay | Require device attestation, rate limit per gate device, edge caching of static assets |
| Elevation of Privilege | Compromised staff device whitelists bogus tickets | Debug endpoints left enabled | Device binding, signed staff configs, remote wipe |

#### E. Account Recovery & Admin Operations

| STRIDE | Threat | Attack Vector | Mitigations / Owners |
|--------|--------|---------------|----------------------|
| Spoofing | Attacker triggers recovery to steal wallet | Phished support agent | Dual-channel verification (phone + email), support workflow requires supervisor approval for high-value users |
| Tampering | Support edits ticket ownership | Direct DB access | Admin APIs behind RBAC, immutable event log, database row-level auditing |
| Repudiation | Organizer denies cancelling event | Lack of signed action trail | Require digitally signed admin actions (per-user key), export diffs to SIEM |
| Information Disclosure | Support dashboard leaks PII | Shoulder surfing or compromised laptop | Field-level masking, auto-logoff, privacy filters |
| Denial of Service | Malicious actor freezes many accounts | Abuse of freeze endpoint | Threshold alerts, require reason codes, anomaly detection for freeze volume |
| Elevation of Privilege | Support agent escalates roles | Compromised IAM | Enforce SSO with hardware-backed MFA, no shared accounts, quarterly access reviews |

### Abuse Cases & Testing Backlog

1. Simulate webhook replay and confirm idempotency + nonce rejection.
2. Run SIM-swap tabletop: confirm email out-of-band approval and freeze.
3. Pen-test guardian recovery path (initiate/cancel/complete) to ensure delays enforced.
4. Execute double-scan check-in load test (two gates, same token) to prove atomicity.
5. Chaos exercise on eKYC outage: verify cached status and graceful listing blocks.
6. Red-team admin portal to ensure RBAC and audit log capture each action.

Document these scenarios in the security test plan and align sprint acceptance criteria so mitigations above are validated before launch.

---

## Technical Feasibility

### Stack Validation

| Component | Chosen Technology | Feasibility | Notes |
|-----------|-------------------|-------------|-------|
| Mobile App | React Native | ✅ High | Mature, cross-platform, good RN SDK support from Privy |
| Backend | Node.js + Express | ✅ High | Standard choice, good async handling for blockchain |
| Database | PostgreSQL | ✅ High | Robust, JSONB for flexible schema |
| Blockchain | Base L2 | ✅ High | Low fees (~$0.03/tx), EVM compatible, Coinbase backing |
| Smart Contracts | Solidity | ✅ High | Standard for EVM, rich tooling |
| Wallet | Privy (ERC-4337) | ⚠️ Medium | New technology, but well-documented |
| Payment | Momo API | ⚠️ Medium | Requires business agreement, sandbox available |
| eKYC | FPT.AI | ✅ High | Standard integration, good free tier |

### Proof of Concept Recommendations

Before full development, validate these high-risk integrations:

| PoC | Duration | Goal | Success Criteria |
|-----|----------|------|------------------|
| Privy Wallet + Base L2 | 1 week | Confirm wallet creation and NFT minting | User registers → wallet created → NFT minted |
| Momo Sandbox | 1 week | Validate payment webhook flow | Payment → webhook → database update |
| QR Signature Flow | 3 days | Verify rotating QR performance | Generate and verify QR within 100ms |
| Atomic Check-in | 2 days | Test concurrent check-in race condition | 100 concurrent scans → only 1 succeeds |

### Performance Requirements

| Metric | Requirement | Validation Method |
|--------|-------------|-------------------|
| API Response Time | < 200ms (p95) | Load testing |
| QR Generation | < 50ms | Unit testing |
| QR Verification | < 100ms | Unit testing |
| Concurrent Check-ins | 1000/second | Load testing |
| Payment Confirmation | < 5 seconds | Integration testing |
| NFT Minting | < 30 seconds | Blockchain testing |

### Scalability Considerations

```
SCALING STRATEGY:

Current Target: 10,000 tickets/event

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCALING LAYERS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  APPLICATION LAYER                                                           │
│  ├── Horizontal scaling (multiple Node.js instances)                        │
│  ├── Load balancer (AWS ALB / GCP LB)                                       │
│  └── Stateless design (sessions in Redis)                                   │
│                                                                              │
│  DATABASE LAYER                                                              │
│  ├── Read replicas for high-read operations (event listing)                 │
│  ├── Connection pooling (PgBouncer)                                         │
│  └── Caching layer (Redis) for hot data                                     │
│                                                                              │
│  BLOCKCHAIN LAYER                                                            │
│  ├── Batch minting (multiple tickets in one tx)                             │
│  ├── Queue-based processing (Bull/BullMQ)                                   │
│  └── Multiple RPC endpoints (failover)                                      │
│                                                                              │
│  CHECK-IN LAYER                                                              │
│  ├── Edge caching for ticket data                                           │
│  ├── Optimistic locking for atomic updates                                  │
│  └── Separate read/write paths                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gap Analysis

### Requirements Gaps Identified

| Gap ID | Area | Gap Description | Recommendation | Priority |
|--------|------|-----------------|----------------|----------|
| G1 | Organizer Onboarding | How do organizers register and get verified? | Add organizer registration flow with business verification | Must (Phase 1) |
| G2 | Event Creation | Detailed event creation flow not specified | Define event creation API and validation rules | Must (Phase 1) |
| G3 | Seat Selection | No mention of reserved seating | General admission only for Phase 1; seat maps in Phase 2 | Defer |
| G4 | Multi-currency | Only VND specified; USDT mentioned but not detailed | VND only for Phase 1; USDT in Phase 2 with BasalPay | Defer |
| G5 | Notifications | Notification content and triggers not detailed | Define notification templates and triggers | Should |
| G6 | Analytics | No analytics requirements defined | Basic event analytics for organizers; detailed in Phase 2 | Could |
| G7 | Admin Panel | No admin/back-office requirements | Define admin panel for dispute handling, user management | Should |
| G8 | Rate Limiting | Specific rate limits not defined | Define per-endpoint rate limits | Must |

### Gaps to Address Before Design Phase

#### G1: Organizer Onboarding (Must Address)

```
PROPOSED FLOW:

1. Organizer Registration
   ├── Business email + phone verification
   ├── Business name and registration number
   ├── Bank account for payouts
   └── Agreement to terms

2. Verification (Manual for MVP)
   ├── Platform admin reviews application
   ├── Verify business registration
   └── Approve/reject with reason

3. Post-Approval
   ├── Can create events
   ├── Access to organizer dashboard
   └── Royalty wallet setup
```

#### G2: Event Creation (Must Address)

```
EVENT CREATION FIELDS:

Required:
├── Title
├── Description
├── Venue (select or create)
├── Start date/time
├── End date/time
├── Ticket types (name, price, quantity)
└── Cover image

Optional:
├── Additional images
├── Terms and conditions
├── Age restriction
├── Dress code
└── FAQ

Validation Rules:
├── Start date must be > 24 hours from now
├── End date must be > start date
├── At least 1 ticket type
├── Price > 0 (or free)
├── Quantity > 0
└── Title length: 5-100 chars
```

#### G8: Rate Limiting (Must Address)

| Endpoint Category | Rate Limit | Window |
|-------------------|------------|--------|
| Authentication (OTP) | 5 requests | 15 minutes |
| Event Listing | 100 requests | 1 minute |
| Ticket Purchase | 10 requests | 1 minute |
| Resale Listing | 5 requests | 1 minute |
| Check-in Verify | 100 requests | 1 minute |
| Dispute Filing | 3 requests | 1 hour |

---

## Next Steps

### Immediate Actions (Before Design Phase)

| # | Action | Owner | Deadline |
|---|--------|-------|----------|
| 1 | Legal consultation on NFT/ticketing regulations | Business | Week 1 |
| 2 | Privy + Base L2 PoC | Tech Lead | Week 1 |
| 3 | Momo sandbox account setup | Tech Lead | Week 1 |
| 4 | Define organizer onboarding flow | Product | Week 1 |
| 5 | Define event creation requirements | Product | Week 1 |
| 6 | Security threat modeling | Security | Week 2 |
| 7 | Smart contract architecture design | Blockchain Dev | Week 2 |

### Design Phase Deliverables

| Deliverable | Description |
|-------------|-------------|
| System Architecture Document | Detailed technical architecture with component diagrams |
| Database Schema Design | Complete schema with indexes and constraints |
| API Specification | OpenAPI 3.0 spec for all endpoints |
| Smart Contract Design | Contract interfaces and interaction patterns |
| UI/UX Wireframes | Key user flows and screen designs |
| Security Design | Authentication, authorization, encryption design |
| Infrastructure Design | Cloud architecture, CI/CD, monitoring |

### Sign-off Required

| Stakeholder | Sign-off On |
|-------------|-------------|
| Product Owner | MVP scope and prioritization |
| Tech Lead | Technical feasibility and architecture |
| Legal | Regulatory compliance approach |
| Business | Third-party vendor selections |

---

## Appendix

### A. Glossary Updates

| Term | Definition |
|------|------------|
| **ERD** | Entity Relationship Diagram - visual representation of database entities |
| **MoSCoW** | Prioritization method: Must/Should/Could/Won't have |
| **PoC** | Proof of Concept - small-scale test of feasibility |
| **SLA** | Service Level Agreement - performance commitments |
| **MAU** | Monthly Active Users - billing metric for wallet providers |

### B. Reference Documents

- REQUIREMENTS.md - Full requirements specification
- Base L2 Documentation - https://docs.base.org
- Privy Documentation - https://docs.privy.io
- Momo Developer Portal - https://developers.momo.vn
- ERC-4337 Specification - https://eips.ethereum.org/EIPS/eip-4337

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-15 | 1.0 | Initial analysis document |
