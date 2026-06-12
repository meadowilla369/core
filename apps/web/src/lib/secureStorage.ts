import { Capacitor, registerPlugin } from "@capacitor/core";

interface SecureStoragePlugin {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

const NativeSecureStorage = registerPlugin<SecureStoragePlugin>("SecureStorage");

// On web, fall back to localStorage so the onboarding flow works in browser.
// On native (iOS/Android), use the platform Keychain / EncryptedSharedPreferences.
const webFallback: SecureStoragePlugin = {
  async get({ key }) {
    const value = window.localStorage.getItem(`entr.secure.${key}`);
    return { value };
  },
  async set({ key, value }) {
    window.localStorage.setItem(`entr.secure.${key}`, value);
  },
  async remove({ key }) {
    window.localStorage.removeItem(`entr.secure.${key}`);
  }
};

function getStorage(): SecureStoragePlugin {
  return Capacitor.isNativePlatform() ? NativeSecureStorage : webFallback;
}

export async function secureGet(key: string): Promise<string | null> {
  const { value } = await getStorage().get({ key });
  return value ?? null;
}

export async function secureSet(key: string, value: string): Promise<void> {
  await getStorage().set({ key, value });
}

export async function secureRemove(key: string): Promise<void> {
  await getStorage().remove({ key });
}

export const SECURE_KEY_PRIVATE_KEY = "wallet.privateKey";
export const SECURE_KEY_WALLET_ADDRESS = "wallet.address";
