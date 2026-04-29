const PROFILE_CUSTOMIZATION_KEY = "entr:profile-customization:v1";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ProfileAvatarCustomization =
  | {
      type: "image";
      dataUrl: string;
    }
  | {
      type: "emoji";
      value: string;
    };

export interface ProfileCustomization {
  displayName?: string;
  avatar?: ProfileAvatarCustomization;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function isImageAvatar(
  value: unknown
): value is Extract<ProfileAvatarCustomization, { type: "image" }> {
  const candidate = value as Partial<Extract<ProfileAvatarCustomization, { type: "image" }>>;
  return (
    candidate?.type === "image" &&
    typeof candidate.dataUrl === "string" &&
    candidate.dataUrl.startsWith("data:image/")
  );
}

function isEmojiAvatar(
  value: unknown
): value is Extract<ProfileAvatarCustomization, { type: "emoji" }> {
  const candidate = value as Partial<Extract<ProfileAvatarCustomization, { type: "emoji" }>>;
  return (
    candidate?.type === "emoji" &&
    typeof candidate.value === "string" &&
    candidate.value.trim().length > 0 &&
    candidate.value.trim().length <= 16
  );
}

function normalizeCustomization(value: unknown): ProfileCustomization | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<ProfileCustomization>;
  const displayName =
    typeof candidate.displayName === "string" ? candidate.displayName.trim() : undefined;
  const rawAvatar = candidate.avatar;
  let avatar: ProfileAvatarCustomization | undefined;

  if (isImageAvatar(rawAvatar)) {
    avatar = rawAvatar;
  } else if (isEmojiAvatar(rawAvatar)) {
    avatar = { type: "emoji", value: rawAvatar.value.trim() };
  }

  if (candidate.avatar !== undefined && avatar === undefined) {
    return null;
  }

  return {
    ...(displayName ? { displayName } : {}),
    ...(avatar ? { avatar } : {})
  };
}

export function loadProfileCustomization(
  storage: StorageLike | null = getBrowserStorage()
): ProfileCustomization {
  if (!storage) {
    return {};
  }

  const raw = storage.getItem(PROFILE_CUSTOMIZATION_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeCustomization(parsed);
    if (!normalized) {
      storage.removeItem(PROFILE_CUSTOMIZATION_KEY);
      return {};
    }
    return normalized;
  } catch {
    storage.removeItem(PROFILE_CUSTOMIZATION_KEY);
    return {};
  }
}

export function saveProfileCustomization(
  customization: ProfileCustomization,
  storage: StorageLike | null = getBrowserStorage()
): ProfileCustomization {
  const normalized = normalizeCustomization(customization) ?? {};
  if (storage) {
    storage.setItem(PROFILE_CUSTOMIZATION_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

export function clearProfileCustomization(storage: StorageLike | null = getBrowserStorage()): void {
  storage?.removeItem(PROFILE_CUSTOMIZATION_KEY);
}
