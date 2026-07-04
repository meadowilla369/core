export function normalizeOnchainEventId(value: string): string {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Invalid onchain event id");
  }

  return normalized;
}
