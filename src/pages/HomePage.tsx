import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { useAppConfig, SocialLinks } from "../hooks/useAppConfig";
import { CategoryIcon } from "../components/CategoryIcon";
import { GroupedCategory, Service, isVariantService, toUrlSlug, useServices } from "../lib/catalog";

type Props = { onLoginClick: () => void };

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

// ─── Social icons ───────────────────────────────────────────────────────────────
const WhatsAppIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.35c1.37.73 2.94 1.15 4.62 1.15h.01c5.46 0 9.9-4.45 9.9-9.9C21.95 6.45 17.5 2 12.04 2zm5.72 14.13c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.12-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.14-.28.28-.12.56.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.27.14.45.2.51.31.07.12.07.66-.17 1.34z"/>
  </svg>
);
const InstagramIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke={color} strokeWidth="1.8"/>
    <circle cx="12" cy="12" r="4.3" stroke={color} strokeWidth="1.8"/>
    <circle cx="17.4" cy="6.6" r="1.15" fill={color}/>
  </svg>
);
const FacebookIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M15.12 8.5H13V7c0-.75.5-.93.85-.93h1.22V3.6L13.06 3.6C10.68 3.6 10.1 5.36 10.1 6.86V8.5H8.3v3h1.8V21h2.9v-9.5h2.09l.33-3z"/>
  </svg>
);
const XIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.24 3H21l-6.35 7.26L22 21h-6.24l-4.88-6.4L5.3 21H2.5l6.8-7.77L2 3h6.4l4.4 5.86L18.24 3zm-1.1 16h1.53L7 4.9H5.36L17.14 19z"/>
  </svg>
);
const YouTubeIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M22 12c0-2.1-.2-3.5-.4-4.2-.3-.8-.9-1.4-1.7-1.7C18.8 5.7 12 5.7 12 5.7s-6.8 0-7.9.4c-.8.3-1.4.9-1.7 1.7C2.2 8.5 2 9.9 2 12s.2 3.5.4 4.2c.3.8.9 1.4 1.7 1.7 1.1.4 7.9.4 7.9.4s6.8 0 7.9-.4c.8-.3 1.4-.9 1.7-1.7.2-.7.4-2.1.4-4.2zM10 15.2V8.8l5.5 3.2-5.5 3.2z"/>
  </svg>
);

const SOCIAL_ICON_MAP: Record<
  keyof SocialLinks,
  { Icon: React.FC<{ size?: number; color?: string }>; label: string }
> = {
  whatsapp:  { Icon: WhatsAppIcon,  label: "WhatsApp" },
  instagram: { Icon: InstagramIcon, label: "Instagram" },
  facebook:  { Icon: FacebookIcon,  label: "Facebook" },
  twitter:   { Icon: XIcon,         label: "X" },
  youtube:   { Icon: YouTubeIcon,   label: "YouTube" },
};

// ─── Built-in default promo slides ───────────────────────────────────────────
// Shown in the home banner slot when no admin banner is active (and the admin
// hasn't disabled it). Pure CSS gradients + line-art motifs — no image needed.
type BannerMotifKind = "home" | "shield" | "paisley";
const DEFAULT_BANNER_SLIDES: {
  badge: string; title: string; subtitle: string; cta: string;
  gradient: string; glow: string; motif: BannerMotifKind;
}[] = [
  {
    badge: "QuickQare",
    title: "Home services, sorted.",
    subtitle: "AC care, mehendi, plumbing & more — booked in minutes, at your door in hours.",
    cta: "Explore services",
    gradient: "linear-gradient(115deg,#053826 0%,#0c6b49 52%,#17a06a 100%)",
    glow: "radial-gradient(closest-side, rgba(255,255,255,.28), rgba(255,255,255,0) 72%)",
    motif: "home",
  },
  {
    badge: "Why QuickQare",
    title: "Verified pros. 2-hour response.",
    subtitle: "Background-checked experts, secure payments and upfront pricing — every booking.",
    cta: "See how it works",
    gradient: "linear-gradient(115deg,#07100c 0%,#0e2019 55%,#123f2d 100%)",
    glow: "radial-gradient(closest-side, rgba(23,160,106,.4), rgba(23,160,106,0) 72%)",
    motif: "shield",
  },
  {
    badge: "Festive ready",
    title: "Bridal mehendi, at home.",
    subtitle: "Organic cones and intricate designs — choose your length and number of hands at checkout.",
    cta: "Book mehendi",
    gradient: "linear-gradient(115deg,#4e1a0e 0%,#8a3714 55%,#c06a22 100%)",
    glow: "radial-gradient(closest-side, rgba(255,214,170,.4), rgba(255,214,170,0) 72%)",
    motif: "paisley",
  },
];

// Fine grain overlay (data-URI) that keeps the gradients from reading flat.
const BANNER_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const BannerMotif = ({ kind }: { kind: BannerMotifKind }) => {
  const common = {
    className: "absolute right-[-10px] top-1/2 -translate-y-1/2 w-[46%] max-w-[300px] text-white opacity-[0.16] pointer-events-none z-[2]",
    viewBox: "0 0 200 200",
    fill: "none" as const,
    "aria-hidden": true,
  };
  if (kind === "home") return (
    <svg {...common}>
      <path d="M28 96 100 40l72 56" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M46 88v70h108V88" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M86 158v-40h28v40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M150 44c14 6 20 20 14 32M158 30c22 9 30 32 20 51" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
    </svg>
  );
  if (kind === "shield") return (
    <svg {...common}>
      <path d="M100 26l58 22v42c0 40-26 66-58 84-32-18-58-44-58-84V48z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round"/>
      <path d="M74 100l18 18 36-40" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg {...common}>
      <path d="M112 168c-40-8-70-40-70-78 0-26 18-46 40-46 18 0 30 14 30 30 0 14-10 24-22 24-9 0-16-6-16-15" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="104" cy="70" r="7" stroke="currentColor" strokeWidth="4"/>
      <path d="M112 168c6-2 40-16 40-58" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="2 12"/>
      <circle cx="150" cy="120" r="3" fill="currentColor"/><circle cx="150" cy="98" r="3" fill="currentColor"/>
    </svg>
  );
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
  const { categories, loading } = useServices();
  const [search, setSearch] = useState("");
  const [offers, setOffers] = useState<any[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [bannerIndex, setBannerIndex] = useState(0);
  const { emergency, socialLinks, defaultBannerEnabled } = useAppConfig();
  const activeSocialLinks = (Object.keys(SOCIAL_ICON_MAP) as (keyof SocialLinks)[])
    .map((key) => ({ key, url: socialLinks[key].trim(), ...SOCIAL_ICON_MAP[key] }))
    .filter((s) => s.url);
  const [showLocationPrompt, setShowLocationPrompt] = useState(() => !getSavedLocation());

  // Ref on the "Popular Services" heading so the promo banner CTA can scroll to it.
  const servicesRef = useRef<HTMLDivElement | null>(null);

  const loc = useLocation();

  useEffect(() => {
    client.get("/api/offers").then((res) => {
      setOffers(Array.isArray(res.data?.offers) ? res.data.offers : []);
    }).catch(() => {});
    client.get("/api/banners?placement=home&platform=web").then((res) => {
      const rows = Array.isArray(res.data?.banners) ? res.data.banners : [];
      setBanners(rows.filter((b: any) => b.isActive !== false && b.imageUrl));
    }).catch(() => {});
  }, []);

  // Fall back to the built-in promo slides when there are no admin banners
  // (unless the admin turned the default banner off).
  const showDefaultBanner = banners.length === 0 && defaultBannerEnabled;

  // Banner auto-rotate — respects per-banner displayDurationSeconds for admin
  // banners; default promo slides rotate on a fixed 5s cadence.
  useEffect(() => {
    const count = banners.length > 0
      ? banners.length
      : (showDefaultBanner ? DEFAULT_BANNER_SLIDES.length : 0);
    if (count < 2) return;
    const duration = banners.length > 0 ? (banners[bannerIndex]?.displayDurationSeconds ?? 5) * 1000 : 5000;
    const t = setTimeout(() => setBannerIndex((i) => (i + 1) % count), duration);
    return () => clearTimeout(t);
  }, [banners, bannerIndex, showDefaultBanner]);

  // Filter categories by search
  const q = search.toLowerCase();
  const filteredCategories: GroupedCategory[] = q
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

  // Individual services matching the search — surfaced as direct results so a
  // query like "ac" shows "AC repair", "No cooling", "Window AC", etc., not
  // just the category card.
  const serviceResults: { svc: Service; cat: GroupedCategory }[] = q
    ? categories.flatMap((cat) =>
        cat.services
          .filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              (s.description ?? "").toLowerCase().includes(q)
          )
          .map((svc) => ({ svc, cat }))
      )
    : [];

  // "Highlights" — services the admin has flagged as highlighted (isHighlighted)
  // in the admin panel, ordered by highlightOrder then price. Capped at 4.
  // Skipped while searching since serviceResults covers that case.
  const HIGHLIGHTS_MAX = 4;
  const topServices: { svc: Service; cat: GroupedCategory }[] = search
    ? []
    : categories
        .flatMap((cat) => cat.services.map((svc) => ({ svc, cat })))
        .filter(({ svc }) => svc.isHighlighted && !isVariantService(svc))
        .sort(
          (a, b) =>
            (a.svc.highlightOrder ?? 0) - (b.svc.highlightOrder ?? 0) ||
            a.svc.price - b.svc.price
        )
        .slice(0, HIGHLIGHTS_MAX);

  // Each category opens its own page.
  const openCategory = (cat: GroupedCategory) => navigate(`/category/${toUrlSlug(cat)}`);

  // A service result deep-links into its category page, which scrolls to the
  // service card (or opens the variant picker for nested options).
  const openService = (svc: Service, cat: GroupedCategory) =>
    navigate(`/category/${toUrlSlug(cat)}?service=${svc._id}`);

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
              onChange={(e) => setSearch(e.target.value)}
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

          {/* ── Banner (top of page): admin carousel, else default promo ── */}
          {/* Banner carousel — admin-managed ads/offers, auto-rotating */}
          {banners.length > 0 && !search && (
            <div className="relative w-full lg:w-[calc(100%+2rem)] lg:-mx-4 xl:w-[calc(100%+5rem)] xl:-mx-10 rounded-2xl overflow-hidden mb-6" style={{ aspectRatio: "3/1" }}>
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

          {/* Default promo banner — shown when no admin banner is active. Admin
              can disable it from Settings. Gradients + line-art motifs, no image. */}
          {showDefaultBanner && !search && (
            <div className="relative w-full lg:w-[calc(100%+2rem)] lg:-mx-4 xl:w-[calc(100%+5rem)] xl:-mx-10 rounded-2xl overflow-hidden mb-6 h-[180px] sm:h-[210px] isolate">
              {DEFAULT_BANNER_SLIDES.map((s, i) => {
                const on = i === (bannerIndex % DEFAULT_BANNER_SLIDES.length);
                return (
                  <div
                    key={i}
                    className={`absolute inset-0 flex items-center transition-opacity duration-700 ${on ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                    style={{ background: s.gradient }}
                  >
                    {/* soft off-axis glow */}
                    <div className="absolute z-[1] w-[60%] h-[150%] right-[-8%] top-[-30%] pointer-events-none" style={{ background: s.glow }} />
                    {/* fine grain */}
                    <div className="absolute inset-0 z-[2] opacity-[0.07] mix-blend-overlay pointer-events-none" style={{ backgroundImage: BANNER_GRAIN }} />
                    <BannerMotif kind={s.motif} />

                    <div
                      key={on ? `on-${bannerIndex}` : `off-${i}`}
                      className={`relative z-[3] px-5 sm:px-9 max-w-[80%] ${on ? "qq-banner-rise" : ""}`}
                    >
                      <span
                        className="inline-block text-[9px] sm:text-[10px] font-extrabold tracking-[0.16em] text-white uppercase bg-white/[0.18] border border-white/25 px-2.5 py-1 rounded-full mb-3"
                        style={{ animationDelay: "0.04s" }}
                      >
                        {s.badge}
                      </span>
                      <h3
                        className="text-white font-extrabold text-xl sm:text-[32px] leading-[1.03] tracking-[-0.035em] text-balance"
                        style={{ animationDelay: "0.10s", textShadow: "0 2px 20px rgba(0,0,0,.18)" }}
                      >
                        {s.title}
                      </h3>
                      <p
                        className="text-white/90 text-[11.5px] sm:text-sm mt-1.5 leading-snug max-w-[42ch] line-clamp-2"
                        style={{ animationDelay: "0.16s" }}
                      >
                        {s.subtitle}
                      </p>
                      <button
                        onClick={() => servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="group mt-3.5 inline-flex items-center gap-1.5 bg-white text-ink text-[11.5px] sm:text-[13px] font-extrabold px-4 py-2 rounded-full shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)] hover:bg-white/95 transition"
                        style={{ animationDelay: "0.22s" }}
                      >
                        {s.cta}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-0.5">
                          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* progress bar (keyed to restart the fill each slide) */}
              <div className="absolute left-0 bottom-0 z-[4] h-[3px] w-full bg-white/20">
                <div key={bannerIndex} className="h-full bg-white/85 qq-banner-fill" />
              </div>
              {/* dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[4] flex gap-1.5">
                {DEFAULT_BANNER_SLIDES.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setBannerIndex(i)}
                    aria-label={`Show slide ${i + 1}`}
                    className={`h-[7px] rounded-full transition-all ${i === (bannerIndex % DEFAULT_BANNER_SLIDES.length) ? "w-5 bg-white" : "w-[7px] bg-white/50"}`}
                  />
                ))}
              </div>
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
              : filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => openCategory(cat)}
                    className="flex flex-col items-center gap-2 shrink-0 w-[72px] group"
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white shadow-sm transition-all duration-300 hover:-translate-y-2 hover:scale-110 hover:shadow-md">
                      <CategoryIcon slug={cat.slug} size={26} color="#0A0A0A" />
                    </div>
                    <span className="text-[11px] font-bold text-center leading-tight tracking-tight text-[#6B7280] group-hover:text-ink transition-colors">
                      {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
                    </span>
                  </button>
                ))
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

          {/* ── Category cards ── */}
          <h2 ref={servicesRef} className="text-[17px] font-extrabold text-ink tracking-tight mt-7 mb-4">
            {search ? "Results" : "Popular Services"}
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                  <div className="w-full aspect-[4/3] bg-gray-200"/>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/>
                    <div className="h-3 bg-gray-100 rounded w-1/2"/>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCategories.length === 0 && serviceResults.length === 0 ? (
            <div className="text-center py-16 text-muted">
              <p className="text-4xl mb-3">🔍</p>
              <p className="font-semibold text-ink">No results for "{search}"</p>
            </div>
          ) : (
            <>
            {/* Matching individual services */}
            {search && serviceResults.length > 0 && (
              <div className="mb-6">
                <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-2.5">Services</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {serviceResults.map(({ svc, cat }) => {
                    const img = (svc.webImageUrl?.trim() || svc.imageUrl?.trim() || "");
                    return (
                      <button
                        key={svc._id}
                        onClick={() => openService(svc, cat)}
                        className="bg-white rounded-2xl p-3 flex items-center gap-3 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 group"
                      >
                        <div className="w-14 h-14 rounded-xl bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                          {img ? (
                            <img
                              src={img}
                              alt={svc.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          ) : (
                            <CategoryIcon slug={cat.slug} size={24} color="#9CA3AF" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-ink text-[13px] tracking-tight leading-snug truncate">{svc.name}</p>
                          <p className="text-[10px] text-muted capitalize truncate">{cat.name}</p>
                          <p className="text-xs font-extrabold text-ink mt-0.5">₹{svc.price}</p>
                        </div>
                        <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-ink transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredCategories.length > 0 && (
              <>
              {search && serviceResults.length > 0 && (
                <p className="text-[11px] font-bold text-muted uppercase tracking-widest mb-2.5">Categories</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredCategories.map((cat, index) => (
                <button
                  key={cat.id}
                  onClick={() => openCategory(cat)}
                  className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 text-left group"
                >
                  <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
                    {cat.imageUrl ? (
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <CategoryIcon slug={cat.slug} size={64} color="#D1D5DB" />
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
              </>
            )}
            </>
          )}

          {/* ── Highlights — up to 4 individual services (was "Top Services") ── */}
          {!search && topServices.length > 0 && (
            <div className="mt-10">
              <h2 className="text-[17px] font-extrabold text-ink tracking-tight mb-4">Highlights</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {topServices.map(({ svc, cat }) => {
                  const img = svc.webImageUrl?.trim() || svc.imageUrl?.trim() || "";
                  return (
                    <button
                      key={svc._id}
                      onClick={() => openService(svc, cat)}
                      className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 text-left group"
                    >
                      <div className="relative w-full aspect-[4/3] bg-gray-100 overflow-hidden">
                        {img ? (
                          <img
                            src={img}
                            alt={svc.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <CategoryIcon slug={cat.slug} size={40} color="#D1D5DB" />
                          </div>
                        )}
                        <span className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full capitalize">
                          {cat.name}
                        </span>
                      </div>
                      <div className="p-2.5">
                        <p className="font-bold text-ink text-[12px] tracking-tight leading-snug line-clamp-2 mb-1 min-h-[2.4em]">
                          {svc.name}
                        </p>
                        <p className="text-[10px] text-muted -mb-0.5">from</p>
                        <p className="font-extrabold text-ink text-sm">₹{svc.price}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── How it works ── */}
          {!search && (
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
          {!user && !search && (
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
          <div className="max-w-6xl mx-auto flex flex-col gap-4">
            {activeSocialLinks.length > 0 && (
              <div className="flex items-center justify-center md:justify-start gap-3">
                {activeSocialLinks.map(({ key, url, Icon, label }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted hover:text-ink hover:border-ink transition"
                  >
                    <Icon size={16} color="currentColor" />
                  </a>
                ))}
              </div>
            )}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted">
              <span>© {new Date().getFullYear()} QuickQare. All rights reserved.</span>
              <div className="flex items-center gap-5">
                <Link to="/privacy-policy" className="hover:text-ink transition-colors">Privacy Policy</Link>
                <Link to="/terms" className="hover:text-ink transition-colors">Terms & Conditions</Link>
                <Link to="/refund-policy" className="hover:text-ink transition-colors">Refund Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

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
