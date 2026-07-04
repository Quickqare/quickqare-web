import { useEffect, useMemo, useState } from "react";
import client from "../api/client";

// ─── Types ────────────────────────────────────────────────────────────────────
export type CategoryObj = { _id: string; name: string; slug?: string; imageUrl?: string; webImageUrl?: string };

export type Service = {
  _id: string; name: string; price: number; description?: string;
  imageUrl?: string; webImageUrl?: string;
  category?: CategoryObj | string | null;
  subCategory?: { _id: string; name: string } | string | null;
  duration?: number; isActive?: boolean;
  isHighlighted?: boolean; highlightOrder?: number;
};

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

// Short label for a variant inside its base's picker: "Split AC installation"
// under base "AC installation" → "Split AC". Repair issues keep their own name.
export const variantShortLabel = (variantName: string, baseName: string): string => {
  const lastWord = (baseName.trim().split(/\s+/).pop() || "").toLowerCase();
  if (!lastWord) return variantName;
  const short = variantName.replace(new RegExp(`\\s*${lastWord}\\s*$`, "i"), "").trim();
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
    if (s.price < g.minPrice) g.minPrice = s.price;
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Fetches the service catalog once and groups it by category. Shared by the
// home landing (category cards) and each category page.
export function useServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    client.get("/api/services")
      .then((res) => {
        const raw = res.data;
        const list: Service[] = Array.isArray(raw) ? raw
          : Array.isArray(raw?.services) ? raw.services
          : Array.isArray(raw?.data) ? raw.data : [];
        setServices(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  const categories = useMemo(() => groupIntoCategories(services), [services]);
  return { services, categories, loading };
}
