import { Fragment, useMemo, useRef, useState } from "react";
import client from "../api/client";
import { Service } from "../lib/catalog";
import { CakeOptions, CartItem } from "./BookingModal";
import CakeGallery from "./CakeGallery";
import { getCancellationPolicyLines, getLeadTimeLine } from "../utils/cancellationPolicyText";

const MAX_NAME_ON_CAKE_LENGTH = 40;

type Props = {
  cake: Service;
  onClose: () => void;
  onContinue: (item: CartItem) => void;
};

/**
 * CakeCustomizerModal — interstitial between the category card and the
 * BookingModal (same pattern as the AC variant picker). The customer picks a
 * flavour, weight, tier, add-ons, an optional name on the cake, and an
 * optional reference photo; the configured CartItem then flows into the
 * normal booking flow. Pricing shown here is display-only — the backend
 * re-validates and re-prices the options.
 */
export default function CakeCustomizerModal({ cake, onClose, onContinue }: Props) {
  const customization = cake.customization!;

  // Per-section admin toggles (undefined = enabled). When flavour selection is
  // off, the first flavour silently applies as the fixed default.
  const flavoursOn = customization.flavoursEnabled !== false;
  const weightsOn = customization.weightsEnabled !== false && (customization.weights?.length || 0) > 0;
  const tiersOn = customization.tiersEnabled !== false;
  const egglessOn = customization.egglessOptionEnabled !== false;
  const addonsOn = customization.addonsEnabled !== false && customization.addons.length > 0;
  const refPhotoOn = customization.referencePhotoEnabled !== false;

  const [flavour, setFlavour] = useState(customization.flavours[0]?.name || "");
  const [weight, setWeight] = useState(weightsOn ? customization.weights?.[0]?.label || "" : "");
  const [tiers, setTiers] = useState<1 | 2>(1);
  const [eggless, setEggless] = useState(false);
  const [addonNames, setAddonNames] = useState<string[]>([]);
  const [nameOnCake, setNameOnCake] = useState("");
  const [referencePhotoUrl, setReferencePhotoUrl] = useState("");
  const [referencePhotoUploading, setReferencePhotoUploading] = useState(false);
  const [referencePhotoError, setReferencePhotoError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unitPrice = useMemo(() => {
    const flavourDelta = customization.flavours.find((f) => f.name === flavour)?.priceDelta || 0;
    const weightDelta = customization.weights?.find((w) => w.label === weight)?.priceDelta || 0;
    const tierDelta = tiers === 2 ? customization.twoTierPriceDelta || 0 : 0;
    const egglessDelta = eggless && egglessOn ? customization.egglessPriceDelta || 0 : 0;
    const addonsTotal = customization.addons
      .filter((a) => addonNames.includes(a.name))
      .reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    return Math.round((Number(cake.price) || 0) + flavourDelta + weightDelta + tierDelta + egglessDelta + addonsTotal);
  }, [cake.price, customization, flavour, weight, tiers, eggless, egglessOn, addonNames]);

  const toggleAddon = (name: string) => {
    setAddonNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const handleReferencePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setReferencePhotoUploading(true);
    setReferencePhotoError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await client.post("/api/upload/customer", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.success && res.data?.imageUrl) {
        setReferencePhotoUrl(res.data.imageUrl);
      } else {
        setReferencePhotoError(res.data?.message || "Upload failed. Please try again.");
      }
    } catch (err: any) {
      setReferencePhotoError(err?.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setReferencePhotoUploading(false);
    }
  };

  // Browsable, but not orderable. createBooking only gates on hub/zone coverage,
  // not on baker supply — so an order for a cake nobody bakes would be created and
  // PAID FOR, then fail to assign and land in escalation/refund. Block it here
  // rather than take money for an order we can't fulfil.
  const unavailable = cake.availableNearby === false;

  const handleContinue = () => {
    if (unavailable) return;

    const options: CakeOptions = {
      flavour,
      ...(weight ? { weight } : {}),
      tiers,
      eggless: egglessOn && eggless,
      addons: customization.addons
        .filter((a) => addonNames.includes(a.name))
        .map((a) => ({ name: a.name, price: Number(a.price) || 0 })),
      nameOnCake: nameOnCake.trim().slice(0, MAX_NAME_ON_CAKE_LENGTH),
      ...(referencePhotoUrl ? { referencePhotoUrl } : {}),
    };

    onContinue({
      cartKey: `${cake._id}:cake`,
      serviceId: cake._id,
      name: cake.name,
      price: unitPrice,
      quantity: 1,
      category: "Celebration",
      options,
      minLeadDays: Math.max(Number(cake.minLeadDays) || 0, 1),
      // Threaded through so BookingModal can render the REAL cancellation
      // policy at checkout instead of a hardcoded guess.
      cancellationPolicyType: cake.cancellationPolicyType,
      sinceBookingTiers: cake.sinceBookingTiers,
      cancellationTiers: cake.cancellationTiers,
      cancellationGrace: cake.cancellationGrace,
    });
  };

  // webMedia360 is the web-specific gallery admins upload separately from the
  // app's media360 (see CategoryPage's card gallery, which never shows
  // media360) — this modal was preferring the app's photos over the web ones
  // even when a web gallery existed, so an admin's web-specific uploads never
  // appeared here. media360 is only a fallback for cakes with no web gallery.
  const galleryPhotos =
    cake.webMedia360 && cake.webMedia360.length > 0
      ? cake.webMedia360
      : cake.media360 && cake.media360.length > 0
        ? cake.media360
        : cake.webImageUrl || cake.imageUrl
          ? [cake.webImageUrl || cake.imageUrl!]
          : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-extrabold text-ink text-lg leading-tight truncate">{cake.name}</h3>
            {cake.isEggless && (
              <span className="shrink-0 text-[10px] font-bold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                Eggless
              </span>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-muted text-xl leading-none shrink-0">
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          {unavailable && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-bold text-red-700">Not available in your area</p>
              <p className="text-xs text-red-800 leading-relaxed mt-1">
                No baker near you is offering this cake yet, so it can&apos;t be ordered right now.
                Have a look through the flavours and options — we&apos;ll open it up as soon as a
                baker covers your area.
              </p>
            </div>
          )}

          {/* Multi-angle photo gallery */}
          <CakeGallery photos={galleryPhotos} />

          {cake.description && <p className="text-sm text-muted leading-relaxed">{cake.description}</p>}

          {/* Ingredients */}
          {(cake.ingredients?.length || 0) > 0 && (
            <div>
              <p className="text-sm font-bold text-ink mb-2">Ingredients</p>
              <div className="flex flex-wrap gap-1.5">
                {cake.ingredients!.map((ing) => (
                  <span key={ing} className="text-xs text-muted border border-border rounded-full px-3 py-1">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Flavour */}
          {flavoursOn && (
          <div>
            <p className="text-sm font-bold text-ink mb-2">Choose flavour</p>
            <div className="space-y-2">
              {customization.flavours.map((f) => (
                <label
                  key={f.name}
                  className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition ${
                    flavour === f.name ? "border-primary bg-primary/5" : "border-border hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="cake-flavour"
                    checked={flavour === f.name}
                    onChange={() => setFlavour(f.name)}
                    className="accent-[var(--primary,#22A06B)]"
                  />
                  <span className="flex-1 text-sm text-ink">{f.name}</span>
                  <span className="text-xs font-semibold text-muted">
                    {Number(f.priceDelta) > 0 ? `+₹${f.priceDelta}` : "Included"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          )}

          {/* Weight */}
          {weightsOn && (
            <div>
              <p className="text-sm font-bold text-ink mb-2">Choose weight</p>
              <div className="space-y-2">
                {customization.weights!.map((w) => (
                  <label
                    key={w.label}
                    className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition ${
                      weight === w.label ? "border-primary bg-primary/5" : "border-border hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cake-weight"
                      checked={weight === w.label}
                      onChange={() => setWeight(w.label)}
                      className="accent-[var(--primary,#22A06B)]"
                    />
                    <span className="flex-1 text-sm text-ink">{w.label}</span>
                    <span className="text-xs font-semibold text-muted">
                      {Number(w.priceDelta) > 0 ? `+₹${w.priceDelta}` : "Included"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Tiers */}
          {tiersOn && (
          <div>
            <p className="text-sm font-bold text-ink mb-2">Tiers</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([1, 2] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTiers(t)}
                  className={`border rounded-xl px-4 py-3 text-center transition ${
                    tiers === t ? "border-primary bg-primary/5" : "border-border hover:border-gray-300"
                  }`}
                >
                  <span className={`block text-sm font-bold ${tiers === t ? "text-primary" : "text-ink"}`}>
                    {t === 1 ? "Single tier" : "Two tier"}
                  </span>
                  <span className="block text-xs text-muted mt-0.5">
                    {t === 1 ? "Base price" : `+₹${customization.twoTierPriceDelta || 0}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Egg preference — every cake can be made with or without egg */}
          {egglessOn && (
          <div>
            <p className="text-sm font-bold text-ink mb-2">Egg preference</p>
            <div className="grid grid-cols-2 gap-2.5">
              {([false, true] as const).map((option) => (
                <button
                  key={String(option)}
                  type="button"
                  onClick={() => setEggless(option)}
                  className={`border rounded-xl px-4 py-3 text-center transition ${
                    eggless === option ? "border-primary bg-primary/5" : "border-border hover:border-gray-300"
                  }`}
                >
                  <span className={`block text-sm font-bold ${eggless === option ? "text-primary" : "text-ink"}`}>
                    {option ? "Eggless" : "With Egg"}
                  </span>
                  <span className="block text-xs text-muted mt-0.5">
                    {option && Number(customization.egglessPriceDelta) > 0 ? `+₹${customization.egglessPriceDelta}` : "Included"}
                  </span>
                </button>
              ))}
            </div>
          </div>
          )}

          {/* Add-ons */}
          {addonsOn && (
            <div>
              <p className="text-sm font-bold text-ink mb-2">Add-ons</p>
              <div className="space-y-2">
                {customization.addons.map((a) => (
                  <label
                    key={a.name}
                    className={`flex items-center gap-3 border rounded-xl px-4 py-3 cursor-pointer transition ${
                      addonNames.includes(a.name) ? "border-primary bg-primary/5" : "border-border hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={addonNames.includes(a.name)}
                      onChange={() => toggleAddon(a.name)}
                      className="accent-[var(--primary,#22A06B)]"
                    />
                    <span className="flex-1 text-sm text-ink">{a.name}</span>
                    <span className="text-xs font-semibold text-muted">+₹{a.price}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Name on cake */}
          {customization.nameOnCakeEnabled !== false && (
            <div>
              <p className="text-sm font-bold text-ink mb-2">Name on cake (optional)</p>
              <input
                type="text"
                className="input w-full"
                placeholder='e.g. "Happy Birthday Ria"'
                value={nameOnCake}
                maxLength={MAX_NAME_ON_CAKE_LENGTH}
                onChange={(e) => setNameOnCake(e.target.value)}
              />
              <p className="text-[11px] text-muted mt-1 text-right">
                {nameOnCake.length}/{MAX_NAME_ON_CAKE_LENGTH} characters
              </p>
            </div>
          )}

          {/* Reference photo — "make it look like this" */}
          {refPhotoOn && (
          <div>
            <p className="text-sm font-bold text-ink mb-2">Reference photo (optional)</p>
            {referencePhotoUrl ? (
              <div className="relative inline-block">
                <img src={referencePhotoUrl} alt="Reference" className="w-24 h-24 object-cover rounded-xl border border-border" />
                <button
                  type="button"
                  onClick={() => setReferencePhotoUrl("")}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={referencePhotoUploading}
                className="w-full border border-border rounded-xl py-3.5 text-sm text-ink hover:border-gray-300 transition disabled:opacity-60"
              >
                {referencePhotoUploading ? "Uploading…" : "📷  Show us what you'd like"}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleReferencePhotoChange}
            />
            {referencePhotoError && <p className="text-xs text-red-600 mt-1">{referencePhotoError}</p>}
          </div>
          )}

          {/* Cancellation policy — shown before ordering. Sourced from the
              service's actual configured tiers, not hardcoded numbers — an
              admin change to the policy must be reflected here. */}
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm font-bold text-red-700 mb-1">Cancellation policy</p>
            <p className="text-xs text-red-800 leading-relaxed">
              {[...getCancellationPolicyLines(cake), getLeadTimeLine(cake.minLeadDays)]
                .filter(Boolean)
                .map((line, idx) => (
                  <Fragment key={idx}>
                    • {line}
                    <br />
                  </Fragment>
                ))}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-border px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-extrabold text-ink text-lg leading-none">₹{unitPrice.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted mt-1">
              {[flavour, weight, tiersOn ? (tiers === 2 ? "2 tier" : "1 tier") : "", egglessOn && eggless ? "Eggless" : ""].filter(Boolean).join(" · ")}
              {addonNames.length ? ` · ${addonNames.length} add-on${addonNames.length > 1 ? "s" : ""}` : ""}
            </p>
          </div>
          <button
            className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleContinue}
            disabled={!flavour || unavailable}
          >
            {unavailable ? "Unavailable in your area" : "Continue to book"}
          </button>
        </div>
      </div>
    </div>
  );
}
