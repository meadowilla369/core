import type { EventCardView } from "@ticket-platform/shared-types";

export interface PosterPalette {
  backdrop: string;
  accent: string;
  chip: string;
  panel: string;
}

export interface PosterEventView extends EventCardView {
  imageUrl?: string;
  heroImageUrl?: string;
  mood: string;
  highlight: string;
  trustBadges: string[];
  startingPriceLabel: string;
  priceValue: number;
  verified: boolean;
  resaleSafe: boolean;
  officialSeller: boolean;
  syncLabel: string;
  interestCount: string;
  locationCluster: string;
  spotlightLabel: string;
  posterPalette: PosterPalette;
}

export interface PosterFilterState {
  query: string;
  category: string;
  mood: string;
  verifiedOnly: boolean;
  budgetOnly: boolean;
}

export interface HomePosterSections {
  hero?: PosterEventView;
  hotNow: PosterEventView[];
  nearYou: PosterEventView[];
  editorPicks: PosterEventView[];
  byMood: PosterEventView[];
}

const posterPalettes: PosterPalette[] = [
  {
    backdrop:
      "radial-gradient(circle at 18% 20%, rgba(244,63,94,.64), transparent 24%), radial-gradient(circle at 72% 22%, rgba(59,130,246,.62), transparent 28%), radial-gradient(circle at 48% 78%, rgba(250,204,21,.38), transparent 34%), linear-gradient(135deg, #1a1023, #0f172a 58%, #08090b)",
    accent: "rgba(167,139,250,.26)",
    chip: "rgba(124,58,237,.16)",
    panel: "linear-gradient(135deg, rgba(124,58,237,.12), rgba(15,23,42,.92))"
  },
  {
    backdrop:
      "radial-gradient(circle at 16% 18%, rgba(34,197,94,.46), transparent 24%), radial-gradient(circle at 68% 24%, rgba(14,165,233,.58), transparent 26%), radial-gradient(circle at 56% 78%, rgba(249,115,22,.44), transparent 32%), linear-gradient(135deg, #0b1f22, #111827 62%, #08090b)",
    accent: "rgba(34,197,94,.24)",
    chip: "rgba(14,165,233,.14)",
    panel: "linear-gradient(135deg, rgba(14,165,233,.12), rgba(17,24,39,.92))"
  },
  {
    backdrop:
      "radial-gradient(circle at 22% 20%, rgba(251,191,36,.48), transparent 24%), radial-gradient(circle at 76% 24%, rgba(236,72,153,.56), transparent 26%), radial-gradient(circle at 52% 76%, rgba(99,102,241,.46), transparent 32%), linear-gradient(135deg, #27131f, #111827 58%, #08090b)",
    accent: "rgba(249,115,22,.28)",
    chip: "rgba(236,72,153,.14)",
    panel: "linear-gradient(135deg, rgba(249,115,22,.12), rgba(17,24,39,.92))"
  }
];

const moodByCategory: Record<string, string> = {
  "Hòa nhạc": "Night out",
  "Lễ hội": "Festival glow",
  "Công nghệ": "Future pulse",
  "Thể thao": "High energy",
  "Hài kịch": "Easy night",
  Kịch: "Stage mood"
};

function parseCurrency(value: string) {
  const digits = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(digits) ? digits : 0;
}

function formatInterestCount(index: number) {
  const count = 1200 + index * 317;
  return `${(count / 1000).toFixed(1).replace(".", ",")}k quan tâm`;
}

function getLocationCluster(location: string) {
  const lowered = location.toLowerCase();

  if (["tokyo", "doha", "berlin"].some((token) => lowered.includes(token))) {
    return "International";
  }

  if (["nyc", "las vegas", "miami", "chicago"].some((token) => lowered.includes(token))) {
    return "City nights";
  }

  return "Weekend picks";
}

function getTrustFlags(event: EventCardView, index: number) {
  const priceValue = parseCurrency(event.price);
  const verified = index % 4 !== 0 || priceValue <= 1000000;
  const resaleSafe = index % 3 !== 1;
  const officialSeller = index % 2 === 0;

  return {
    verified,
    resaleSafe,
    officialSeller,
    syncLabel: verified ? "99.2% sync" : "On-chain checked",
    priceValue
  };
}

export function toPosterEventViews(events: EventCardView[]): PosterEventView[] {
  return events.map((event, index) => {
    const mood = moodByCategory[event.category] ?? "Curated night";
    const palette = posterPalettes[index % posterPalettes.length];
    const trust = getTrustFlags(event, index);
    const trustBadges = [
      trust.verified ? "Verified" : "On-chain checked",
      trust.resaleSafe ? "Resale safe" : "Official flow",
      trust.officialSeller ? "Official seller" : "Curated drop"
    ];

    return {
      ...event,
      imageUrl: event.image,
      heroImageUrl: event.image,
      mood,
      highlight: `${mood} · ${getLocationCluster(event.location)}`,
      trustBadges,
      startingPriceLabel: `Từ ${event.price}`,
      priceValue: trust.priceValue,
      verified: trust.verified,
      resaleSafe: trust.resaleSafe,
      officialSeller: trust.officialSeller,
      syncLabel: trust.syncLabel,
      interestCount: formatInterestCount(index),
      locationCluster: getLocationCluster(event.location),
      spotlightLabel: index === 0 ? "Tonight spotlight" : "Curated pick",
      posterPalette: palette
    };
  });
}

export function buildHomeSections(events: PosterEventView[]): HomePosterSections {
  const hero = events[0];
  const rest = events.slice(1);
  const fallbackPool = rest.slice(0, 3);
  const nearYouEvents = rest.filter((event) => event.locationCluster === "City nights").slice(0, 3);
  const editorPickEvents = rest.filter((event) => event.officialSeller).slice(0, 3);
  const byMoodEvents = rest.filter((event) => event.mood !== hero?.mood).slice(0, 3);

  return {
    hero,
    hotNow: rest.slice(0, 3),
    nearYou: nearYouEvents.length > 0 ? nearYouEvents : fallbackPool,
    editorPicks: editorPickEvents.length > 0 ? editorPickEvents : fallbackPool,
    byMood: byMoodEvents.length > 0 ? byMoodEvents : fallbackPool
  };
}

export function filterPosterEvents(events: PosterEventView[], filters: PosterFilterState) {
  const query = filters.query.trim().toLowerCase();

  return events.filter((event) => {
    const matchesQuery =
      query.length === 0 ||
      event.name.toLowerCase().includes(query) ||
      event.location.toLowerCase().includes(query) ||
      event.category.toLowerCase().includes(query);
    const matchesCategory =
      filters.category === "Tất cả" ||
      event.category.toLowerCase() === filters.category.toLowerCase();
    const matchesMood =
      filters.mood === "Tất cả" || event.mood.toLowerCase() === filters.mood.toLowerCase();
    const matchesVerified = !filters.verifiedOnly || event.verified;
    const matchesBudget = !filters.budgetOnly || event.priceValue <= 1_000_000;

    return matchesQuery && matchesCategory && matchesMood && matchesVerified && matchesBudget;
  });
}

export function getPosterCategories(events: PosterEventView[]) {
  return ["Tất cả", ...new Set(events.map((event) => event.category))];
}

export function getPosterMoods(events: PosterEventView[]) {
  return ["Tất cả", ...new Set(events.map((event) => event.mood))];
}
