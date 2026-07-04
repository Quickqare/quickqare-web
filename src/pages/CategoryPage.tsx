import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import BookingModal, { CartItem } from "../components/BookingModal";
import { getMehendiPricingKey, isMehendiHandOption, isMehendiAddon } from "../utils/mehendiPricing";
import { getServiceTemplate } from "../data/serviceDetails";
import { CategoryIcon } from "../components/CategoryIcon";
import {
  Service, catName, catSlug, subCatName, isVariantService, variantShortLabel,
  OPTIONS_SUFFIX, toUrlSlug, useServices,
} from "../lib/catalog";

export default function CategoryPage({ onLoginClick }: { onLoginClick: () => void }) {
  const { catSlug: slug = "" } = useParams<{ catSlug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { services, categories, loading } = useServices();

  const [bookingCart, setBookingCart] = useState<CartItem[] | null>(null);
  const [acPicker, setAcPicker] = useState<{ base: Service; variants: Service[] } | null>(null);

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
  // inside their base service's picker instead.
  const catServices = category
    ? orderServices(category.services.filter((s) => !isVariantService(s)))
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
      setAcPicker({ base: svc, variants });
      return;
    }
    proceedToBook(svc);
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
        <div className="max-w-6xl mx-auto px-4 py-6">

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
                        <CategoryIcon slug={catSlug(svc.category)} size={52} color="#D1D5DB" />
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
        </div>
      </div>

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

      {/* Booking modal */}
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
    </>
  );
}
