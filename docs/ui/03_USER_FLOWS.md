# User Flows

## Buyer/Seller Flows

### BS-01 Primary Purchase

1. OTP login
2. Browse event list
3. Open event detail
4. Reserve tickets (`quantity`)
5. Confirm checkout/payment
6. View ticket in My Tickets

Failure branches:
- Reservation expired
- Payment failed/pending timeout
- Inventory unavailable

### BS-02 Resale Listing

1. Open owned ticket detail
2. Start resale flow
3. Enter ask price
4. Validate cap, cutoff, resale count
5. If high value (`>= 5,000,000 VND`) and unverified: complete KYC
6. Confirm listing creation

Failure branches:
- `MARKUP_EXCEEDED`
- `LISTING_CUTOFF_REACHED`
- `RESALE_LIMIT_REACHED`
- `KYC_REQUIRED`

### BS-03 Resale Purchase

1. Open resale listing
2. Confirm all-in price
3. Choose payment gateway
4. Submit purchase
5. Receive completed listing + ticket ownership update

Failure branches:
- Listing inactive
- Cutoff reached
- KYC required by threshold

## Staff Flows

### STF-01 Scan And Verify

1. Open scan screen
2. Scan QR or manual input
3. Submit `gateId + qrData` to check-in verify
4. Show result (`valid`, `duplicate`, `expired`, `invalid`)
5. Update gate metrics

Failure branches:
- Camera permission denied
- Network error
- Invalid payload

## BTC Organizer Flows

### BTC-01 Event Setup

1. Create event
2. Add ticket types
3. Publish/manage lifecycle

### BTC-02 Event Cancellation

1. Open event detail
2. Trigger cancellation action
3. Confirm refund flow status
4. Monitor impact on listings/check-in

### BTC-03 Attendance Monitoring

1. Open check-in ops page
2. Select event
3. Track gate stats and check-in count

## Platform Flows

### PLT-01 Dispute Moderation

1. Open dispute queue
2. Filter by severity/SLA
3. Open case detail
4. Review evidence and messages
5. Submit moderation decision

### PLT-02 Recovery And Refund Monitoring

1. Open recovery/refund queues
2. Inspect stuck/failed items
3. Trigger allowed internal actions
4. Verify status transitions and logs
