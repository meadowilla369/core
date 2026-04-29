import assert from "node:assert/strict";
import test from "node:test";

import {
  clearProfileCustomization,
  loadProfileCustomization,
  saveProfileCustomization,
  type ProfileCustomization
} from "./profile-customization.ts";

class MemoryStorage {
  private items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

test("saveProfileCustomization trims display name and stores emoji avatar", () => {
  const storage = new MemoryStorage();

  saveProfileCustomization(
    {
      displayName: "  Tran Minh  ",
      avatar: {
        type: "emoji",
        value: "🎧"
      }
    },
    storage
  );

  assert.deepEqual(loadProfileCustomization(storage), {
    displayName: "Tran Minh",
    avatar: {
      type: "emoji",
      value: "🎧"
    }
  } satisfies ProfileCustomization);
});

test("loadProfileCustomization clears malformed records", () => {
  const storage = new MemoryStorage();
  storage.setItem("entr:profile-customization:v1", JSON.stringify({ avatar: { type: "emoji" } }));

  assert.deepEqual(loadProfileCustomization(storage), {});
  assert.equal(storage.getItem("entr:profile-customization:v1"), null);
});

test("clearProfileCustomization removes stored customization", () => {
  const storage = new MemoryStorage();

  saveProfileCustomization({ displayName: "Tran Minh" }, storage);
  clearProfileCustomization(storage);

  assert.deepEqual(loadProfileCustomization(storage), {});
});
