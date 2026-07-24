import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import BookingModal, { CartItem, MAX_MEHENDI_HANDS } from "../components/BookingModal";
import CakeCustomizerModal from "../components/CakeCustomizerModal";
import PhotoCarousel from "../components/PhotoCarousel";
import {
  getMehendiPricingKey, getMehendiHandsPrice, isMehendiHandOption, isMehendiAddon,
  isRestrictedMehendiFeetOnly, isBridalMehendi, hasMehendiHandInCart, getCartItemTotal,
} from "../utils/mehendiPricing";
import { getServiceTemplate } from "../data/serviceDetails";
import { CategoryIcon } from "../components/CategoryIcon";
import {
  Service, catName, catSlug, subCatName, isCakeService, isVariantService, variantShortLabel,
  OPTIONS_SUFFIX, toUrlSlug, useServices,
} from "../lib/catalog";

const normalizeSvcName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export default function CategoryPage({ onLoginClick }: { onLoginClick: () => void }) {
  const { catSlug: slug = "" } = useParams<{ catSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { services, categories, loading } = useServices();

  const [bookingCart, setBookingCart] = useState<CartItem[] | null>(null);
  const [acPicker, setAcPicker] = useState<{ base: Service; variants: Service[] } | null>(null);
  const [cakePicker, setCakePicker] = useState<Service | null>(null);
  const [searchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const deepLinkDone = useRef(false);

  // Mehendi is the one category where a customer routinely wants more than one
  // service in the same booking (a hand design + a feet add-on) — the backend
  // requires Basic Feet/Ankle/Above Ankle to arrive alongside a hand design in
  // the SAME booking, and rejects them alone. The mobile app handles this with
  // an accumulating cart that blocks adding a restricted feet-only item until a
  // hand design is already in it; this mirrors that here instead of letting the
  // customer reach payment before finding out the combination is invalid.
  const [mehendiCart, setMehendiCart] = useState<CartItem[]>([]);
  const [mehendiNotice, setMehendiNotice] = useState("");

  const category = categories.find((c) => toUrlSlug(c) === slug) ?? null;
  const isMehendiCat = /mehend|mehndi/i.test(category?.name || category?.slug || "");

  // Mehendi: hand designs first, leg/feet add-ons last (each cheapest-first).
  const mehendiRank = (name: string): number =>
    isMehendiHandOption(name) ? 0 : isMehendiAddon(name) ? 2 : 1;
  const orderServices = (list: Service[]): Service[] =>
    isMehendiCat
      ? [...list].sort((a, b) => mehendiRank(a.name) - mehendiRank(b.name) || a.price - b.price)
      : list;

  // Hide variant sub-services (Split/Window AC, repair issues) — surfaced nested
  // inside their base service's picker instead. Inactive services are also
  // excluded here — the category list now fetches with includeInactive=true
  // so a "coming soon" category (all services inactive) can still render its
  // card on the home page, but nothing inactive should be directly bookable.
  const catServices = category
    ? orderServices(category.services.filter((s) => !isVariantService(s) && s.isActive !== false))
    : [];

  const catTemplate = category
    ? getServiceTemplate(
        category.name,
        category.minPrice === Infinity ? undefined : category.minPrice,
        category.services[0]?.description
      )
    : null;

  // Variants of a base service = catalog services under its "<name> options"
  // subcategory (e.g. "AC installation" → "Split AC installation", "Window AC").
  const getVariantsFor = (svc: Service): Service[] => {
    const target = `${svc.name.trim().toLowerCase()}${OPTIONS_SUFFIX}`;
    return services
      .filter((s) => subCatName(s.subCategory).trim().toLowerCase() === target)
      .sort((a, b) => a.price - b.price);
  };

  // Deep link from home search: /category/:slug?service=<id> scrolls to that
  // service's card and highlights it. When the target is a variant option
  // (e.g. "Window AC installation"), its base service's picker opens instead.
  useEffect(() => {
    if (loading || !category || deepLinkDone.current) return;
    const targetId = searchParams.get("service");
    if (!targetId) return;
    deepLinkDone.current = true;
    const svc = services.find((s) => s._id === targetId);
    if (!svc) return;
    let cardId = svc._id;
    if (isVariantService(svc)) {
      const sub = subCatName(svc.subCategory).trim();
      const baseName = sub.slice(0, sub.length - OPTIONS_SUFFIX.length).trim().toLowerCase();
      const base = services.find((s) => s.name.trim().toLowerCase() === baseName);
      if (base) {
        cardId = base._id;
        setAcPicker({ base, variants: getVariantsFor(base) });
      }
    }
    setHighlightId(cardId);
    setTimeout(() => {
      document.getElementById(`svc-${cardId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    setTimeout(() => setHighlightId(null), 2800);
  }, [loading, category, services, searchParams]);

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
    // Cakes open the customizer (flavour / tiers / add-ons / name) first.
    if (isCakeService(svc)) {
      if (!user) { onLoginClick(); return; }
      setCakePicker(svc);
      return;
    }
    const variants = getVariantsFor(svc);
    if (variants.length > 0) {
      setAcPicker({ base: svc, variants });
      return;
    }
    proceedToBook(svc);
  };

  // ── Mehendi cart (add-before-checkout, matching the mobile app) ──────────────
  const mehendiQty = (svc: Service): number =>
    mehendiCart.find((i) => i.serviceId === svc._id)?.quantity ?? 0;

  // App-style "number of hands" pricing hint shown on each hand-design card
  // (mirrors ServiceDetailsScreen's optionMetaText): the tiered per-hand
  // packages are cheaper than the flat unit price, so surface the discount up
  // front like the mobile app does. The preview % is computed at 2 hands, the
  // same quantity the app uses for its preview label. Returns null for feet
  // add-ons and anything that isn't a per-hand mehendi design.
  const mehendiHandMeta = (svc: Service): string | null => {
    const key = getMehendiPricingKey(svc.name);
    if (!key) return null;
    const qty = mehendiQty(svc);
    const previewFinal = getMehendiHandsPrice(key, 2);
    const previewOriginal = svc.price * 2;
    const pct =
      previewFinal !== null && previewOriginal > 0
        ? Math.round((Math.max(previewOriginal - previewFinal, 0) / previewOriginal) * 100)
        : 0;
    if (qty > 0)
      return `Selected ${qty} hand${qty > 1 ? "s" : ""}${pct > 0 ? ` · ${pct}% OFF` : ""}`;
    if (pct > 0) return `Up to ${pct}% OFF`;
    return "Hands package pricing";
  };

  const addMehendiItem = (svc: Service) => {
    setMehendiNotice("");
    if (isRestrictedMehendiFeetOnly(svc.name) && !hasMehendiHandInCart(mehendiCart)) {
      setMehendiNotice(
        "Add a Mehendi hand design first — Guest mehendi, Basic Feet, Ankle, and Above Ankle add-ons can only be booked together with one. Mid Leg and Below Knee can be booked separately."
      );
      return;
    }
    const isBridal = isBridalMehendi(svc.name);
    setMehendiCart((prev) => {
      const existing = prev.find((i) => i.serviceId === svc._id);
      const next = existing
        ? prev.map((i) =>
            i.serviceId === svc._id
              ? { ...i, quantity: Math.min(i.quantity + 1, MAX_MEHENDI_HANDS) }
              : i
          )
        : [
            ...prev,
            {
              cartKey: svc._id,
              serviceId: svc._id,
              name: svc.name,
              price: svc.price,
              quantity: 1,
              pricingKey: getMehendiPricingKey(svc.name),
              category: catName(svc.category),
            },
          ];
      // Bridal mehendi includes a complimentary Basic Feet line, same as the app.
      const complimentaryKey = `${svc._id}:complimentary-basic-feet`;
      if (isBridal && !existing && !next.some((i) => i.cartKey === complimentaryKey)) {
        const feet = category?.services.find((s) => normalizeSvcName(s.name) === "basic feet" || normalizeSvcName(s.name) === "feet");
        if (feet) {
          next.push({
            cartKey: complimentaryKey,
            serviceId: feet._id,
            name: "Basic Feet",
            price: 0,
            quantity: 1,
            category: catName(svc.category),
          });
        }
      }
      return next;
    });
  };

  const removeMehendiItem = (svc: Service) => {
    setMehendiNotice("");
    setMehendiCart((prev) => {
      const existing = prev.find((i) => i.serviceId === svc._id);
      if (!existing) return prev;
      const nextQty = existing.quantity - 1;
      let next = nextQty > 0
        ? prev.map((i) => (i.serviceId === svc._id ? { ...i, quantity: nextQty } : i))
        : prev.filter((i) => i.serviceId !== svc._id);
      // Dropping the last hand design also drops its free complimentary feet line.
      if (nextQty <= 0) {
        next = next.filter((i) => i.cartKey !== `${svc._id}:complimentary-basic-feet`);
      }
      return next;
    });
  };

  const mehendiCartItemCount = mehendiCart.reduce((sum, item) => sum + item.quantity, 0);
  const mehendiCartTotal = mehendiCart.reduce((sum, item) => sum + getCartItemTotal(item, mehendiCart), 0);
  const mehendiCartOriginal = mehendiCart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const proceedMehendiCheckout = () => {
    if (!user) { onLoginClick(); return; }
    setBookingCart(mehendiCart);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-3">🤔</p>
        <p className="font-semibold text-ink mb-1">Category not found</p>
        <p className="text-sm text-muted mb-5">This category may have moved or is no longer available.</p>
        <Link to="/" className="btn-primary inline-block px-6">Back to home</Link>
      </div>
    );
  }

  return (
    <>
      <div className="bg-bg min-h-screen">
        <div className={`max-w-6xl mx-auto px-4 py-6 ${isMehendiCat && mehendiCartItemCount > 0 ? "pb-24" : ""}`}>

          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-4 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
            </svg>
            All Categories
          </Link>

          {/* Category hero */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-border flex items-center justify-center shrink-0">
              <CategoryIcon slug={category.slug} size={26} color="#0A0A0A" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-ink tracking-tight capitalize leading-tight">
                {category.name}
              </h1>
              <p className="text-xs text-muted">
                {catServices.length} service{catServices.length !== 1 ? "s" : ""} · from ₹
                {category.minPrice === Infinity ? "—" : category.minPrice}
              </p>
            </div>
          </div>

          {/* Cover blurb */}
          {catTemplate && (
            <div className="bg-white rounded-2xl border border-border p-4 mb-5 shadow-sm">
              <p className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1">
                {catTemplate.coverTitle}
              </p>
              <p className="text-xs text-muted mb-2.5">{catTemplate.coverSubtitle}</p>
              <ul className="space-y-1.5">
                {catTemplate.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-xs text-ink">
                    <span className="text-primary mt-0.5 shrink-0">✓</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Services grid */}
          {catServices.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p className="text-4xl mb-3">🔍</p>
              <p>No services available in this category yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {catServices.map((svc) => {
                // Web-only photo gallery (webMedia360) — arrows + dots on the
                // card when there's more than one photo; a single web photo
                // takes over as the card image. The app's gallery (media360)
                // is never shown here.
                const galleryPhotos = svc.webMedia360?.length ? svc.webMedia360 : [];
                const img = (galleryPhotos[0] || svc.webImageUrl?.trim() || svc.imageUrl?.trim() || "");
                const variants = getVariantsFor(svc);
                const fromPrice = variants.length ? variants[0].price : svc.price;
                const unavailable = isCakeService(svc) && svc.availableNearby === false;
                return (
                  <div
                    key={svc._id}
                    id={`svc-${svc._id}`}
                    className={`bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col group ${highlightId === svc._id ? "ring-2 ring-primary" : ""}`}
                  >
                    <div className="relative w-full aspect-[3/2] bg-gray-50 overflow-hidden shrink-0">
                      {galleryPhotos.length > 1 ? (
                        <PhotoCarousel
                          photos={galleryPhotos}
                          alt={svc.name}
                          imgClassName="object-contain"
                          autoSlide={svc.webAutoSlideEnabled !== false}
                          intervalMs={(Number(svc.webAutoSlideSeconds) > 0 ? Number(svc.webAutoSlideSeconds) : 3) * 1000}
                        />
                      ) : img ? (
                        <img
                          src={img}
                          alt={svc.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          onError={(e) => {
                            const el = e.target as HTMLImageElement;
                            el.style.display = "none";
                            el.nextElementSibling?.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex items-center justify-center ${galleryPhotos.length > 1 || img ? "hidden" : ""}`}>
                        <CategoryIcon slug={catSlug(svc.category)} size={52} color="#D1D5DB" />
                      </div>
                      {svc.duration && (
                        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
                          ⏱ {svc.duration} min
                        </div>
                      )}
                      {unavailable && (
                        <div className="absolute top-0 left-0 bg-red-50/95 border-r border-b border-red-200 text-red-600 text-[10px] font-semibold px-2.5 py-1 rounded-br-lg">
                          Not available in your area
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
                      {/* App-style hands pricing hint (only on mehendi hand designs) */}
                      {isMehendiCat && (() => {
                        const handMeta = mehendiHandMeta(svc);
                        return handMeta ? (
                          <p className="text-[10px] font-bold text-primary mb-1.5">{handMeta}</p>
                        ) : null;
                      })()}
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
                        {isMehendiCat ? (
                          mehendiQty(svc) > 0 ? (
                            <div className="flex items-center border border-primary rounded-lg overflow-hidden shrink-0">
                              <button
                                type="button"
                                onClick={() => removeMehendiItem(svc)}
                                className="w-7 h-7 flex items-center justify-center text-primary font-bold text-base hover:bg-primary/10 transition"
                              >
                                −
                              </button>
                              <span className="px-1.5 min-w-[1.75rem] text-center text-xs font-bold text-ink whitespace-nowrap">
                                {isMehendiHandOption(svc.name)
                                  ? `${mehendiQty(svc)} hand${mehendiQty(svc) > 1 ? "s" : ""}`
                                  : mehendiQty(svc)}
                              </span>
                              <button
                                type="button"
                                onClick={() => addMehendiItem(svc)}
                                disabled={mehendiQty(svc) >= MAX_MEHENDI_HANDS}
                                className="w-7 h-7 flex items-center justify-center text-primary font-bold text-base hover:bg-primary/10 transition disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addMehendiItem(svc)}
                              className="btn-primary text-xs px-3 py-1.5"
                            >
                              Add
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => handleBookClick(svc)}
                            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {unavailable ? "View" : variants.length > 0 ? "Choose" : "Book"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mehendi cart notice — e.g. "add a hand design first" when a restricted
          feet add-on is tapped before any hand design is in the cart. */}
      {isMehendiCat && mehendiNotice && (
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center px-4 pointer-events-none">
          <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm font-medium rounded-xl px-4 py-3 shadow-lg max-w-md text-center pointer-events-auto">
            {mehendiNotice}
          </div>
        </div>
      )}

      {/* Mehendi cart bar — lets a hand design and its feet add-ons accumulate
          into one booking, matching the mobile app's flow, before checkout. */}
      {isMehendiCat && mehendiCartItemCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="bg-white border border-border rounded-2xl shadow-xl px-5 py-3.5 flex items-center gap-4 w-full max-w-md">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {mehendiCartTotal < mehendiCartOriginal && (
                  <span className="text-xs text-muted line-through">
                    ₹{mehendiCartOriginal.toLocaleString("en-IN")}
                  </span>
                )}
                <span className="font-extrabold text-ink">₹{mehendiCartTotal.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-[11px] text-muted mt-0.5">
                {mehendiCartItemCount} item{mehendiCartItemCount > 1 ? "s" : ""} added
              </p>
            </div>
            <button onClick={proceedMehendiCheckout} className="btn-primary text-sm px-5 py-2.5 shrink-0">
              View Cart
            </button>
          </div>
        </div>
      )}

      {/* AC option picker (Split/Window, repair issue) */}
      {acPicker && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={() => setAcPicker(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3 min-w-0">
                {(() => {
                  const baseImg = acPicker.base.webImageUrl?.trim() || acPicker.base.imageUrl?.trim() || "";
                  return baseImg ? (
                    <img
                      src={baseImg}
                      alt={acPicker.base.name}
                      className="w-11 h-11 rounded-lg object-cover shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : null;
                })()}
                <div className="min-w-0">
                  <h3 className="font-bold text-ink text-sm truncate">{acPicker.base.name}</h3>
                  <p className="text-xs text-muted mt-0.5">
                    {acPicker.base.name.toLowerCase().includes("repair")
                      ? "Choose the issue you're facing"
                      : "Choose a type"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAcPicker(null)}
                className="text-gray-400 hover:text-ink text-2xl leading-none shrink-0"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              {acPicker.variants.map((v) => {
                const vImg = v.webImageUrl?.trim() || v.imageUrl?.trim() || "";
                return (
                  <div
                    key={v._id}
                    className="flex items-start gap-3 border border-border rounded-xl p-3.5 hover:border-primary transition"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                      {vImg ? (
                        <img
                          src={vImg}
                          alt={v.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CategoryIcon slug={catSlug(v.category)} size={26} color="#D1D5DB" />
                        </div>
                      )}
                    </div>
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
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Booking modal */}
      {cakePicker && (
        <CakeCustomizerModal
          cake={cakePicker}
          onClose={() => setCakePicker(null)}
          onContinue={(item) => {
            setCakePicker(null);
            setBookingCart([item]);
          }}
        />
      )}

      {bookingCart && (
        <BookingModal
          cart={bookingCart}
          onClose={() => setBookingCart(null)}
          onSuccess={(bookingId) => {
            setBookingCart(null);
            setMehendiCart([]);
            navigate(`/bookings/${bookingId}`);
          }}
        />
      )}
    </>
  );
}
