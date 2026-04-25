import type { OnboardingState, PersistedSessionSnapshot } from "./types";

const ONBOARDING_DRAFT_KEY = "entr.onboarding.draft";
const ONBOARDING_SESSION_KEY = "entr.onboarding.session";

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function loadOnboardingDraft(): OnboardingState | null {
  const storage = getStorage();
  const raw = storage?.getItem(ONBOARDING_DRAFT_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as OnboardingState;
  } catch {
    storage?.removeItem(ONBOARDING_DRAFT_KEY);
    return null;
  }
}

export function saveOnboardingDraft(state: OnboardingState) {
  getStorage()?.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(state));
}

export function clearOnboardingDraft() {
  getStorage()?.removeItem(ONBOARDING_DRAFT_KEY);
}

export function loadPersistedSessionSnapshot(): PersistedSessionSnapshot | null {
  const storage = getStorage();
  const raw = storage?.getItem(ONBOARDING_SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedSessionSnapshot;
  } catch {
    storage?.removeItem(ONBOARDING_SESSION_KEY);
    return null;
  }
}

export function savePersistedSessionSnapshot(session: PersistedSessionSnapshot) {
  getStorage()?.setItem(ONBOARDING_SESSION_KEY, JSON.stringify(session));
}

export function clearPersistedSessionSnapshot() {
  getStorage()?.removeItem(ONBOARDING_SESSION_KEY);
}
