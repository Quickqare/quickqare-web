import { useEffect, useState } from "react";
import client from "../api/client";

export type HomeTheme = {
  isActive: boolean;
  targetPlatform: "both" | "app" | "web";
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  promoTagBadge: string;
  promoTagline: string;
  promoCta: string;
  promoIconUrl: string;
  categoryIcons: {
    acRepair: string; acRepairShimmer: boolean;
    plumbing: string; plumbingShimmer: boolean;
    mehendi: string; mehendiShimmer: boolean;
    electrician: string; electricianShimmer: boolean;
    celebration: string; celebrationShimmer: boolean;
  };
};

export type SocialLinks = {
  whatsapp: string; instagram: string; facebook: string; twitter: string; youtube: string;
};

export type ContactInfo = { email: string; phone: string };

export type HomeIconAnimStyle = "none" | "bob" | "bounce" | "tada";

/** Per-icon animation style — only consulted when homeIconAnimationEnabled
    (the master switch) is true. */
export type HomeIconAnimation = {
  acRepair: HomeIconAnimStyle; plumbing: HomeIconAnimStyle; mehendi: HomeIconAnimStyle;
  electrician: HomeIconAnimStyle; celebration: HomeIconAnimStyle; offers: HomeIconAnimStyle;
};

export type AppConfig = {
  emergency: { bookingsDisabled: boolean; paymentsFreezed: boolean; emergencyLockdown: boolean };
  referral: { isEnabled: boolean; referrerRewardAmount: number; newUserDiscountAmount: number };
  pricing: { taxPercent: number; platformFeePercent: number; platformFeeFlatInr: number };
  homeTheme: HomeTheme;
  socialLinks: SocialLinks;
  contactInfo: ContactInfo;
  defaultBannerEnabled: boolean;
  homeIconAnimationEnabled: boolean;
  homeIconAnimation: HomeIconAnimation;
};

const DEFAULT_ICON_ANIMATION: HomeIconAnimation = {
  acRepair: "bob", plumbing: "bob", mehendi: "bob",
  electrician: "bob", celebration: "bob", offers: "bob",
};

/** Legacy booleans (old on/off config) and unknown values map to bob/none. */
function iconAnimStyle(v: unknown): HomeIconAnimStyle {
  if (v === false) return "none";
  return v === "none" || v === "bob" || v === "bounce" || v === "tada" ? v : "bob";
}

const DEFAULT_THEME: HomeTheme = {
  isActive: false,
  targetPlatform: "both",
  primaryColor: "#22A06B",
  accentColor: "#FFFFFF",
  backgroundColor: "#F5F5F5",
  promoTagBadge: "LIMITED OFFER",
  promoTagline: "",
  promoCta: "Book now →",
  promoIconUrl: "",
  categoryIcons: {
    acRepair: "", acRepairShimmer: true,
    plumbing: "", plumbingShimmer: true,
    mehendi: "", mehendiShimmer: true,
    electrician: "", electricianShimmer: true,
    celebration: "", celebrationShimmer: true,
  },
};

const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  whatsapp: "", instagram: "", facebook: "", twitter: "", youtube: "",
};

const DEFAULT_CONTACT_INFO: ContactInfo = { email: "", phone: "" };

const DEFAULT: AppConfig = {
  emergency: { bookingsDisabled: false, paymentsFreezed: false, emergencyLockdown: false },
  referral: { isEnabled: true, referrerRewardAmount: 50, newUserDiscountAmount: 100 },
  pricing: { taxPercent: 18, platformFeePercent: 0, platformFeeFlatInr: 0 },
  homeTheme: DEFAULT_THEME,
  socialLinks: DEFAULT_SOCIAL_LINKS,
  contactInfo: DEFAULT_CONTACT_INFO,
  defaultBannerEnabled: true,
  homeIconAnimationEnabled: true,
  homeIconAnimation: DEFAULT_ICON_ANIMATION,
};

function hexToRgbVars(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "";
  return `${r} ${g} ${b}`;
}

function darken(hex: string): string {
  const clean = hex.replace("#", "");
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - 30);
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - 30);
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - 30);
  return `${r} ${g} ${b}`;
}

function applyTheme(theme: HomeTheme) {
  const root = document.documentElement;
  if (theme.isActive && theme.primaryColor) {
    root.style.setProperty("--color-primary", hexToRgbVars(theme.primaryColor));
    root.style.setProperty("--color-primary-dark", darken(theme.primaryColor));
  }
  if (theme.isActive && theme.backgroundColor) {
    root.style.setProperty("--color-bg", hexToRgbVars(theme.backgroundColor));
  }
}

function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty("--color-primary");
  root.style.removeProperty("--color-primary-dark");
  root.style.removeProperty("--color-bg");
}

let cached: AppConfig | null = null;

// How often to re-check while the tab is open/visible, so an admin flipping an
// emergency flag (bookingsDisabled/paymentsFreezed/emergencyLockdown) reaches a
// tab that's already open, instead of requiring a hard refresh. Previously this
// hook fetched ONCE per page load and cached forever — a tab left open through
// a maintenance window would never see the flag change.
const POLL_INTERVAL_MS = 60_000;

function applyThemeIfNeeded(c: AppConfig) {
  const appliesToWeb =
    c.homeTheme.isActive &&
    (c.homeTheme.targetPlatform === "web" || c.homeTheme.targetPlatform === "both");
  if (appliesToWeb) applyTheme(c.homeTheme);
  else resetTheme();
}

function parseConfig(data: any): AppConfig {
  return {
    emergency: data?.emergency ?? DEFAULT.emergency,
    referral:  data?.referral  ?? DEFAULT.referral,
    pricing:   data?.pricing   ?? DEFAULT.pricing,
    homeTheme: { ...DEFAULT_THEME, ...(data?.homeTheme ?? {}) },
    socialLinks: { ...DEFAULT_SOCIAL_LINKS, ...(data?.socialLinks ?? {}) },
    contactInfo: { ...DEFAULT_CONTACT_INFO, ...(data?.contactInfo ?? {}) },
    defaultBannerEnabled: data?.defaultBannerEnabled !== false,
    homeIconAnimationEnabled: data?.homeIconAnimationEnabled !== false,
    homeIconAnimation: {
      acRepair:    iconAnimStyle(data?.homeIconAnimation?.acRepair),
      plumbing:    iconAnimStyle(data?.homeIconAnimation?.plumbing),
      mehendi:     iconAnimStyle(data?.homeIconAnimation?.mehendi),
      electrician: iconAnimStyle(data?.homeIconAnimation?.electrician),
      celebration: iconAnimStyle(data?.homeIconAnimation?.celebration),
      offers:      iconAnimStyle(data?.homeIconAnimation?.offers),
    },
  };
}

// ─── One shared poller for the whole app ──────────────────────────────────────
// The request, the interval and the visibilitychange listener live at module
// scope, shared by every subscriber, rather than one set per hook call. They
// used to be per-call, and CategoryIcon calls this hook — the home page renders
// one icon per category, so a single tab fired ~10 identical /api/app-config
// requests on load, another ~10 every 60s, and another ~10 on every refocus.
// The module-level `cached` only ever deduplicated the first *render*, not the
// fetches. Refcounted: the timer starts with the first subscriber and stops
// when the last one unmounts.
const subscribers = new Set<(c: AppConfig) => void>();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

function fetchConfig() {
  // Collapses the burst of mount-time calls (one per subscriber) into one request.
  if (inFlight) return;
  inFlight = true;
  client
    .get("/api/app-config")
    .then((res) => {
      const c = parseConfig(res.data);
      cached = c;
      applyThemeIfNeeded(c);
      subscribers.forEach((notify) => notify(c));
    })
    .catch(() => {
      // Network hiccup — keep showing whatever we already have (cached or
      // DEFAULT). The next poll or visibility change tries again.
    })
    .finally(() => {
      inFlight = false;
    });
}

// Re-check when the tab regains focus — covers the common case of a customer
// leaving the booking tab open in the background during a maintenance window.
function onVisibilityChange() {
  if (document.visibilityState === "visible") fetchConfig();
}

function startPolling() {
  if (pollTimer) return;
  document.addEventListener("visibilitychange", onVisibilityChange);
  // Also poll periodically for tabs that just stay open and focused.
  pollTimer = setInterval(() => {
    if (document.visibilityState === "visible") fetchConfig();
  }, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
  document.removeEventListener("visibilitychange", onVisibilityChange);
}

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(cached ?? DEFAULT);

  useEffect(() => {
    subscribers.add(setConfig);
    startPolling();

    // Render cached data instantly (no flash) while a fresh copy loads. A
    // component mounting later (a modal, say) also adopts whatever the shared
    // poller has already fetched, instead of starting from DEFAULT.
    if (cached) {
      setConfig(cached);
      applyThemeIfNeeded(cached);
    }

    // Fetch on mount so opening the booking modal picks up an emergency flag
    // flipped since the last poll. Deduped by `inFlight` when several mount together.
    fetchConfig();

    return () => {
      subscribers.delete(setConfig);
      if (subscribers.size === 0) stopPolling();
    };
  }, []);

  return config;
}
