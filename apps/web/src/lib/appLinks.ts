export const ENTR_DISCOVER_PATH = "/discover";
export const ENTR_CUSTOM_SCHEME = "entr";

export interface EntrAppHandoff {
  handoffToken?: string | null;
}

const configuredUniversalLinkOrigin =
  typeof import.meta.env?.VITE_ENTR_UNIVERSAL_LINK_ORIGIN === "string"
    ? import.meta.env.VITE_ENTR_UNIVERSAL_LINK_ORIGIN
    : "";

const normalizePath = (path: string) => (path.startsWith("/") ? path : `/${path}`);

const normalizeOrigin = (origin: string) => origin.trim().replace(/\/+$/, "");

export const buildEntrUniversalLink = (
  path = ENTR_DISCOVER_PATH,
  origin = configuredUniversalLinkOrigin,
  handoff?: EntrAppHandoff | null
) => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return null;
  }

  return appendHandoffParam(`${normalizedOrigin}${normalizePath(path)}`, handoff);
};

const appendHandoffParam = (url: string, handoff?: EntrAppHandoff | null) => {
  const handoffToken = handoff?.handoffToken?.trim();
  if (!handoffToken) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}handoff_token=${encodeURIComponent(handoffToken)}`;
};

export const buildEntrCustomSchemeLink = (
  path = ENTR_DISCOVER_PATH,
  handoff?: EntrAppHandoff | null
) => appendHandoffParam(`${ENTR_CUSTOM_SCHEME}://${normalizePath(path).slice(1)}`, handoff);

export const parseEntrDeepLink = (url: string): { path: string; handoffToken: string | null } => {
  try {
    const parsed = new URL(url);
    const path =
      parsed.protocol === `${ENTR_CUSTOM_SCHEME}:`
        ? normalizePath(parsed.hostname || parsed.pathname || ENTR_DISCOVER_PATH)
        : normalizePath(parsed.pathname || ENTR_DISCOVER_PATH);

    return {
      path,
      handoffToken: parsed.searchParams.get("handoff_token")
    };
  } catch {
    return {
      path: ENTR_DISCOVER_PATH,
      handoffToken: null
    };
  }
};

interface AppLinkWindow {
  location: {
    href: string;
    assign?: (url: string) => void;
  };
}

export const openEntrDiscoverApp = (
  handoff?: EntrAppHandoff | null,
  windowRef: AppLinkWindow = window
) => {
  const url =
    buildEntrUniversalLink(ENTR_DISCOVER_PATH, configuredUniversalLinkOrigin, handoff) ??
    buildEntrCustomSchemeLink(ENTR_DISCOVER_PATH, handoff);

  if (typeof windowRef.location.assign === "function") {
    windowRef.location.assign(url);
    return;
  }

  windowRef.location.href = url;
};
