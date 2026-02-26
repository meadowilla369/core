# Admin Governance Model

## Roles

- `DEFAULT_ADMIN_ROLE`: held by Safe multi-sig only.
- `PAUSER_ROLE`: held by Safe multi-sig and dedicated incident responder signer.
- `ESCROW_ROLE`: held by settlement service signer.
- `EVENT_MANAGER_ROLE` / `OPERATOR_ROLE` / `MINTER_ROLE`: delegated to backend service signers.

## Safe + Timelock Design

1. Safe multi-sig (3/5) owns contract admin roles.
2. Timelock controller enforces delay for non-emergency admin actions:
- `setMaxMarkupBps`
- `setEscrowHook`
- `setSessionSigner`
- role grants/revokes
3. Emergency pause can bypass timelock using dedicated `PAUSER_ROLE` signer.

## Timelock Parameters

- Staging: 6 hours minimum delay.
- Production: 24 hours minimum delay.
- Grace period: 7 days.

## Change Management

1. Proposal created in Safe.
2. Timelock queue transaction hash recorded.
3. Security reviewer approves.
4. Execute after delay.
5. Update deployment registry and ops channel.
