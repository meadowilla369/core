import { en } from "./en.js";
import { vi } from "./vi.js";

export type Locale = "vi" | "en";

export function dictionary(locale: Locale) {
  return locale === "vi" ? vi : en;
}
