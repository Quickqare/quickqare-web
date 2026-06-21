import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import BookingModal from "../components/BookingModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryObj = { _id: string; name: string; slug?: string; imageUrl?: string };
type Service = {
  _id: string; name: string; price: number; description?: string;
  imageUrl?: string; category?: CategoryObj | string | null;
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

const STEPS = [
  { n: "1", title: "Choose a Service", desc: "Browse categories and pick what you need." },
  { n: "2", title: "Book a Slot", desc: "Select your preferred date and time." },
  { n: "3", title: "Expert Arrives", desc: "A verified professional arrives at your door." },
];

// ─── Location hook ─────────────────────────────────────────────────────────────
function useLocation() {
  const [locationText, setLocationText] = useState("Detecting location…");
  const [showPicker, setShowPicker] = useState(false);
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("qq_web_location");
    if (saved) { setLocationText(saved); return; }
    if (!navigator.geolocation) { setLocationText("Set your location"); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const addr = data.address;
          const parts = [
            addr.neighbourhood || addr.suburb || addr.village,
            addr.city || addr.town || addr.county,
          ].filter(Boolean);
          const label = parts.slice(0, 2).join(", ") || data.display_name?.split(",")[0] || "Your location";
          setLocationText(label);
          localStorage.setItem("qq_web_location", label);
        } catch {
          setLocationText("Your location");
        }
      },
      () => setLocationText("Set your location")
    );
  }, []);

  const saveManual = () => {
    const v = manualInput.trim();
    if (!v) return;
    setLocationText(v);
    localStorage.setItem("qq_web_location", v);
    setShowPicker(false);
    setManualInput("");
  };

  return { locationText, showPicker, setShowPicker, manualInput, setManualInput, saveManual };
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function HomePage({ onLoginClick }: Props) {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [bookingDone, setBookingDone] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);

  const loc = useLocation();

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
        : selectedCat.services)
    : [];

  const handleCatClick = (cat: GroupedCategory) => {
    setSelectedCatId((prev) => (prev === cat.id ? null : cat.id));
    setSearch("");
    setTimeout(() => servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  const handleBookClick = (svc: Service) => {
    if (!user) { onLoginClick(); return; }
    setSelectedService(svc);
  };

  return (
    <>
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
                  const Icon = getCatIcon(cat.slug);
                  const active = selectedCatId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCatClick(cat)}
                      className="flex flex-col items-center gap-2 shrink-0 w-[72px] group"
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                        active
                          ? "bg-ink shadow-lg scale-110 animate-float"
                          : "bg-white shadow-sm hover:-translate-y-2 hover:scale-110 hover:shadow-md"
                      }`}>
                        <Icon size={26} color={active ? "#FFFFFF" : "#0A0A0A"}/>
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

          {/* ── Category cards grid (Popular Services) ── */}
          <h2 ref={servicesRef} className="text-[17px] font-extrabold text-ink tracking-tight mt-7 mb-4">
            {selectedCat ? selectedCat.name.charAt(0).toUpperCase() + selectedCat.name.slice(1) : "Popular Services"}
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-3xl overflow-hidden animate-pulse">
                  <div className="w-full aspect-[3/2] bg-gray-200"/>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredCategories.map((cat, index) => {
                  const Icon = getCatIcon(cat.slug);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => handleCatClick(cat)}
                      className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.14)] hover:-translate-y-1 transition-all duration-300 text-left group"
                    >
                      {/* Photo */}
                      <div className="relative w-full aspect-[3/2] bg-gray-100 overflow-hidden">
                        {cat.imageUrl ? (
                          <img
                            src={cat.imageUrl}
                            alt={cat.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50">
                            <Icon size={64} color="#D1D5DB"/>
                          </div>
                        )}
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"/>
                        {/* Popular badge — first 2 */}
                        {index < 2 && (
                          <div className="absolute top-3 left-3 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-full tracking-wide uppercase">
                            Popular
                          </div>
                        )}
                        {/* Service count badge */}
                        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                          {cat.services.length} service{cat.services.length !== 1 ? "s" : ""}
                        </div>
                        {/* Name + price overlay */}
                        <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between">
                          <div>
                            <p className="text-white font-extrabold text-[17px] tracking-tight leading-tight capitalize drop-shadow-sm">
                              {cat.name}
                            </p>
                            <p className="text-white/70 text-xs mt-0.5">
                              from ₹{cat.minPrice === Infinity ? "—" : cat.minPrice}
                            </p>
                          </div>
                          <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/40 transition-colors">
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {catServices.map((svc) => {
                    const Icon = getCatIcon(catSlug(svc.category));
                    const img = svc.imageUrl?.trim() || "";
                    return (
                      <div key={svc._id} className="bg-white rounded-3xl overflow-hidden shadow-[0_2px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.14)] hover:-translate-y-1 transition-all duration-300 flex flex-col group">
                        {/* Photo */}
                        <div className="relative w-full aspect-[4/3] bg-gray-50 overflow-hidden shrink-0">
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
                          {/* Fallback icon — shown when no image or image fails */}
                          <div className={`absolute inset-0 flex items-center justify-center ${img ? "hidden" : ""}`}>
                            <Icon size={52} color="#D1D5DB"/>
                          </div>
                          {/* Duration chip */}
                          {svc.duration && (
                            <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                              ⏱ {svc.duration} min
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 flex flex-col flex-1">
                          {svc.subCategory && typeof svc.subCategory === "object" && (
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1.5">
                              {svc.subCategory.name}
                            </span>
                          )}
                          <h3 className="font-bold text-ink text-[15px] tracking-tight leading-snug mb-1">{svc.name}</h3>
                          {svc.description && (
                            <p className="text-[13px] text-muted line-clamp-2 leading-relaxed flex-1 mb-3">{svc.description}</p>
                          )}
                          <div className="flex items-center justify-between pt-3 border-t border-border mt-auto">
                            <div>
                              <span className="text-[11px] text-muted">from </span>
                              <span className="font-extrabold text-ink text-base">₹{svc.price}</span>
                            </div>
                            <button
                              onClick={() => handleBookClick(svc)}
                              className="btn-primary text-sm px-5 py-2"
                            >
                              Book Now
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

      {/* ── Booking modal ── */}
      {selectedService && (
        <BookingModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onSuccess={() => {
            setSelectedService(null);
            setBookingDone(true);
            setTimeout(() => setBookingDone(false), 4000);
          }}
        />
      )}

      {/* ── Success toast ── */}
      {bookingDone && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-3 rounded-xl shadow-lg text-sm font-medium z-50 whitespace-nowrap">
          Booking confirmed! Check My Bookings.
        </div>
      )}
    </>
  );
}
