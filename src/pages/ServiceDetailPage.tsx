import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import {
  AC_INSTALLATION_OPTIONS,
  AC_REPAIR_ISSUE_OPTIONS,
  AC_UNINSTALLATION_OPTIONS,
  getServiceTemplate,
  NestedServiceOption,
  ServiceOption,
} from "../data/serviceDetails";
import {
  getCartItemTotal,
  getMehendiHandsPrice,
  getMehendiPricingKey,
  hasBridalInCart,
  isBridalMehendi,
  isMehendiAddon,
  isMehendiHandOption,
} from "../utils/mehendiPricing";
import BookingModal from "../components/BookingModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type RawService = {
  _id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  duration?: number;
  category?: { _id: string; name: string; slug?: string } | string | null;
  subCategory?: { _id: string; name: string } | string | null;
};

export type CartItem = {
  cartKey: string;
  serviceId: string;
  name: string;
  price: number;
  quantity: number;
  pricingKey?: string | null;
  parentName?: string;
  sectionTitle?: string;
  category?: string;
};

// ─── AC nested option key helpers ─────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const isAcRepair        = (key: string) => norm(key) === "ac repair";
const isAcInstallation  = (key: string) => norm(key) === "ac installation";
const isAcUninstallation= (key: string) => norm(key) === "ac uninstallation";

function getNestedAcConfig(optionKey: string): { title: string; options: NestedServiceOption[] } | null {
  if (isAcRepair(optionKey))         return { title: "AC Repair — choose issue", options: AC_REPAIR_ISSUE_OPTIONS };
  if (isAcInstallation(optionKey))   return { title: "AC Installation — choose type", options: AC_INSTALLATION_OPTIONS };
  if (isAcUninstallation(optionKey)) return { title: "AC Uninstallation — choose type", options: AC_UNINSTALLATION_OPTIONS };
  return null;
}

// ─── Resolve live serviceId for a named option ───────────────────────────────
function resolveServiceId(name: string, catalog: RawService[]): string {
  const n = norm(name);
  const exact = catalog.find((s) => norm(s.name) === n);
  if (exact) return exact._id;
  const partial = catalog.find((s) => norm(s.name).includes(n) || n.includes(norm(s.name)));
  return partial?._id ?? "";
}

// ─── Cart helpers ─────────────────────────────────────────────────────────────
function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, item) => sum + getCartItemTotal(item, cart), 0);
}

// ─── Nested AC panel ─────────────────────────────────────────────────────────
function NestedPanel({
  title,
  options,
  cart,
  cartKeyPrefix,
  catalog,
  categoryName,
  onAdd,
  onRemove,
  onClose,
}: {
  title: string;
  options: NestedServiceOption[];
  cart: CartItem[];
  cartKeyPrefix: string;
  catalog: RawService[];
  categoryName: string;
  onAdd: (item: CartItem) => void;
  onRemove: (cartKey: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h3 className="font-bold text-ink text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-ink text-2xl leading-none">×</button>
        </div>
        <div className="p-4 space-y-3">
          {options.map((opt) => {
            const cartKey = `${cartKeyPrefix}:${opt.key}`;
            const item = cart.find((i) => i.cartKey === cartKey);
            const qty = item?.quantity ?? 0;
            return (
              <div key={opt.key} className="flex items-start justify-between gap-4 border border-border rounded-xl p-3.5">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm">{opt.title}</p>
                  <p className="text-xs text-muted mt-0.5">{opt.description}</p>
                  <p className="text-xs font-bold text-ink mt-1">₹{opt.price} · {opt.duration}</p>
                </div>
                {qty > 0 ? (
                  <button
                    onClick={() => onRemove(cartKey)}
                    className="shrink-0 text-xs font-bold text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const serviceId = resolveServiceId(opt.title, catalog);
                      onAdd({ cartKey, serviceId, name: opt.title, price: opt.price, quantity: 1, category: categoryName });
                    }}
                    className="shrink-0 text-xs font-bold text-primary border border-primary rounded-lg px-3 py-1.5 hover:bg-primary hover:text-white transition"
                  >
                    Add
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="px-4 pb-4">
          <button onClick={onClose} className="btn-primary w-full text-sm">Done</button>
        </div>
      </div>
    </div>
  );
}

// ─── Option row ───────────────────────────────────────────────────────────────
function OptionRow({
  option,
  sectionTitle,
  sectionKey,
  cart,
  catalog,
  categoryName,
  isMehendi,
  isAc,
  onAdd,
  onRemove,
  onOpenNested,
}: {
  option: ServiceOption;
  sectionTitle: string;
  sectionKey: string;
  cart: CartItem[];
  catalog: RawService[];
  categoryName: string;
  isMehendi: boolean;
  isAc: boolean;
  onAdd: (item: CartItem) => void;
  onRemove: (cartKey: string) => void;
  onOpenNested: (optionKey: string, cartKeyPrefix: string) => void;
}) {
  const cartKey = `${sectionKey}:${option.key}`;
  const existing = cart.find((i) => i.cartKey === cartKey);
  const qty = existing?.quantity ?? 0;

  const pricingKey = isMehendi ? getMehendiPricingKey(option.title) : null;
  const isMehendiHand = isMehendi && isMehendiHandOption(option.title);
  const isMehendiAddOn = isMehendi && isMehendiAddon(option.title);
  const nestedAcConfig = isAc ? getNestedAcConfig(option.title) : null;
  const hasNestedInCart = nestedAcConfig
    ? cart.some((i) => i.cartKey.startsWith(`${cartKey}:`))
    : false;

  const isAddon = sectionKey.includes("add-on") || sectionTitle.toLowerCase().includes("add-on");
  const hasMehendiHandReq = isMehendiAddOn && !isMehendiAddon(option.title.toLowerCase().includes("mid") || option.title.toLowerCase().includes("knee") ? "mid leg" : "other");

  // Bridal bonus: free basic feet
  const isComplimentaryFreeWithBridal =
    isMehendi &&
    (norm(option.title) === "basic feet" || norm(option.title) === "feet") &&
    hasBridalInCart(cart);

  // Display price for mehendi hand options
  const displayPrice = pricingKey
    ? (getMehendiHandsPrice(pricingKey, Math.max(qty, 1)) ?? option.price)
    : isComplimentaryFreeWithBridal
    ? 0
    : option.price;

  const handleAdd = () => {
    // AC nested: open nested panel instead of direct add
    if (nestedAcConfig) {
      onOpenNested(option.title, cartKey);
      return;
    }
    const serviceId = resolveServiceId(option.title, catalog);
    onAdd({
      cartKey,
      serviceId,
      name: option.title,
      price: option.price,
      quantity: 1,
      pricingKey,
      parentName: sectionTitle,
      sectionTitle,
      category: categoryName,
    });
  };

  const handleRemove = () => onRemove(cartKey);

  const handleIncrease = () => {
    if (!existing) return;
    onAdd({ ...existing, quantity: 1 });
  };

  const handleDecrease = () => {
    if (!existing) return;
    if (existing.quantity <= 1) {
      onRemove(cartKey);
    } else {
      onRemove(cartKey); // remove one by calling remove (which decrements)
    }
  };

  // For mehendi hands we show a stepper; for AC nested options just a button
  const showStepper = (isMehendiHand || isMehendiAddOn) && qty > 0;
  const showAddRemove = !showStepper && !nestedAcConfig;

  return (
    <div className={`flex items-start gap-4 py-4 border-t border-border ${isAddon ? "py-5" : ""}`}>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-ink text-sm leading-snug">{option.title}</p>
        {option.rating && option.reviews && (
          <p className="text-[11px] text-muted mt-0.5">⭐ {option.rating.toFixed(1)} · {option.reviews}</p>
        )}
        <p className="text-xs font-bold text-ink mt-1">
          ₹{displayPrice}
          {isComplimentaryFreeWithBridal && <span className="ml-1.5 text-green-600 font-semibold">Free with bridal</span>}
          {pricingKey && qty > 1 && (
            <span className="ml-1.5 text-green-600 font-semibold">
              {qty} hand{qty > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-muted font-normal"> · {option.duration}</span>
        </p>
        <p className="text-xs text-muted mt-1 leading-relaxed">{option.description}</p>
        {option.bullets?.map((b) => (
          <p key={b} className="text-xs text-muted mt-0.5">— {b}</p>
        ))}
        {option.optionsCount && !nestedAcConfig && (
          <p className="text-[11px] text-primary font-medium mt-1">{option.optionsCount} options available</p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-center gap-2 mt-0.5">
        {nestedAcConfig ? (
          <button
            onClick={() => onOpenNested(option.title, cartKey)}
            className={`text-xs font-bold px-4 py-2 rounded-xl border transition ${
              hasNestedInCart
                ? "border-primary bg-primary text-white"
                : "border-primary text-primary hover:bg-primary hover:text-white"
            }`}
          >
            {hasNestedInCart ? "Customize" : "Add"}
          </button>
        ) : showStepper ? (
          <div className="flex items-center border border-primary rounded-xl overflow-hidden">
            <button
              onClick={handleDecrease}
              className="w-8 h-8 flex items-center justify-center text-primary font-bold text-lg hover:bg-primary/10 transition"
            >−</button>
            <span className="min-w-[2rem] text-center text-sm font-bold text-ink">
              {pricingKey ? `${qty}` : qty}
            </span>
            <button
              onClick={handleIncrease}
              className="w-8 h-8 flex items-center justify-center text-primary font-bold text-lg hover:bg-primary/10 transition"
            >+</button>
          </div>
        ) : qty > 0 ? (
          <button
            onClick={handleRemove}
            className="text-xs font-bold text-red-500 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition"
          >
            Remove
          </button>
        ) : (
          <button
            onClick={handleAdd}
            className="text-xs font-bold text-primary border border-primary rounded-xl px-4 py-2 hover:bg-primary hover:text-white transition"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ServiceDetailPage({ onLoginClick }: { onLoginClick: () => void }) {
  const { catSlug = "" } = useParams<{ catSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [catalog, setCatalog] = useState<RawService[]>([]);
  const [loading, setLoading] = useState(true);
  const [catName, setCatName] = useState("");
  const [catId, setCatId] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showBooking, setShowBooking] = useState(false);
  const [nestedPanel, setNestedPanel] = useState<{ optionTitle: string; cartKeyPrefix: string } | null>(null);

  // Fetch services for this category
  useEffect(() => {
    setLoading(true);
    client.get("/api/services")
      .then((res) => {
        const all: RawService[] = Array.isArray(res.data)
          ? res.data
          : Array.isArray(res.data?.services) ? res.data.services : [];
        // Find the category by slug match
        const match = all.find((s) => {
          const cat = s.category;
          if (!cat || typeof cat === "string") return false;
          const slug = (cat.slug ?? cat.name ?? "").toLowerCase().replace(/\s+/g, "-");
          const name = (cat.name ?? "").toLowerCase();
          return slug === catSlug || name.replace(/\s+/g, "-") === catSlug || name.includes(catSlug.replace(/-/g, " "));
        });
        if (match && typeof match.category === "object" && match.category) {
          setCatName((match.category as any).name ?? catSlug);
          setCatId((match.category as any)._id ?? "");
        } else {
          setCatName(catSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
        }
        const filtered = all.filter((s) => {
          const cat = s.category;
          if (!cat) return false;
          if (typeof cat === "string") return false;
          const slug = (cat.slug ?? cat.name ?? "").toLowerCase().replace(/\s+/g, "-");
          const name = (cat.name ?? "").toLowerCase();
          return slug === catSlug || name.replace(/\s+/g, "-") === catSlug || name.includes(catSlug.replace(/-/g, " "));
        });
        setCatalog(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [catSlug]);

  const template = useMemo(() => {
    const firstSvc = catalog[0];
    return getServiceTemplate(
      catName || catSlug,
      firstSvc?.price,
      firstSvc?.description
    );
  }, [catName, catSlug, catalog]);

  const isAc      = useMemo(() => norm(catName).includes("ac"), [catName]);
  const isMehendi = useMemo(() => norm(catName).includes("mehendi") || norm(catName).includes("mehndi"), [catName]);

  // Cart operations
  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.cartKey === item.cartKey);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + item.quantity };
        return updated;
      }
      return [...prev, item];
    });
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.cartKey === cartKey);
      if (idx < 0) return prev;
      const item = prev[idx];
      if (item.quantity > 1) {
        const updated = [...prev];
        updated[idx] = { ...item, quantity: item.quantity - 1 };
        return updated;
      }
      return prev.filter((i) => i.cartKey !== cartKey);
    });
  };

  const total = cartTotal(cart);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);

  const handleBook = () => {
    if (!user) { onLoginClick(); return; }
    setShowBooking(true);
  };

  const openNested = (optionTitle: string, cartKeyPrefix: string) => {
    setNestedPanel({ optionTitle, cartKeyPrefix });
  };

  const nestedAcConfig = nestedPanel ? getNestedAcConfig(nestedPanel.optionTitle) : null;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Back button */}
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-32">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-5 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
          </svg>
          Back
        </button>

        {/* Hero card */}
        <div className="bg-ink rounded-3xl p-6 mb-5 overflow-hidden relative">
          <span className="inline-block text-[10px] font-bold tracking-widest text-primary bg-primary/20 px-2.5 py-1 rounded-full mb-3 uppercase">
            {template.heroTag}
          </span>
          <h1 className="text-white font-extrabold text-2xl leading-tight tracking-tight mb-1">
            {template.heroTitle}
          </h1>
          <p className="text-white/50 text-sm">{template.heroSubtitle}</p>
        </div>

        {/* Highlights */}
        <div className="bg-white rounded-2xl border border-border p-5 mb-5 shadow-sm">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">{template.coverTitle}</p>
          <p className="text-sm text-muted mb-3">{template.coverSubtitle}</p>
          <ul className="space-y-1.5">
            {template.highlights.map((h) => (
              <li key={h} className="flex items-start gap-2 text-sm text-ink">
                <span className="text-primary mt-0.5 shrink-0">✓</span>
                {h}
              </li>
            ))}
          </ul>
        </div>

        {/* Sections */}
        {template.sections.map((section) => (
          <div key={section.key} className="mb-5">
            <h2 className="text-[15px] font-extrabold text-ink tracking-tight mb-1">{section.title}</h2>
            <div className="bg-white rounded-2xl border border-border shadow-sm px-4">
              {section.options.map((option) => (
                <OptionRow
                  key={option.key}
                  option={option}
                  sectionTitle={section.title}
                  sectionKey={section.key}
                  cart={cart}
                  catalog={catalog}
                  categoryName={catName}
                  isMehendi={isMehendi}
                  isAc={isAc}
                  onAdd={addToCart}
                  onRemove={removeFromCart}
                  onOpenNested={openNested}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky cart bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-border px-4 py-3 z-30">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="font-extrabold text-ink text-base">₹{total.toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted">{totalItems} item{totalItems > 1 ? "s" : ""} added</p>
            </div>
            <button onClick={handleBook} className="btn-primary px-8">
              Book Now
            </button>
          </div>
        </div>
      )}

      {/* AC nested option panel */}
      {nestedPanel && nestedAcConfig && (
        <NestedPanel
          title={nestedAcConfig.title}
          options={nestedAcConfig.options}
          cart={cart}
          cartKeyPrefix={nestedPanel.cartKeyPrefix}
          catalog={catalog}
          categoryName={catName}
          onAdd={addToCart}
          onRemove={removeFromCart}
          onClose={() => setNestedPanel(null)}
        />
      )}

      {/* Booking modal */}
      {showBooking && cart.length > 0 && (
        <BookingModal
          cart={cart}
          onClose={() => setShowBooking(false)}
          onSuccess={(bookingId) => {
            setShowBooking(false);
            setCart([]);
            navigate(`/bookings/${bookingId}`);
          }}
        />
      )}
    </>
  );
}
