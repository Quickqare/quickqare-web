import { Fragment, useCallback, useEffect, useState } from "react";
import client from "../api/client";
import { useAppConfig } from "../hooks/useAppConfig";
import { useAuth } from "../contexts/AuthContext";
import { getSavedLocation } from "../lib/location";
import { localDateISO, localDateISOPlusDays } from "../lib/date";
import { getCartItemTotal, getMehendiPricingKey } from "../utils/mehendiPricing";
import { getCancellationPolicyLines, getLeadTimeLine } from "../utils/cancellationPolicyText";

export type CakeOptions = {
  flavour: string;
  weight?: string;
  tiers: 1 | 2;
  eggless?: boolean;
  addons: { name: string; price: number }[];
  nameOnCake: string;
  referencePhotoUrl?: string;
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
  // Cake customization — re-validated and re-priced server-side; `price`
  // holds the client-computed unit price for display only.
  options?: CakeOptions;
  // Minimum calendar days between booking and the scheduled date (cakes = 1).
  minLeadDays?: number;
  // Cancellation policy snapshot from the service — threaded through so this
  // checkout screen can render the REAL configured policy instead of a
  // hardcoded guess (see utils/cancellationPolicyText.ts).
  cancellationPolicyType?: "BEFORE_SERVICE" | "SINCE_BOOKING";
  sinceBookingTiers?: { maxHoursAfterBooking: number; refundPercent: number }[];
  cancellationTiers?: { minHoursBefore: number; refundPercent: number }[];
  cancellationGrace?: { windowMinutes?: number; appliesBelowLeadHours?: number } | null;
};

type Props = { cart: CartItem[]; onClose: () => void; onSuccess: (bookingId: string) => void };

const TIME_SLOTS: { value: string; label: string }[] = [
  { value: "08:00", label: "8:00 AM" },
  { value: "09:00", label: "9:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "13:00", label: "1:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "15:00", label: "3:00 PM" },
  { value: "16:00", label: "4:00 PM" },
  { value: "17:00", label: "5:00 PM" },
  { value: "18:00", label: "6:00 PM" },
];

const LABEL_ICONS: Record<string, string> = { Home: "🏠", Work: "💼", Other: "📍" };

// Matches the mobile app's per-service cap for mehendi hands. Exported so
// CategoryPage's mehendi cart (add/remove before checkout) uses the same cap.
export const MAX_MEHENDI_HANDS = 25;

// A cart item is a mehendi hand design (choose 1–25 hands) when it resolves to
// a hand-pricing key — either explicitly or derived from its name.
const isMehendiHandsItem = (item: CartItem): boolean =>
  Boolean(item.pricingKey ?? getMehendiPricingKey(item.name));

// Frontend-only: the 7–8 PM (19:00) slot is hidden for mehendi bookings, to
// match the mobile app. The static grid below currently stops at 6 PM, so this
// is a guard that keeps 19:00 hidden for mehendi if evening slots are ever
// added to TIME_SLOTS.
const MEHENDI_HIDDEN_SLOT_VALUES = new Set(["19:00"]);

const isMehendiBooking = (items: CartItem[]): boolean =>
  items.some(
    (item) => /mehend|mehndi/i.test(String(item.category || "")) || isMehendiHandsItem(item)
  );

declare const Razorpay: any;

export default function BookingModal({ cart, onClose, onSuccess }: Props) {
  // Editable working copy so mehendi bookings can adjust the number of hands
  // inside the modal. Seeded from the incoming cart; the modal is remounted
  // per booking, so a plain initial value is sufficient.
  const [items, setItems] = useState<CartItem[]>(cart);

  const updateHands = (cartKey: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.cartKey === cartKey
          ? { ...it, quantity: Math.min(Math.max(it.quantity + delta, 1), MAX_MEHENDI_HANDS) }
          : it
      )
    );
    // The server priced this coupon against the OLD subtotal and handed back a
    // fixed rupee discount. Changing the hand count changes the subtotal, so that
    // number no longer holds (and the coupon's minimum-order rule may no longer
    // be met). Drop it rather than show a total we won't actually charge — the
    // code stays in the box so re-applying is one click.
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponError("Coupon cleared — re-apply it for the updated total.");
    }
    // loadAvailableCoupons() caches this list and skips re-fetching whenever it
    // already has entries — a fine assumption for a static cart, but the hand
    // count changing the subtotal means a coupon shown here might no longer
    // meet its minimum-order rule, or a new one might now qualify. Clear the
    // cache and close the panel (rather than leave it open showing the stale
    // list, or briefly flashing "No coupons available" against an empty
    // cache) so the next open re-fetches against the current basePrice.
    setAvailableCoupons([]);
    setShowCoupons(false);
  };

  // Advance-only orders (cakes): the earliest bookable date shifts forward by
  // the cart's largest minLeadDays. The backend enforces the same rule.
  const minLeadDays = cart.reduce((max, item) => Math.max(max, Number(item.minLeadDays) || 0), 0);
  const minDateISO = minLeadDays > 0 ? localDateISOPlusDays(minLeadDays) : localDateISO();
  const hasCakeItems = cart.some((item) => item.options?.flavour);
  // Cancellation-policy source: mirrors the backend's own rule in
  // createBooking (booking.controller.js) — the first cart cake declaring
  // SINCE_BOOKING with real tiers wins (legacy policy); otherwise fall back
  // to the first cake's BEFORE_SERVICE tiers + grace period (the current
  // cake policy) — or the platform default if it has none.
  const cakeItems = cart.filter((item) => item.options?.flavour);
  const primaryCakeItem =
    cakeItems.find(
      (item) =>
        item.cancellationPolicyType === "SINCE_BOOKING" &&
        Array.isArray(item.sinceBookingTiers) &&
        item.sinceBookingTiers.length > 0
    ) || cakeItems[0];

  const [date, setDate] = useState(minDateISO);
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [houseDetails, setHouseDetails] = useState("");
  const [pincode, setPincode] = useState("");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<[number, number] | null>(null); // [lng, lat]

  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const [availableSlotTimes, setAvailableSlotTimes] = useState<string[] | null>(null); // null = loading/unknown
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [showCoupons, setShowCoupons] = useState(false);
  const [couponsLoading, setCouponsLoading] = useState(false);

  const [addressLabel, setAddressLabel] = useState<"Home" | "Work" | "Other">("Home");
  const [notServiceable, setNotServiceable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "paying">("form");

  const basePrice = items.reduce((sum, item) => sum + getCartItemTotal(item, items), 0);
  const serviceIds = items.map((i) => i.serviceId).filter(Boolean);
  const firstItem = items[0];

  const { user } = useAuth();
  const isLoggedIn = Boolean(user);

  // Pre-fill from the location set at homepage prompt. Only prefill address
  // when GPS was used (coords are non-zero) — a pincode-only entry has no
  // meaningful address string to show. Pincode always prefills so slot
  // availability check fires immediately.
  useEffect(() => {
    const saved = getSavedLocation();
    if (!saved) return;
    const hasGps = saved.latitude !== 0 && saved.longitude !== 0;
    if (hasGps && saved.address) setAddress(saved.address);
    if (saved.pincode) setPincode(saved.pincode);
    if (hasGps) setCoords([saved.longitude, saved.latitude]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch saved addresses on mount (only if logged in)
  useEffect(() => {
    if (!isLoggedIn) return;
    setAddressesLoading(true);
    client.get("/api/addresses")
      .then((res) => setSavedAddresses(Array.isArray(res.data?.addresses) ? res.data.addresses : []))
      .catch(() => {})
      .finally(() => setAddressesLoading(false));
  }, [isLoggedIn]);

  // Fetch available slots — only when we have a valid 6-digit pincode
  const fetchSlots = useCallback(async (forDate: string, forPincode: string) => {
    if (!forPincode || forPincode.length !== 6) {
      setAvailableSlotTimes(null);
      return;
    }
    setSlotsLoading(true);
    setNotServiceable(false);
    try {
      const res = await client.post("/api/booking/available-slots", {
        date: forDate,
        services: items.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
          ...(i.options ? { options: i.options } : {}),
        })),
        pincode: forPincode,
      });
      const slots: any[] = Array.isArray(res.data?.slots) ? res.data.slots : [];
      setAvailableSlotTimes(slots.map((s) => String(s?.time || s || "").trim()).filter(Boolean));
    } catch (err: any) {
      if (err?.response?.status === 403) {
        setNotServiceable(true);
        setAvailableSlotTimes([]);
      } else {
        setAvailableSlotTimes(null);
      }
    } finally {
      setSlotsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items)]);

  // One fetch, driven by everything that can change what's available: the date,
  // the area (pincode), and the cart itself — partner capacity depends on
  // headcount, so a slot free for 2 mehendi hands may be full for 10, and
  // `fetchSlots` takes a fresh identity whenever `items` changes. fetchSlots
  // itself handles an incomplete pincode (clears availability, no request).
  useEffect(() => {
    fetchSlots(date, pincode);
  }, [date, pincode, fetchSlots]);

  // The one invariant, mirroring the app's CreateBookingScreen: a slot that
  // isn't in the current availability list cannot stay selected.
  //
  // This used to be three separate `setTime("")` calls, one in each of the
  // effects above — and the pincode one was missing, so a slot picked for one
  // area survived into an area where it was full. The selected style outranks
  // the unavailable style, so the customer kept a green "10:00 AM" that the
  // server then refused at create. Stating the rule once means the next input
  // added here can't reintroduce that bug by forgetting to clear.
  //
  // `null` means loading/unknown, not "nothing available" — don't clear on it.
  useEffect(() => {
    if (time && availableSlotTimes && !availableSlotTimes.includes(time)) {
      setTime("");
    }
  }, [availableSlotTimes, time]);

  const applyAddress = (addr: any) => {
    setAddress(addr.address || "");
    setPincode(addr.pincode || "");
    setHouseDetails(addr.houseDetails || "");
    if (addr.latitude && addr.longitude) {
      setCoords([Number(addr.longitude), Number(addr.latitude)]);
    }
    setError("");
  };

  const applyGeocodedLocation = (loc: { address: string; pincode: string }, longitude: number, latitude: number) => {
    setAddress(loc.address || "");
    setPincode(loc.pincode || "");
    setCoords([longitude, latitude]);
    setError("");
  };

  const handleUseMyLocation = () => {
    // Check session cache first — avoids a Maps API call if the user already
    // geocoded their location in this browser session (e.g. from a previous
    // service modal). Cache key is rounded coords so minor GPS drift reuses it.
    const cached = sessionStorage.getItem("qq_geo_cache");
    if (cached) {
      try {
        const { loc, lng, lat } = JSON.parse(cached);
        if (loc?.address && loc?.pincode) {
          applyGeocodedLocation(loc, lng, lat);
          return;
        }
      } catch { /* corrupt cache — fall through to fresh fetch */ }
    }

    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported by your browser.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await client.get(`/api/maps/reverse?lat=${latitude}&lng=${longitude}`);
          const loc = res.data?.location;
          if (loc) {
            applyGeocodedLocation(loc, longitude, latitude);
            // Cache for the rest of this browser session
            sessionStorage.setItem("qq_geo_cache", JSON.stringify({ loc, lng: longitude, lat: latitude }));
          } else {
            setGpsError("Could not detect address. Enter manually.");
          }
        } catch {
          setGpsError("Could not detect address. Enter manually.");
        } finally {
          setGpsLoading(false);
        }
      },
      () => {
        setGpsError("Location permission denied. Enter address manually.");
        setGpsLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const { pricing, emergency } = useAppConfig();
  const discount = appliedCoupon?.discount ?? 0;
  const taxableAmount = Math.max(basePrice - discount, 0);
  const platformFeeAmount = Math.round(
    (taxableAmount * (pricing.platformFeePercent ?? 0)) / 100 +
    (pricing.platformFeeFlatInr ?? 0)
  );
  const gstAmount = Math.round(
    ((taxableAmount + platformFeeAmount) * (pricing.taxPercent ?? 18)) / 100
  );
  const totalPayable = taxableAmount + platformFeeAmount + gstAmount;

  // `rawCode` lets a caller apply a code it has in hand rather than waiting for
  // the couponInput state to flush — see applyFromList.
  const applyCoupon = async (rawCode?: string) => {
    const code = (rawCode ?? couponInput).trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await client.post("/api/coupons/apply", {
        code,
        amount: basePrice,
        serviceIds,
      });
      if (res.data?.success) {
        setAppliedCoupon({ code, discount: res.data.discount });
      } else {
        setCouponError(res.data?.message || "Invalid coupon");
        setAppliedCoupon(null);
      }
    } catch (e: any) {
      setCouponError(e.response?.data?.message || "Invalid coupon");
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  };

  const loadAvailableCoupons = async () => {
    if (availableCoupons.length) { setShowCoupons((v) => !v); return; }
    setShowCoupons(true);
    setCouponsLoading(true);
    try {
      const res = await client.get(`/api/coupons/available?amount=${basePrice}&serviceIds=${serviceIds.join(",")}`);
      setAvailableCoupons(Array.isArray(res.data?.coupons) ? res.data.coupons : []);
    } catch { } finally { setCouponsLoading(false); }
  };

  const applyFromList = (code: string) => {
    setCouponInput(code);
    setShowCoupons(false);
    // Pass the code explicitly: setCouponInput above is async, so applyCoupon()
    // would still read the *previous* couponInput (empty on the first pick) and
    // bail out at its own empty-code guard, silently applying nothing.
    applyCoupon(code);
  };

  const handleBook = async () => {
    if (!time) return setError("Please select a time slot.");
    if (!address.trim()) return setError("Please enter your address.");
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim()))
      return setError("Please enter a valid 6-digit pincode.");

    // Checkout.js is a <script> in index.html, and ad blockers routinely eat it.
    // Bail out BEFORE creating the booking: reaching `new Razorpay()` with the
    // script missing throws a ReferenceError only after /booking/create and
    // /payment/order have already succeeded, stranding a PENDING_PAYMENT booking
    // and a live Razorpay order behind a generic error.
    if (typeof Razorpay === "undefined") {
      return setError(
        "Couldn't load the payment window. Disable any ad blocker for this site and try again."
      );
    }

    setError("");
    setLoading(true);
    setStep("paying");

    try {
      const bookingRes = await client.post("/api/booking/create", {
        services: items.map((i) => ({
          serviceId: i.serviceId,
          quantity: i.quantity,
          ...(i.options ? { options: i.options } : {}),
        })),
        scheduledDate: date,
        scheduledTime: time,
        address: address.trim(),
        pincode: pincode.trim(),
        houseDetails: houseDetails.trim() || undefined,
        notes: notes.trim() || undefined,
        couponCode: appliedCoupon?.code || undefined,
        location: {
          type: "Point",
          coordinates: coords ?? [0, 0],
        },
      });

      const bookingId = bookingRes.data?.booking?._id;
      if (!bookingId) throw new Error("Booking creation failed");

      // Save address to backend (fire-and-forget) so it appears in the mobile
      // app's saved addresses and in future web modal opens. Only saves if not
      // already saved (match by pincode to avoid exact-duplicate check complexity).
      if (isLoggedIn && address.trim() && pincode.trim()) {
        const alreadySaved = savedAddresses.some((a) => a.pincode === pincode.trim() && a.address === address.trim());
        if (!alreadySaved) {
          client.post("/api/addresses", {
            label: addressLabel,
            address: address.trim(),
            pincode: pincode.trim(),
            houseDetails: houseDetails.trim() || undefined,
            latitude: coords ? coords[1] : undefined,
            longitude: coords ? coords[0] : undefined,
          }).then((res) => {
            if (res.data?.address) {
              setSavedAddresses((prev) => [...prev, res.data.address]);
            }
          }).catch(() => {});
        }
      }

      const orderRes = await client.post("/api/payment/order", { bookingId });
      if (!orderRes.data?.success) throw new Error(orderRes.data?.message || "Payment order failed");

      const { order } = orderRes.data;

      const rzp = new Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || "INR",
        order_id: order.id,
        name: "QuickQare",
        description: firstItem?.name ?? "QuickQare Service",
        theme: { color: "#22A06B" },
        handler: async (response: any) => {
          try {
            await client.post("/api/payment/verify", {
              bookingId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            onSuccess(bookingId);
          } catch {
            setError("Payment verification failed. Please contact support.");
            setStep("form");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setStep("form");
            setLoading(false);
            setError("Payment was cancelled. You can try again.");
          },
        },
      });

      rzp.open();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? "Could not place booking. Try again.");
      setStep("form");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="card w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-ink">Book Service</h2>
            <p className="text-sm text-muted mt-0.5">
              {items.length === 1
                ? firstItem?.name
                : `${items.length} services · ₹${basePrice.toLocaleString("en-IN")}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-ink text-2xl leading-none ml-4">×</button>
        </div>

        {step === "paying" ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted">Opening payment…</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Number of hands — mehendi hand designs are priced per hand */}
            {items.filter(isMehendiHandsItem).map((item) => {
              const lineTotal = getCartItemTotal(item, items);
              const originalTotal = item.price * Math.max(item.quantity, 1);
              const discountPercent =
                originalTotal > lineTotal
                  ? Math.round(((originalTotal - lineTotal) / originalTotal) * 100)
                  : 0;
              return (
                <div key={item.cartKey} className="border border-border rounded-xl p-3.5 bg-gray-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink text-sm leading-snug">{item.name}</p>
                      <p className="text-xs text-muted mt-0.5">
                        {item.quantity} hand{item.quantity > 1 ? "s" : ""} · ₹{lineTotal.toLocaleString("en-IN")}
                        {discountPercent > 0 && (
                          <span className="ml-1.5 text-green-600 font-semibold">{discountPercent}% off</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center border border-primary rounded-xl overflow-hidden shrink-0">
                      <button
                        type="button"
                        onClick={() => updateHands(item.cartKey, -1)}
                        disabled={item.quantity <= 1}
                        className="w-9 h-9 flex items-center justify-center text-primary font-bold text-lg hover:bg-primary/10 transition disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        −
                      </button>
                      <span className="min-w-[2.25rem] text-center text-sm font-bold text-ink">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateHands(item.cartKey, +1)}
                        disabled={item.quantity >= MAX_MEHENDI_HANDS}
                        className="w-9 h-9 flex items-center justify-center text-primary font-bold text-lg hover:bg-primary/10 transition disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted mt-2">Choose how many hands you'd like designed.</p>
                </div>
              );
            })}

            {/* Cake customization summary */}
            {items.filter((item) => item.options?.flavour).map((item) => (
              <div key={`cake-${item.cartKey}`} className="border border-amber-200 bg-amber-50 rounded-xl p-3.5">
                <p className="font-bold text-amber-900 text-sm leading-snug">🎂 {item.name}</p>
                <p className="text-xs text-amber-800 mt-1">
                  {[item.options!.flavour, item.options!.weight, item.options!.tiers === 2 ? "2 tier" : "1 tier"].filter(Boolean).join(" · ")}
                  {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
                </p>
                {item.options!.addons.length > 0 && (
                  <p className="text-xs text-amber-800 mt-0.5">
                    Add-ons: {item.options!.addons.map((a) => a.name).join(", ")}
                  </p>
                )}
                {item.options!.nameOnCake && (
                  <p className="text-xs text-amber-800 mt-0.5">Name on cake: “{item.options!.nameOnCake}”</p>
                )}
                {item.options!.referencePhotoUrl && (
                  <img
                    src={item.options!.referencePhotoUrl}
                    alt="Reference"
                    className="w-16 h-16 object-cover rounded-lg border border-amber-200 mt-1.5"
                  />
                )}
              </div>
            ))}

            {/* Cart summary (when multiple items) */}
            {items.length > 1 && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                {items.map((item) => (
                  <div key={item.cartKey} className="flex items-center justify-between text-sm">
                    <span className="text-ink">
                      {item.name}
                      {isMehendiHandsItem(item)
                        ? ` · ${item.quantity} hand${item.quantity > 1 ? "s" : ""}`
                        : item.quantity > 1
                        ? ` ×${item.quantity}`
                        : ""}
                    </span>
                    <span className="font-semibold text-ink">₹{getCartItemTotal(item, items).toLocaleString("en-IN")}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Preferred Date</label>
              <input type="date" className="input" value={date} min={minDateISO} onChange={(e) => setDate(e.target.value)} />
              {minLeadDays > 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  🕐 Cakes are baked to order — earliest delivery is {minLeadDays === 1 ? "tomorrow" : `${minLeadDays} days from today`}.
                </p>
              )}
            </div>

            {/* Time slots */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-ink">Time Slot</label>
                {slotsLoading && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    <span className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin inline-block" />
                    Checking availability…
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(isMehendiBooking(items)
                  ? TIME_SLOTS.filter((t) => !MEHENDI_HIDDEN_SLOT_VALUES.has(t.value))
                  : TIME_SLOTS
                ).map((t) => {
                  const isAvailable = availableSlotTimes === null || availableSlotTimes.includes(t.value);
                  const isSelected = time === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => isAvailable && setTime(t.value)}
                      disabled={!isAvailable}
                      className={`py-2 px-2 rounded-lg border transition flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : isAvailable
                          ? "border-border text-ink hover:border-primary"
                          : "border-border bg-gray-50 cursor-not-allowed"
                      }`}
                    >
                      <span className={`text-xs font-medium ${!isAvailable ? "text-gray-300" : ""}`}>
                        {t.label}
                      </span>
                      {!isAvailable && (
                        <span className="text-[9px] font-semibold text-red-300 leading-none">Full</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {availableSlotTimes !== null && availableSlotTimes.length === 0 && (
                <p className="text-xs text-red-500 mt-2">No slots available for this date. Try another date.</p>
              )}
              {pincode.length !== 6 && (
                <p className="text-xs text-muted mt-2 flex items-center gap-1.5">
                  <span>📍</span>
                  Add your location below to check live slot availability for your area.
                </p>
              )}
            </div>

            {/* ── Address section ── */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Service Address</label>

              {/* Saved addresses */}
              {isLoggedIn && (
                <div className="mb-2">
                  {addressesLoading ? (
                    <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                  ) : savedAddresses.length > 0 ? (
                    <div className="space-y-2 mb-2">
                      {savedAddresses.map((addr) => (
                        <div
                          key={addr._id}
                          className="flex items-center justify-between bg-gray-50 border border-border rounded-xl px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{LABEL_ICONS[addr.label] ?? "📍"}</span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-primary uppercase tracking-wide">{addr.label}</p>
                              <p className="text-xs text-ink truncate">{addr.address}</p>
                              {addr.houseDetails && (
                                <p className="text-xs text-muted truncate">{addr.houseDetails}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => applyAddress(addr)}
                            className="ml-3 shrink-0 text-xs font-semibold text-primary border border-primary rounded-lg px-3 py-1.5 hover:bg-primary hover:text-white transition"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}

              {/* GPS button */}
              <button
                onClick={handleUseMyLocation}
                disabled={gpsLoading}
                className="w-full flex items-center justify-center gap-2 border border-border rounded-xl py-2.5 text-sm font-medium text-ink hover:border-primary hover:text-primary transition mb-2 disabled:opacity-50"
              >
                {gpsLoading ? (
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" strokeWidth="2"/>
                    <path strokeLinecap="round" strokeWidth="2" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  </svg>
                )}
                {gpsLoading ? "Detecting location…" : "Use my current location"}
              </button>
              {gpsError && <p className="text-red-500 text-xs mb-2">{gpsError}</p>}

              {/* Divider */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted">or enter manually</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Manual address input */}
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Street, area, city…"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            {/* House / Flat */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                House / Flat / Floor <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                className="input"
                placeholder="e.g. Flat 4B, 2nd Floor"
                value={houseDetails}
                onChange={(e) => setHouseDetails(e.target.value)}
              />
            </div>

            {/* Save address label — only shown when address is filled and user is logged in */}
            {isLoggedIn && address.trim() && pincode.length === 6 && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Save this address as
                </label>
                <div className="flex gap-2">
                  {(["Home", "Work", "Other"] as const).map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setAddressLabel(label)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition ${
                        addressLabel === label
                          ? "border-primary bg-primary text-white"
                          : "border-border text-ink hover:border-primary"
                      }`}
                    >
                      {LABEL_ICONS[label]} {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pincode */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Pincode</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="input"
                placeholder="6-digit pincode"
                value={pincode}
                onChange={(e) => { setPincode(e.target.value.replace(/\D/g, "")); setNotServiceable(false); }}
              />
              {notServiceable && (
                <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <span className="text-base mt-0.5">😔</span>
                  <div>
                    <p className="text-sm font-semibold text-red-700">We don't serve this area yet</p>
                    <p className="text-xs text-red-500 mt-0.5">Try a nearby pincode or check back soon — we're expanding!</p>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Notes <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Any special instructions…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Coupon */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Coupon Code</label>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-green-700">{appliedCoupon.code}</p>
                    <p className="text-xs text-green-600 mt-0.5">Discount applied: −₹{appliedCoupon.discount}</p>
                  </div>
                  <button onClick={removeCoupon} className="text-xs font-semibold text-red-500 hover:text-red-700">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Enter coupon code"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
                  />
                  <button
                    className="px-4 py-2 rounded-xl border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-white transition disabled:opacity-50"
                    onClick={() => applyCoupon()}
                    disabled={couponLoading || !couponInput.trim()}
                  >
                    {couponLoading ? "…" : "Apply"}
                  </button>
                </div>
              )}
              {couponError && <p className="text-red-500 text-xs mt-1.5">{couponError}</p>}

              {/* Available coupons toggle */}
              {!appliedCoupon && (
                <div>
                  <button onClick={loadAvailableCoupons} className="text-xs text-primary font-semibold mt-2 hover:underline">
                    {showCoupons ? "▲ Hide coupons" : "▼ View available coupons"}
                  </button>
                  {showCoupons && (
                    <div className="mt-2 space-y-2">
                      {couponsLoading ? (
                        <div className="h-8 bg-gray-100 rounded-lg animate-pulse" />
                      ) : availableCoupons.length === 0 ? (
                        <p className="text-xs text-muted py-1">No coupons available for this service.</p>
                      ) : availableCoupons.map((c) => (
                        <div key={c._id || c.code} className="flex items-center justify-between bg-gray-50 border border-border rounded-xl px-3 py-2.5">
                          <div>
                            <p className="text-xs font-bold text-ink tracking-wide">{c.code}</p>
                            <p className="text-xs text-muted">{c.displayText}</p>
                            {c.minOrder > 0 && <p className="text-xs text-muted">Min order ₹{c.minOrder}</p>}
                          </div>
                          <button
                            onClick={() => applyFromList(c.code)}
                            className="ml-3 shrink-0 text-xs font-semibold text-primary border border-primary rounded-lg px-3 py-1.5 hover:bg-primary hover:text-white transition"
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Price summary */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Service price</span>
                <span className="font-semibold text-ink">₹{basePrice.toLocaleString("en-IN")}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Coupon discount</span>
                  <span className="font-semibold text-green-600">−₹{discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              {(platformFeeAmount + gstAmount) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Fees & Taxes</span>
                  <span className="font-semibold text-ink">₹{(platformFeeAmount + gstAmount).toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5">
                <span className="font-bold text-ink">Total Payable</span>
                <span className="font-extrabold text-primary">₹{totalPayable.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Cake cancellation policy — the customer must see this before
                paying. Sourced from the actual cart item's configured tiers
                (threaded through from CakeCustomizerModal), not hardcoded
                numbers — an admin change to the policy must show up here. */}
            {hasCakeItems && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm font-bold text-red-700 mb-1">Cancellation policy for cake orders</p>
                <p className="text-xs text-red-800 leading-relaxed">
                  {[...getCancellationPolicyLines(primaryCakeItem), getLeadTimeLine(minLeadDays)]
                    .filter(Boolean)
                    .map((line, idx) => (
                      <Fragment key={idx}>
                        • {line}
                        <br />
                      </Fragment>
                    ))}
                </p>
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            {(emergency.bookingsDisabled || emergency.paymentsFreezed || emergency.emergencyLockdown) ? (
              <div className="w-full rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 text-center">
                🚫 {emergency.emergencyLockdown
                  ? "Platform is under maintenance. Please try again later."
                  : emergency.bookingsDisabled
                  ? "Bookings are temporarily unavailable."
                  : "Payments are temporarily frozen. Please try again later."}
              </div>
            ) : (
              // Availability is reconciled against the selection once the fetch
              // resolves, so block paying while it's in flight — otherwise the
              // brief window where a slot from the previous date/area is still
              // highlighted is long enough to click through and be rejected.
              <button
                className="btn-primary w-full"
                onClick={handleBook}
                disabled={loading || slotsLoading}
              >
                {loading
                  ? "Processing…"
                  : slotsLoading
                  ? "Checking availability…"
                  : "Confirm & Pay"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
