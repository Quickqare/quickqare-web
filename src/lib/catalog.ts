import { useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { getSavedLocation, onLocationChanged } from "./location";

// ─── Types ────────────────────────────────────────────────────────────────────
export type CategoryObj = { _id: string; name: string; slug?: string; imageUrl?: string; webImageUrl?: string };

export type CakeWeight = { label: string; priceDelta: number };
export type CakeFlavour = { name: string; priceDelta: number };
export type CakeAddon = { name: string; price: number };
export type ServiceCustomization = {
  weights: CakeWeight[];
  flavours: CakeFlavour[];
  twoTierPriceDelta: number;
  // Extra charge when the customer picks the eggless option (0 = no extra charge).
  egglessPriceDelta?: number;
  addons: CakeAddon[];
  nameOnCakeEnabled: boolean;
  // Per-section admin toggles — undefined means enabled (older records).
  // When flavoursEnabled is false the first flavour applies as the fixed default.
  flavoursEnabled?: boolean;
  weightsEnabled?: boolean;
  tiersEnabled?: boolean;
  addonsEnabled?: boolean;
  referencePhotoEnabled?: boolean;
  egglessOptionEnabled?: boolean;
};

export type Service = {
  _id: string; name: string; price: number; description?: string;
  imageUrl?: string; webImageUrl?: string;
  category?: CategoryObj | string | null;
  subCategory?: { _id: string; name: string } | string | null;
  duration?: number; isActive?: boolean;
  isHighlighted?: boolean; highlightOrder?: number;
  // Cake (Celebration) fields
  customization?: ServiceCustomization | null;
  ingredients?: string[];
  media360?: string[];
  // Web-only photo gallery (admin uploads separately from the app's media360).
  webMedia360?: string[];
  // Admin toggle: false = app gallery photos don't auto-rotate (app only).
  autoSlideEnabled?: boolean;
  // Seconds each photo stays before sliding to the next, app only (default 3).
  autoSlideSeconds?: number;
  // Same as above, but for the web card carousel — controlled independently.
  webAutoSlideEnabled?: boolean;
  webAutoSlideSeconds?: number;
  minLeadDays?: number;
  isEggless?: boolean;
  cancellationPolicyType?: "BEFORE_SERVICE" | "SINCE_BOOKING";
  sinceBookingTiers?: { maxHoursAfterBooking: number; refundPercent: number }[];
  cancellationTiers?: { minHoursBefore: number; refundPercent: number }[];
  // Free-cancel window for orders placed with under appliesBelowLeadHours of
  // notice (see utils/cancellationPolicyText.getGraceLine).
  cancellationGrace?: { windowMinutes?: number; appliesBelowLeadHours?: number } | null;
  // Set server-side only for cake/Celebration services, only when the
  // customer's location is known — whether a baker covering their area has
  // declared they can make this specific cake. Undefined = unknown/not
  // computed (no location yet, or not a cake service) — never treat as false.
  availableNearby?: boolean;
};

// A cake-style service: customization options configured by the admin.
export const isCakeService = (svc: Service): boolean =>
  Boolean(svc.customization?.flavours && svc.customization.flavours.length > 0);

export type GroupedCategory = {
  id: string; name: string; slug: string; imageUrl: string;
  services: Service[]; minPrice: number;
};

// ─── Category field accessors (category/subCategory can be object or string) ───
export function catName(raw: Service["category"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw.name ?? "";
}
export function catSlug(raw: Service["category"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw.toLowerCase();
  return raw.slug ?? raw.name?.toLowerCase() ?? "";
}
export function catImage(raw: Service["category"]): string {
  if (!raw || typeof raw === "string") return "";
  return raw.webImageUrl?.trim() || raw.imageUrl || "";
}
export function catId(raw: Service["category"]): string {
  if (!raw || typeof raw === "string") return String(raw ?? "");
  return raw._id ?? "";
}
export function subCatName(raw: Service["subCategory"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw.name ?? "";
}

// URL-safe slug used for /category/:slug routing and matching.
export const toUrlSlug = (cat: { slug?: string; name: string }): string =>
  (cat.slug || cat.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ─── Variant sub-services ─────────────────────────────────────────────────────
// Services under a "<base> options" subcategory (e.g. "AC installation options")
// are variants of a base service and are shown nested inside a picker, matching
// the app — not as their own flat cards.
export const OPTIONS_SUFFIX = " options";
export const isVariantService = (svc: Service): boolean =>
  subCatName(svc.subCategory).trim().toLowerCase().endsWith(OPTIONS_SUFFIX);

// Service names are free text typed by an admin, so any character can show up in
// one. Interpolating that straight into a RegExp turns a name like "AC Repair +"
// into the pattern /\s*+\s*$/ — a SyntaxError that crashes the whole category
// render — while "(Split)" would silently strip the wrong text.
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Short label for a variant inside its base's picker: "Split AC installation"
// under base "AC installation" → "Split AC". Repair issues keep their own name.
export const variantShortLabel = (variantName: string, baseName: string): string => {
  const lastWord = (baseName.trim().split(/\s+/).pop() || "").toLowerCase();
  if (!lastWord) return variantName;
  const short = variantName.replace(new RegExp(`\\s*${escapeRegExp(lastWord)}\\s*$`, "i"), "").trim();
  return short || variantName;
};

// ─── Grouping + data hook ─────────────────────────────────────────────────────
export function groupIntoCategories(services: Service[]): GroupedCategory[] {
  const map = new Map<string, GroupedCategory>();
  for (const s of services) {
    const id = catId(s.category) || catName(s.category);
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, {
        id, name: catName(s.category), slug: catSlug(s.category),
        imageUrl: catImage(s.category), services: [], minPrice: Infinity,
      });
    }
    const g = map.get(id)!;
    g.services.push(s);
    if (s.isActive !== false && s.price < g.minPrice) g.minPrice = s.price;
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Fetches the service catalog and groups it by category. Shared by the home
// landing (category cards) and each category page. Refetches whenever the
// saved location changes (first-run prompt, header picker) so location-scoped
// fields like `availableNearby` are computed for where the customer actually
// is — the catalog used to be fetched exactly once per mount, which both
// missed the first-run prompt resolving and ignored later location changes.
export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const fetchServices = () => {
      const loc = getSavedLocation();
      const params = new URLSearchParams();
      params.set("includeInactive", "true");
      if (loc?.pincode) params.set("pincode", loc.pincode);
      if (loc?.latitude) params.set("lat", String(loc.latitude));
      if (loc?.longitude) params.set("lng", String(loc.longitude));
      const qs = params.toString();
      client.get(`/api/services${qs ? `?${qs}` : ""}`)
        .then((res) => {
          if (cancelled) return;
          const raw = res.data;
          const list: Service[] = Array.isArray(raw) ? raw
            : Array.isArray(raw?.services) ? raw.services
            : Array.isArray(raw?.data) ? raw.data : [];
          setServices(list);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    fetchServices();
    const unsubscribe = onLocationChanged(fetchServices);
    return () => { cancelled = true; unsubscribe(); };
  }, []);
  const categories = useMemo(() => groupIntoCategories(services), [services]);
  return { services, categories, loading };
}
