export interface ListingDraft {
  tokenId: string;
  originalPrice: number;
  askPrice: number;
}

export interface Listing extends ListingDraft {
  listingId: string;
  status: "active" | "cancelled" | "completed";
}

export function validateListingPrice(draft: ListingDraft, maxMarkupPercent = 120): void {
  const maxPrice = Math.floor((draft.originalPrice * maxMarkupPercent) / 100);
  if (draft.askPrice > maxPrice) {
    throw new Error("Listing price exceeds markup cap");
  }
}

export function createListing(draft: ListingDraft): Listing {
  validateListingPrice(draft);
  return {
    ...draft,
    listingId: `lst_${Date.now()}`,
    status: "active"
  };
}
