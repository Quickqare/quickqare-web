import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { useAppConfig } from "../hooks/useAppConfig";
import BookingModal, { CartItem } from "../components/BookingModal";
import { getMehendiPricingKey } from "../utils/mehendiPricing";

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryObj = { _id: string; name: string; slug?: string; imageUrl?: string };
type Service = {
  _id: string; name: string; price: number; description?: string;
  imageUrl?: string; webImageUrl?: string;
  category?: CategoryObj | string | null;
  subCategory?: { _id: string; name: string } | string | null;
  duration?: number; isActive?: boolean;
};
type GroupedCategory = {
  id: string; name: string; slug: string; imageUrl: string;
  services: Service[]; minPrice: number;
};
type Props = { onLoginClick: () => void };

// ─── SVG Icons matching the app ───────────────────────────────────────────────
const AcIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <rect x="1.5" y="2.5" width="25" height="13" rx="2.2" stroke={color} strokeWidth="1.6"/>
    <circle cx="22.5" cy="6" r="1.1" fill={color}/>
    <line x1="3.5" y1="13" x2="18" y2="13" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.55"/>
    <line x1="3.5" y1="10.8" x2="18" y2="10.8" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.55"/>
    <line x1="3.5" y1="8.6" x2="18" y2="8.6" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.55"/>
    <line x1="8" y1="16.5" x2="8" y2="22.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
    <line x1="14" y1="16.5" x2="14" y2="25.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <line x1="20" y1="16.5" x2="20" y2="22.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
  </svg>
);

const PlumbingIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <line x1="5" y1="23" x2="19" y2="7" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="21.5" cy="6.5" r="4.5" stroke={color} strokeWidth="2"/>
    <line x1="4" y1="18" x2="4" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
    <line x1="4" y1="26" x2="12" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
  </svg>
);

const MehendiIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <rect x="4.5" y="5" width="3" height="11" rx="1.5" fill={color}/>
    <rect x="8.5" y="3" width="3" height="13" rx="1.5" fill={color}/>
    <rect x="12.5" y="4" width="3" height="12" rx="1.5" fill={color}/>
    <rect x="16.5" y="7" width="3" height="9" rx="1.5" fill={color}/>
    <rect x="3.5" y="15" width="17" height="10" rx="3" fill={color}/>
    <rect x="12" y="19" width="3" height="3" rx="0.4" fill="white" transform="rotate(45 13.5 20.5)"/>
    <rect x="0" y="17.5" width="3" height="7" rx="1.5" fill={color} transform="rotate(-18 1.5 21)"/>
  </svg>
);

const ElectricianIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="11" stroke={color} strokeWidth="1.6"/>
    <path d="M16 5.5L9.5 14.5H14.5L11 22.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PinIcon = ({ size = 14, color = "white" }: { size?: number; color?: string }) => (
  <svg width={size} height={size * 1.3} viewBox="0 0 14 18" fill="none">
    <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.8"/>
    <circle cx="7" cy="7" r="1.8" fill={color}/>
    <line x1="7" y1="12" x2="7" y2="18" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

const ChevronDown = ({ size = 10, color = "white" }: { size?: number; color?: string }) => (
  <svg width={size} height={size * 0.6} viewBox="0 0 10 6" fill="none">
    <path d="M1 1l4 4 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Category icon map ─────────────────────────────────────────────────────────
const SLUG_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  ac:          AcIcon,
  plumbing:    PlumbingIcon,
  mehendi:     MehendiIcon,
  mehndi:      MehendiIcon,
  electrician: ElectricianIcon,
};

function getCatIcon(slug: string): React.FC<{ size?: number; color?: string }> {
  const key = slug.toLowerCase().replace(/\s+/g, "-");
  if (SLUG_ICONS[key]) return SLUG_ICONS[key];
  for (const k of Object.keys(SLUG_ICONS)) {
    if (key.includes(k) || k.includes(key)) return SLUG_ICONS[k];
  }
  return AcIcon;
}

function catName(raw: Service["category"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw.name ?? "";
}

function catSlug(raw: Service["category"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw.toLowerCase();
  return raw.slug ?? raw.name?.toLowerCase() ?? "";
}

function catImage(raw: Service["category"]): string {
  if (!raw || typeof raw === "string") return "";
  return raw.imageUrl ?? "";
}

function catId(raw: Service["category"]): string {
  if (!raw || typeof raw === "string") return String(raw ?? "");
  return raw._id ?? "";
}

function subCatName(raw: Service["subCategory"]): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  return raw.name ?? "";
}

// Services under a "<base> options" subcategory (e.g. "AC installation options")
// are variants of a base service and are shown nested inside a picker, matching
// the app — not as their own flat cards.
const OPTIONS_SUFFIX = " options";
const isVariantService = (svc: Service): boolean =>
  subCatName(svc.subCategory).trim().toLowerCase().endsWith(OPTIONS_SUFFIX);

// Short label for a variant inside its base's picker: "Split AC installation"
// under base "AC installation" → "Split AC". Repair issues keep their own name.
const variantShortLabel = (variantName: string, baseName: string): string => {
  const lastWord = (baseName.trim().split(/\s+/).pop() || "").toLowerCase();
  if (!lastWord) return variantName;
  const short = variantName.replace(new RegExp(`\\s*${lastWord}\\s*$`, "i"), "").trim();
  return short || variantName;
};

const STEPS = [
  { n: "1", title: "Choose a Service", desc: "Browse categories and pick what you need." },
  { n: "2", title: "Book a Slot", desc: "Select your preferred date and time." },
  { n: "3", title: "Expert Arrives", desc: "A verified professional arrives at your door." },
];

// ─── Location storage helpers ──────────────────────────────────────────────────
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

function persistLocation(loc: SavedLocation) {
  localStorage.setItem(LOC_FULL_KEY, JSON.stringify(loc));
  localStorage.setItem(LOC_LABEL_KEY, loc.label);
}

async function geocodePosition(latitude: number, longitude: number): Promise<SavedLocation | null> {
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

// ─── Location prompt modal ─────────────────────────────────────────────────────
function LocationPromptModal({ onDone }: { onDone: (loc: SavedLocation) => void }) {
  const [step, setStep] = useState<"prompt" | "detecting" | "manual">("prompt");
  const [pincodeInput, setPincodeInput] = useState("");
  const [error, setError] = useState("");

  const handleGps = () => {
    if (!navigator.geolocation) { setError("Location not supported. Enter pincode below."); return; }
    setStep("detecting");
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const loc = await geocodePosition(latitude, longitude);
        if (!loc) {
          setStep("manual");
          setError("Could not detect address. Please enter your pincode.");
          return;
        }
        // Validate serviceability if we got a pincode. Pass the precise GPS
        // coords too so H3 mode matches the exact hub cell instead of the
        // coarser pincode-centroid fallback.
        if (loc.pincode) {
          try {
            const res = await client.get(
              `/api/zones/check?pincode=${loc.pincode}&lat=${latitude}&lng=${longitude}`
            );
            if (!res.data?.serviceable) {
              setStep("manual");
              setError(`Sorry, we don't serve ${loc.label} yet. Enter a nearby pincode!`);
              return;
            }
          } catch { /* network error — allow through */ }
        }
        persistLocation(loc);
        onDone(loc);
      },
      () => { setStep("manual"); setError("Location access denied. Enter your pincode."); }
    );
  };

  const handleManual = async () => {
    const pin = pincodeInput.trim();
    if (!/^\d{6}$/.test(pin)) { setError("Enter a valid 6-digit pincode."); return; }
    setStep("detecting");
    setError("");
    try {
      const res = await client.get(`/api/zones/check?pincode=${pin}`);
      if (!res.data?.serviceable) {
        setStep("manual");
        setError("Sorry, we don't serve this pincode yet. Try a nearby one!");
        return;
      }
    } catch { /* network error — allow through, booking will surface it */ }
    const loc: SavedLocation = { address: pin, pincode: pin, latitude: 0, longitude: 0, label: pin };
    persistLocation(loc);
    onDone(loc);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0A0A0A] px-6 pt-6 pb-5 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <h2 className="text-white font-bold text-lg">Where should we serve you?</h2>
          <p className="text-white/50 text-sm mt-1">We'll show services available in your area</p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {step === "detecting" ? (
            <div className="flex flex-col items-center py-4 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Detecting your location…</p>
            </div>
          ) : (
            <>
              <button
                onClick={handleGps}
                className="w-full flex items-center justify-center gap-2.5 bg-primary text-white font-semibold rounded-xl py-3 text-sm hover:bg-primary/90 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                  <path strokeLinecap="round" strokeWidth="2" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                </svg>
                Use my current location
              </button>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit pincode"
                  value={pincodeInput}
                  onChange={(e) => { setPincodeInput(e.target.value.replace(/\D/g, "")); setError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleManual()}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleManual}
                  className="px-4 py-2.5 bg-[#0A0A0A] text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition"
                >
                  Go
                </button>
              </div>

              {error && <p className="text-red-500 text-xs">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Location hook ─────────────────────────────────────────────────────────────
function useLocation() {
  const [locationText, setLocationText] = useState(() => localStorage.getItem(LOC_LABEL_KEY) || "");
  const [showPicker, setShowPicker] = useState(false);
  const [manualInput, setManualInput] = useState("");

  const applyLocation = (loc: SavedLocation) => {
    setLocationText(loc.label);
  };

  const saveManual = () => {
    const v = manualInput.trim();
    if (!v) return;
    setLocationText(v);
    localStorage.setItem(LOC_LABEL_KEY, v);
    setShowPicker(false);
    setManualInput("");
  };

  return { locationText, showPicker, setShowPicker, manualInput, setManualInput, saveManual, applyLocation };
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function HomePage({ onLoginClick }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [bookingCart, setBookingCart] = useState<CartItem[] | null>(null);
  // When a base service (e.g. "AC installation") has variants, we show a picker
  // to choose the type/issue before booking — same as the app's nested flow.
  const [acPicker, setAcPicker] = useState<{ base: Service; variants: Service[] } | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const { emergency, homeTheme } = useAppConfig();
  const [showLocationPrompt, setShowLocationPrompt] = useState(() => !getSavedLocation());

  // Map category slug → admin-uploaded icon URL (fallback to SVG if empty)
  const getAdminIconUrl = (slug: string): string => {
    const k = slug.toLowerCase();
    const ci = homeTheme.categoryIcons;
    if (k.includes("ac")) return ci.acRepair ?? "";
    if (k.includes("plumb")) return ci.plumbing ?? "";
    if (k.includes("mehend") || k.includes("mehndi")) return ci.mehendi ?? "";
    if (k.includes("electric")) return ci.electrician ?? "";
    return "";
  };

  const renderCatIcon = (slug: string, size: number, color: string) => {
    const url = getAdminIconUrl(slug);
    if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
    const Icon = getCatIcon(slug);
    return <Icon size={size} color={color} />;
  };
  const servicesRef = useRef<HTMLDivElement | null>(null);

  const loc = useLocation();

  useEffect(() => {
    client.get("/api/offers").then((res) => {
      setOffers(Array.isArray(res.data?.offers) ? res.data.offers : []);
    }).catch(() => {});
    client.get("/api/banners?placement=home").then((res) => {
      const rows = Array.isArray(res.data?.banners) ? res.data.banners : [];
      setBanners(rows.filter((b: any) => b.isActive !== false && b.imageUrl));
    }).catch(() => {});
  }, []);

  // Banner auto-rotate — respects per-banner displayDurationSeconds
  useEffect(() => {
    if (banners.length < 2) return;
    const duration = (banners[bannerIndex]?.displayDurationSeconds ?? 5) * 1000;
    const t = setTimeout(() => setBannerIndex((i) => (i + 1) % banners.length), duration);
    return () => clearTimeout(t);
  }, [banners, bannerIndex]);

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

  // Group services by category
  const categories: GroupedCategory[] = React.useMemo(() => {
    const map = new Map<string, GroupedCategory>();
    for (const s of services) {
      const id = catId(s.category) || catName(s.category);
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: catName(s.category),
          slug: catSlug(s.category),
          imageUrl: catImage(s.category),
          services: [],
          minPrice: Infinity,
        });
      }
      const g = map.get(id)!;
      g.services.push(s);
      if (s.price < g.minPrice) g.minPrice = s.price;
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  // Filter by search
  const q = search.toLowerCase();
  const filteredCategories = q
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.services.some(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.description ?? "").toLowerCase().includes(q)
          )
      )
    : categories;

  // Services within selected category (filtered by search)
  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? null;
  const catServices = selectedCat
    ? (q
        ? selectedCat.services.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.description ?? "").toLowerCase().includes(q)
          )
        // Hide variant sub-services (Split/Window AC, repair issues) — they're
        // surfaced nested inside their base service's picker. Kept visible while
        // searching so they remain findable by name.
        : selectedCat.services.filter((s) => !isVariantService(s)))
    : [];

  const handleCatClick = (cat: GroupedCategory) => {
    setSelectedCatId((prev) => (prev === cat.id ? null : cat.id));
    setSearch("");
    setTimeout(() => servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // Variants of a base service = catalog services under its "<name> options"
  // subcategory (e.g. "AC installation" → "Split AC installation", "Window AC
  // installation"). Sorted cheapest-first for a sensible picker order.
  const getVariantsFor = (svc: Service): Service[] => {
    const target = `${svc.name.trim().toLowerCase()}${OPTIONS_SUFFIX}`;
    return services
      .filter((s) => subCatName(s.subCategory).trim().toLowerCase() === target)
      .sort((a, b) => a.price - b.price);
  };

  const proceedToBook = (svc: Service) => {
    if (!user) { onLoginClick(); return; }
    setAcPicker(null);
    setBookingCart([{
      cartKey: svc._id,
      serviceId: svc._id,
      name: svc.name,
      price: svc.price,
      quantity: 1,
      // Mehendi hand designs get tiered per-hand pricing; carrying the key lets
      // the booking modal show a "number of hands" stepper with live pricing.
      pricingKey: getMehendiPricingKey(svc.name),
      category: catName(svc.category),
    }]);
  };

  const handleBookClick = (svc: Service) => {
    const variants = getVariantsFor(svc);
    if (variants.length > 0) {
      // Let the user choose a type/issue first (matches the app). Login is
      // gated at the point they pick and proceed to the booking modal.
      setAcPicker({ base: svc, variants });
      return;
    }
    proceedToBook(svc);
  };

  return (
    <>
      {showLocationPrompt && (
        <LocationPromptModal
          onDone={(savedLoc) => {
            loc.applyLocation(savedLoc);
            setShowLocationPrompt(false);
          }}
        />
      )}

      {/* ── Black header ── */}
      <div className="bg-[#0A0A0A] px-4 pt-5 pb-5">
        <div className="max-w-6xl mx-auto">
          {/* Location row */}
          <button
            onClick={() => loc.setShowPicker(true)}
            className="flex items-center justify-between w-full mb-4 text-left"
          >
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <PinIcon size={11} color="rgba(255,255,255,0.5)"/>
                <span className="text-[9px] tracking-[1.6px] font-bold text-white/40 uppercase">Your Location</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-base tracking-tight leading-tight">
                  {loc.locationText}
                </span>
                <ChevronDown size={10} color="white"/>
              </div>
            </div>
          </button>

          {/* Search bar */}
          <div className="flex items-center gap-3 bg-[#1C1C1C] rounded-xl px-4 h-12">
            <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              placeholder="Search services…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedCatId(null); }}
              className="flex-1 bg-transparent text-white text-sm placeholder-gray-500 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-gray-500 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="bg-bg min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-6">

          {/* Emergency banner */}
          {(emergency.emergencyLockdown || emergency.bookingsDisabled || emergency.paymentsFreezed) && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5 flex items-center gap-3">
              <span className="text-xl shrink-0">🚫</span>
              <p className="text-sm font-semibold text-red-700">
                {emergency.emergencyLockdown
                  ? "Platform is under maintenance. Please try again later."
                  : emergency.bookingsDisabled
                  ? "Bookings are temporarily unavailable. Please try again later."
                  : "Payments are temporarily frozen. Please try again later."}
              </p>
            </div>
          )}

          {/* Banner carousel */}
          {banners.length > 0 && (
            <div className="relative w-full rounded-2xl overflow-hidden mb-5" style={{ aspectRatio: "3/1" }}>
              {banners.map((b, i) => {
                const inner = (
                  <>
                    <img src={b.imageUrl} alt={b.title || ""} className="w-full h-full object-cover" />
                    {b.title && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                        <p className="text-white font-bold text-base">{b.title}</p>
                      </div>
                    )}
                  </>
                );
                return (
                  <div
                    key={b._id}
                    className={`absolute inset-0 transition-opacity duration-700 ${i === bannerIndex ? "opacity-100" : "opacity-0"}`}
                  >
                    {b.linkUrl ? (
                      <a href={b.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                        {inner}
                      </a>
                    ) : inner}
                  </div>
                );
              })}
              {banners.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {banners.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setBannerIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === bannerIndex ? "bg-white w-4" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category icon quick-row */}
          <h2 className="text-[17px] font-extrabold text-ink tracking-tight mb-4">What do you need?</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {loading
              ? [1,2,3,4].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-gray-200 animate-pulse"/>
                    <div className="h-2.5 w-12 bg-gray-200 rounded animate-pulse"/>
                  </div>
                ))
              : filteredCategories.map((cat) => {
                  const active = selectedCatId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCatClick(cat)}
                      className="flex flex-col items-center gap-2 shrink-0 w-[72px] group"
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        active ? "bg-ink shadow-lg scale-110" : "bg-white shadow-sm hover:-translate-y-2 hover:scale-110 hover:shadow-md"
                      }`}>
                        {renderCatIcon(cat.slug, 26, active ? "#FFFFFF" : "#0A0A0A")}
                      </div>
                      <span className={`text-[11px] font-bold text-center leading-tight tracking-tight transition-colors ${
                        active ? "text-ink" : "text-[#6B7280] group-hover:text-ink"
                      }`}>
                        {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                      </span>
                    </button>
                  );
                })
            }
          </div>

          {/* ── Trust pillars ── */}
          {!search && (
            <div className="flex gap-2.5 mt-5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { icon: "✓", label: "Verified Pros" },
                { icon: "⚡", label: "2hr Response" },
                { icon: "🔒", label: "Secure Pay" },
                { icon: "★", label: "4.8 Rated" },
              ].map((t) => (
                <div key={t.label} className="flex items-center gap-1.5 shrink-0 bg-white border border-gray-100 rounded-full px-3.5 py-1.5 shadow-sm">
                  <span className="text-primary text-xs font-bold">{t.icon}</span>
                  <span className="text-[11px] font-semibold text-ink whitespace-nowrap">{t.label}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Offers section ── */}
          {offers.length > 0 && !search && (
            <div className="mt-6">
              <h2 className="text-[17px] font-extrabold text-ink tracking-tight mb-3">Offers & Deals</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {offers.map((offer) => {
                  const isBundle = offer.type === "bundle";
                  const isCoupon = offer.type === "coupon";
                  const accentColor = isBundle ? "#22A06B" : isCoupon ? "#7C3AED" : "#2563EB";
                  const bgColor = isBundle ? "#F0FDF4" : isCoupon ? "#F5F3FF" : "#EFF6FF";
                  const borderColor = isBundle ? "#BBF7D0" : isCoupon ? "#DDD6FE" : "#BFDBFE";
                  const savings = isBundle && offer.originalPrice && offer.bundlePrice
                    ? offer.originalPrice - offer.bundlePrice : null;

                  return (
                    <div
                      key={offer._id}
                      className="shrink-0 w-64 rounded-2xl border flex overflow-hidden"
                      style={{ backgroundColor: bgColor, borderColor }}
                    >
                      {/* Accent strip */}
                      <div className="w-1 shrink-0" style={{ backgroundColor: accentColor }} />

                      <div className="p-3.5 flex-1">
                        {/* Title row */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="font-bold text-[13px] text-ink leading-snug flex-1">{offer.title}</p>
                          {offer.badgeText && (
                            <span
                              className="text-white text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                              style={{ backgroundColor: offer.badgeColor || accentColor }}
                            >
                              {offer.badgeText}
                            </span>
                          )}
                        </div>

                        {offer.tagline && (
                          <p className="text-[11px] text-muted mb-2">{offer.tagline}</p>
                        )}

                        {/* Bundle pricing */}
                        {isBundle && offer.bundlePrice != null && (
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="font-extrabold text-base" style={{ color: accentColor }}>₹{offer.bundlePrice}</span>
                            {offer.originalPrice != null && (
                              <span className="text-xs text-muted line-through">₹{offer.originalPrice}</span>
                            )}
                            {savings != null && savings > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: accentColor + "20", color: accentColor }}>
                                Save ₹{savings}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Coupon code box */}
                        {isCoupon && offer.couponCode && (
                          <div
                            className="flex items-center justify-center rounded-lg border border-dashed py-2 mb-2"
                            style={{ borderColor: accentColor + "60", backgroundColor: accentColor + "10" }}
                          >
                            <span className="font-extrabold text-sm tracking-widest" style={{ color: accentColor }}>
                              {offer.couponCode}
                            </span>
                          </div>
                        )}

                        {/* Info description */}
                        {!isBundle && !isCoupon && offer.description && (
                          <p className="text-[11px] text-muted leading-relaxed line-clamp-2 mb-1">{offer.description}</p>
                        )}

                        {isCoupon && (
                          <p className="text-[10px] text-muted">Apply this code at checkout</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Category cards / service list ── */}
          <h2 ref={servicesRef} className="text-[17px] font-extrabold text-ink tracking-tight mt-7 mb-4">
            {selectedCat ? selectedCat.name.charAt(0).toUpperCase() + selectedCat.name.slice(1) : "Popular Services"}
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="w-full aspect-[16/9] bg-gray-200"/>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/>
                    <div className="h-3 bg-gray-100 rounded w-1/2"/>
                  </div>
                </div>
              ))}
            </div>
          ) : !selectedCat ? (
            /* ── Category cards ── */
            filteredCategories.length === 0 ? (
              <div className="text-center py-16 text-muted">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-ink">No results for "{search}"</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredCategories.map((cat, index) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCatClick(cat)}
                    className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 text-left group"
                  >
                    <div className="relative w-full aspect-[16/9] bg-gray-100 overflow-hidden">
                      {cat.imageUrl ? (
                        <img
                          src={cat.imageUrl}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50">
                          {renderCatIcon(cat.slug, 64, "#D1D5DB")}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"/>
                      {index < 2 && (
                        <div className="absolute top-2 left-2 bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase">
                          Popular
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-0.5 rounded-full">
                        {cat.services.length} service{cat.services.length !== 1 ? "s" : ""}
                      </div>
                      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-end justify-between">
                        <div>
                          <p className="text-white font-extrabold text-[13px] tracking-tight leading-tight capitalize drop-shadow-sm">
                            {cat.name}
                          </p>
                          <p className="text-white/70 text-[10px] mt-0.5">
                            from ₹{cat.minPrice === Infinity ? "—" : cat.minPrice}
                          </p>
                        </div>
                        <div className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/40 transition-colors">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* ── Individual services within selected category ── */
            <>
              <button
                onClick={() => setSelectedCatId(null)}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-5 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
                All Categories
              </button>

              {catServices.length === 0 ? (
                <div className="text-center py-12 text-muted">
                  <p className="text-4xl mb-3">🔍</p>
                  <p>No services found</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {catServices.map((svc) => {
                    const img = (svc.webImageUrl?.trim() || svc.imageUrl?.trim() || "");
                    const variants = getVariantsFor(svc);
                    const fromPrice = variants.length ? variants[0].price : svc.price;
                    return (
                      <div key={svc._id} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col group">
                        <div className="relative w-full aspect-[3/2] bg-gray-50 overflow-hidden shrink-0">
                          {img ? (
                            <img
                              src={img}
                              alt={svc.name}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => {
                                const el = e.target as HTMLImageElement;
                                el.style.display = "none";
                                el.nextElementSibling?.classList.remove("hidden");
                              }}
                            />
                          ) : null}
                          <div className={`absolute inset-0 flex items-center justify-center ${img ? "hidden" : ""}`}>
                            {renderCatIcon(catSlug(svc.category), 52, "#D1D5DB")}
                          </div>
                          {svc.duration && (
                            <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                              ⏱ {svc.duration} min
                            </div>
                          )}
                        </div>
                        <div className="p-3 flex flex-col flex-1">
                          {svc.subCategory && typeof svc.subCategory === "object" && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1">
                              {svc.subCategory.name}
                            </span>
                          )}
                          <h3 className="font-bold text-ink text-[13px] tracking-tight leading-snug mb-0.5">{svc.name}</h3>
                          {svc.description && (
                            <p className="text-[11px] text-muted line-clamp-2 leading-relaxed flex-1 mb-2">{svc.description}</p>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t border-border mt-auto">
                            <div>
                              <span className="text-[10px] text-muted">from </span>
                              <span className="font-extrabold text-ink text-sm">₹{fromPrice}</span>
                              {variants.length > 0 && (
                                <span className="block text-[9px] text-primary font-semibold">
                                  {variants.length} option{variants.length > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleBookClick(svc)}
                              className="btn-primary text-xs px-3 py-1.5"
                            >
                              {variants.length > 0 ? "Choose" : "Book"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── How it works ── */}
          {!selectedCat && !search && (
            <div className="mt-12">
              <h2 className="text-[17px] font-extrabold text-ink tracking-tight mb-6">How It Works</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {STEPS.map((s) => (
                  <div key={s.n} className="bg-white rounded-3xl p-5 flex items-start gap-4 shadow-[0_2px_20px_rgba(0,0,0,0.05)]">
                    <div className="w-9 h-9 rounded-full bg-ink text-white font-bold text-sm flex items-center justify-center shrink-0">
                      {s.n}
                    </div>
                    <div>
                      <p className="font-bold text-ink text-sm mb-1">{s.title}</p>
                      <p className="text-xs text-muted leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── CTA for guests ── */}
          {!user && !selectedCat && !search && (
            <div className="mt-8 bg-ink rounded-3xl p-7 text-center shadow-[0_8px_40px_rgba(0,0,0,0.14)]">
              <p className="text-white font-bold text-lg mb-1">Ready to book?</p>
              <p className="text-white/50 text-sm mb-4">Login with your phone and book in under a minute.</p>
              <button onClick={onLoginClick} className="btn-primary px-8">
                Get Started — It's Free
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border py-6 px-4 mt-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted">
            <span>© {new Date().getFullYear()} QuickQare. All rights reserved.</span>
            <div className="flex items-center gap-5">
              <Link to="/privacy-policy" className="hover:text-ink transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-ink transition-colors">Terms & Conditions</Link>
              <Link to="/refund-policy" className="hover:text-ink transition-colors">Refund Policy</Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── AC option picker (Split/Window, repair issue) ── */}
      {acPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setAcPicker(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-bold text-ink text-sm">{acPicker.base.name}</h3>
                <p className="text-xs text-muted mt-0.5">
                  {acPicker.base.name.toLowerCase().includes("repair")
                    ? "Choose the issue you're facing"
                    : "Choose a type"}
                </p>
              </div>
              <button
                onClick={() => setAcPicker(null)}
                className="text-gray-400 hover:text-ink text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              {acPicker.variants.map((v) => (
                <div
                  key={v._id}
                  className="flex items-start justify-between gap-4 border border-border rounded-xl p-3.5 hover:border-primary transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink text-sm">
                      {variantShortLabel(v.name, acPicker.base.name)}
                    </p>
                    {v.description && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">{v.description}</p>
                    )}
                    <p className="text-xs font-bold text-ink mt-1">
                      ₹{v.price}
                      {v.duration && <span className="text-muted font-normal"> · {v.duration} min</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => proceedToBook(v)}
                    className="shrink-0 self-center text-xs font-bold text-primary border border-primary rounded-lg px-4 py-2 hover:bg-primary hover:text-white transition"
                  >
                    Book
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Booking modal ── */}
      {bookingCart && (
        <BookingModal
          cart={bookingCart}
          onClose={() => setBookingCart(null)}
          onSuccess={(bookingId) => {
            setBookingCart(null);
            navigate(`/bookings/${bookingId}`);
          }}
        />
      )}

      {/* ── Location picker modal ── */}
      {loc.showPicker && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="card w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink">Set Location</h3>
              <button onClick={() => loc.setShowPicker(false)} className="text-gray-400 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <input
              className="input mb-3"
              placeholder="Enter your area, colony, city…"
              value={loc.manualInput}
              onChange={(e) => loc.setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loc.saveManual()}
              autoFocus
            />
            <button className="btn-primary w-full" onClick={loc.saveManual}>
              Save Location
            </button>
          </div>
        </div>
      )}

    </>
  );
}
