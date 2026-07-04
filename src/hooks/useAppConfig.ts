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
  };
};

export type SocialLinks = {
  whatsapp: string; instagram: string; facebook: string; twitter: string; youtube: string;
};

export type AppConfig = {
  emergency: { bookingsDisabled: boolean; paymentsFreezed: boolean; emergencyLockdown: boolean };
  referral: { isEnabled: boolean; referrerRewardAmount: number; newUserDiscountAmount: number };
  pricing: { taxPercent: number; platformFeePercent: number; platformFeeFlatInr: number };
  homeTheme: HomeTheme;
  socialLinks: SocialLinks;
};

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
  },
};

const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  whatsapp: "", instagram: "", facebook: "", twitter: "", youtube: "",
};

const DEFAULT: AppConfig = {
  emergency: { bookingsDisabled: false, paymentsFreezed: false, emergencyLockdown: false },
  referral: { isEnabled: true, referrerRewardAmount: 50, newUserDiscountAmount: 100 },
  pricing: { taxPercent: 18, platformFeePercent: 0, platformFeeFlatInr: 0 },
  homeTheme: DEFAULT_THEME,
  socialLinks: DEFAULT_SOCIAL_LINKS,
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

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(cached ?? DEFAULT);

  useEffect(() => {
    if (cached) {
      const appliesToWeb =
        cached.homeTheme.isActive &&
        (cached.homeTheme.targetPlatform === "web" || cached.homeTheme.targetPlatform === "both");
      if (appliesToWeb) applyTheme(cached.homeTheme);
      else resetTheme();
      return;
    }
    client.get("/api/app-config").then((res) => {
      const c: AppConfig = {
        emergency: res.data?.emergency ?? DEFAULT.emergency,
        referral:  res.data?.referral  ?? DEFAULT.referral,
        pricing:   res.data?.pricing   ?? DEFAULT.pricing,
        homeTheme: { ...DEFAULT_THEME, ...(res.data?.homeTheme ?? {}) },
        socialLinks: { ...DEFAULT_SOCIAL_LINKS, ...(res.data?.socialLinks ?? {}) },
      };
      cached = c;
      setConfig(c);
      const appliesToWeb =
        c.homeTheme.isActive &&
        (c.homeTheme.targetPlatform === "web" || c.homeTheme.targetPlatform === "both");
      if (appliesToWeb) applyTheme(c.homeTheme);
      else resetTheme();
    }).catch(() => {});
  }, []);

  return config;
}
