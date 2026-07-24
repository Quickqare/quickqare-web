import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { useAppConfig } from "../hooks/useAppConfig";
import { CategoryIcon, catConfigKey } from "../components/CategoryIcon";
import { GroupedCategory, Service, toUrlSlug, useServices } from "../lib/catalog";
import { SavedLocation, getSavedLocation, persistLocation, geocodePosition, getSavedLocationLabel } from "../lib/location";
import { safeExternalUrl } from "../lib/safeUrl";

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

// ─── Location prompt modal ─────────────────────────────────────────────────────
// Shown on first visit (no saved location — not dismissible) and when the
// header's location pill is clicked (`onClose` provided — dismissible). Both
// paths persist the FULL location record (pincode/coords via GPS geocoding or
// a validated pincode), never just a display label: a label-only "save" here
// once let the header show a new city while bookings kept using the old one.
function LocationPromptModal({ onDone, onClose }: { onDone: (loc: SavedLocation) => void; onClose?: () => void }) {
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
        <div className="relative bg-[#0A0A0A] px-6 pt-6 pb-5 text-center">
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white/50 hover:text-white text-2xl leading-none transition"
            >
              ×
            </button>
          )}
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
  const [locationText, setLocationText] = useState(() => getSavedLocationLabel());
  const [showPicker, setShowPicker] = useState(false);

  const applyLocation = (loc: SavedLocation) => {
    setLocationText(loc.label);
  };

  return { locationText, showPicker, setShowPicker, applyLocation };
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
  const { emergency, defaultBannerEnabled, homeIconAnimationEnabled, homeIconAnimation } = useAppConfig();
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
              s.isActive !== false &&
              (s.name.toLowerCase().includes(q) ||
                (s.description ?? "").toLowerCase().includes(q))
          )
          .map((svc) => ({ svc, cat }))
      )
    : [];

  // "Highlights" — services the admin has flagged as highlighted (isHighlighted)
  // in the admin panel, ordered by highlightOrder then price. Capped at 4.
  // Admin's flag is the sole gate here — unlike the category grid, variant
  // services (e.g. "Split AC installation") are allowed through: clicking one
  // deep-links to its base service's picker (see CategoryPage's `service`
  // query-param handling), so it resolves correctly even without its own card.
  // Skipped while searching since serviceResults covers that case.
  const HIGHLIGHTS_MAX = 4;
  const topServices: { svc: Service; cat: GroupedCategory }[] = search
    ? []
    : categories
        .flatMap((cat) => cat.services.map((svc) => ({ svc, cat })))
        .filter(({ svc }) => svc.isHighlighted && svc.isActive !== false)
        .sort(
          (a, b) =>
            (a.svc.highlightOrder ?? 0) - (b.svc.highlightOrder ?? 0) ||
            a.svc.price - b.svc.price
        )
        .slice(0, HIGHLIGHTS_MAX);

  // A category with services but none of them active yet — mirrors the app's
  // isServiceAvailableNow check, just applied across the whole category
  // instead of a single matched service.
  const isCategoryComingSoon = (cat: GroupedCategory) =>
    cat.services.length > 0 && cat.services.every((s) => s.isActive === false);

  // Each category opens its own page — unless nothing in it is bookable yet,
  // matching the app's "Coming Soon" alert instead of opening an empty page.
  const openCategory = (cat: GroupedCategory) => {
    if (isCategoryComingSoon(cat)) {
      window.alert(`${cat.name} will be available soon in your area.`);
      return;
    }
    navigate(`/category/${toUrlSlug(cat)}`);
  };

  // A service result deep-links into its category page, which scrolls to the
  // service card (or opens the variant picker for nested options).
  const openService = (svc: Service, cat: GroupedCategory) =>
    navigate(`/category/${toUrlSlug(cat)}?service=${svc._id}`);

  // Admin banner click target — the admin-chosen service (deep-links into its
  // category page like a search result), when it exists and is bookable.
  // Banners without one fall back to their external Link URL.
  const bannerServiceTarget = (b: any): { svc: Service; cat: GroupedCategory } | undefined => {
    if (!b?.serviceId) return undefined;
    for (const cat of categories) {
      const svc = cat.services.find((s) => s._id === b.serviceId);
      if (svc && svc.isActive !== false) return { svc, cat };
    }
    return undefined;
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
                    <img src={b.imageUrl} alt={b.title || ""} className="w-full h-full object-cover" loading={i === 0 ? undefined : "lazy"} />
                    {b.title && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                        <p className="text-white font-bold text-base">{b.title}</p>
                      </div>
                    )}
                  </>
                );
                // Admin-chosen service target wins; else the Link URL. A banner
                // with an unsafe link (e.g. `javascript:`) still shows its
                // artwork — it just isn't clickable.
                const svcTarget = bannerServiceTarget(b);
                const href = safeExternalUrl(b.linkUrl);
                return (
                  <div
                    key={b._id}
                    className={`absolute inset-0 transition-opacity duration-700 ${i === bannerIndex ? "opacity-100" : "opacity-0"}`}
                  >
                    {svcTarget ? (
                      <button
                        type="button"
                        onClick={() => openService(svcTarget.svc, svcTarget.cat)}
                        className="block w-full h-full text-left"
                      >
                        {inner}
                      </button>
                    ) : href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
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
              : filteredCategories.map((cat, i) => {
                  // Admin-gated: master "Home Icon Animation" toggle plus the
                  // per-icon style (categories without a dedicated admin entry
                  // fall back to the default bob whenever the master is on).
                  const animKey = catConfigKey(cat.slug);
                  const style = homeIconAnimationEnabled
                    ? animKey ? homeIconAnimation[animKey] : "bob"
                    : "none";
                  const animClass =
                    style === "bob"    ? "animate-float" :
                    style === "bounce" ? "animate-icon-bounce" :
                    style === "tada"   ? "animate-icon-tada" :
                    undefined;
                  return (
                  <button
                    key={cat.id}
                    onClick={() => openCategory(cat)}
                    className="flex flex-col items-center gap-2 shrink-0 w-[72px] group"
                  >
                    {/* Float loop lives on the wrapper so the inner hover
                        transform still composes with it. */}
                    <div
                      className={animClass}
                      style={animClass ? { animationDelay: `${i * 0.18}s` } : undefined}
                    >
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white shadow-sm transition-all duration-300 hover:-translate-y-2 hover:scale-110 hover:shadow-md">
                        <CategoryIcon slug={cat.slug} size={26} color="#0A0A0A" />
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-center leading-tight tracking-tight text-[#6B7280] group-hover:text-ink transition-colors">
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
                              loading="lazy"
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
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50">
                        <CategoryIcon slug={cat.slug} size={64} color="#D1D5DB" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"/>
                    {isCategoryComingSoon(cat) ? (
                      <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm text-ink text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide uppercase">
                        Coming Soon
                      </div>
                    ) : index < 2 && (
                      /* Bare green word in the corner — no pill; drop-shadow keeps
                         it readable over light photos. */
                      <div className="absolute top-2 right-2 text-primary text-[9px] font-bold tracking-wide uppercase drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
                        Popular
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2.5 right-2.5">
                      <p className="text-white font-extrabold text-[13px] tracking-tight leading-tight capitalize drop-shadow-sm">
                        {cat.name}
                      </p>
                      <p className="text-white/70 text-[10px] mt-0.5">
                        from ₹{cat.minPrice === Infinity ? "—" : cat.minPrice}
                      </p>
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
                            loading="lazy"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <CategoryIcon slug={cat.slug} size={40} color="#D1D5DB" />
                          </div>
                        )}
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
      </div>

      {/* ── Location picker modal (header pill) — same GPS/pincode flow as the
          first-run prompt, so changing location here re-persists the full
          record (pincode/coords) and re-scopes the catalog, not just the
          header text. ── */}
      {loc.showPicker && (
        <LocationPromptModal
          onDone={(savedLoc) => {
            loc.applyLocation(savedLoc);
            loc.setShowPicker(false);
          }}
          onClose={() => loc.setShowPicker(false)}
        />
      )}

    </>
  );
}
