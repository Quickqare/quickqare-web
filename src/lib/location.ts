import client from "../api/client";

// ─── Location storage helpers ──────────────────────────────────────────────────
// Shared by HomePage (location prompt), BookingModal, and the catalog fetch
// (per-cake "available near you" annotation) — lifted out of HomePage.tsx so
// it can be imported without a HomePage <-> catalog.ts circular import.
const LOC_LABEL_KEY = "qq_web_location";
const LOC_FULL_KEY  = "qq_web_loc_full";

export type SavedLocation = {
  address: string;
  pincode: string;
  latitude: number;
  longitude: number;
  label: string;
};

export function getSavedLocation(): SavedLocation | null {
  try {
    const raw = localStorage.getItem(LOC_FULL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedLocation;
  } catch { return null; }
}

export function persistLocation(loc: SavedLocation) {
  localStorage.setItem(LOC_FULL_KEY, JSON.stringify(loc));
  localStorage.setItem(LOC_LABEL_KEY, loc.label);
}

export function getSavedLocationLabel(): string {
  return localStorage.getItem(LOC_LABEL_KEY) || "";
}

export function setSavedLocationLabel(label: string) {
  localStorage.setItem(LOC_LABEL_KEY, label);
}

export async function geocodePosition(latitude: number, longitude: number): Promise<SavedLocation | null> {
  try {
    // Use the backend Google geocoder (same source as BookingModal and the
    // mobile app) so pincode/serviceability is consistent and we don't hit
    // Nominatim's public-server rate limits / usage policy from the browser.
    const res = await client.get(`/api/maps/reverse?lat=${latitude}&lng=${longitude}`);
    const loc = res.data?.location;
    if (!loc) return null;
    const pincode = String(loc.pincode || "").replace(/\D/g, "").slice(0, 6);
    const address = String(loc.address || "").trim();
    const parts = [loc.area, loc.city].map((p: any) => String(p || "").trim()).filter(Boolean);
    const label = parts.slice(0, 2).join(", ") || address.split(",")[0] || "Your location";
    return { address: address || label, pincode, latitude, longitude, label };
  } catch { return null; }
}
