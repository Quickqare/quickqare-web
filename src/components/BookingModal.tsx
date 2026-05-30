import { useCallback, useEffect, useState } from "react";
import client from "../api/client";
import { useAppConfig } from "../hooks/useAppConfig";

type Service = {
  _id: string;
  name: string;
  price: number;
  category?: { name: string } | string | null;
};
type Props = { service: Service; onClose: () => void; onSuccess: () => void };

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

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

declare const Razorpay: any;

export default function BookingModal({ service, onClose, onSuccess }: Props) {
  const [date, setDate] = useState(todayISO());
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "paying">("form");

  const isLoggedIn = Boolean(localStorage.getItem("qq_web_token"));

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
      // No pincode yet — show all slots as selectable, don't hit the backend
      setAvailableSlotTimes(null);
      return;
    }
    setSlotsLoading(true);
    try {
      const res = await client.post("/api/booking/available-slots", {
        date: forDate,
        services: [{ serviceId: service._id, quantity: 1, price: service.price }],
        pincode: forPincode,
      });
      const slots: any[] = Array.isArray(res.data?.slots) ? res.data.slots : [];
      setAvailableSlotTimes(slots.map((s) => String(s?.time || s || "").trim()).filter(Boolean));
    } catch {
      setAvailableSlotTimes(null); // API failed → show all slots
    } finally {
      setSlotsLoading(false);
    }
  }, [service._id, service.price]);

  // Re-fetch slots when date changes (only if pincode already known)
  useEffect(() => {
    if (pincode.length === 6) {
      setTime("");
      fetchSlots(date, pincode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Fetch slots once pincode becomes valid (GPS fill or manual entry)
  useEffect(() => {
    if (pincode.length === 6) fetchSlots(date, pincode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

  const applyAddress = (addr: any) => {
    setAddress(addr.address || "");
    setPincode(addr.pincode || "");
    setHouseDetails(addr.houseDetails || "");
    if (addr.latitude && addr.longitude) {
      setCoords([Number(addr.longitude), Number(addr.latitude)]);
    }
    setError("");
  };

  const handleUseMyLocation = () => {
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
            setAddress(loc.address || "");
            setPincode(loc.pincode || "");
            setCoords([longitude, latitude]);
            setError("");
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

  const { pricing } = useAppConfig();
  const discount = appliedCoupon?.discount ?? 0;
  const taxableAmount = Math.max(service.price - discount, 0);
  const platformFeeAmount = Math.round(
    (taxableAmount * (pricing.platformFeePercent ?? 0)) / 100 +
    (pricing.platformFeeFlatInr ?? 0)
  );
  const gstAmount = Math.round(
    ((taxableAmount + platformFeeAmount) * (pricing.taxPercent ?? 18)) / 100
  );
  const totalPayable = taxableAmount + platformFeeAmount + gstAmount;

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await client.post("/api/coupons/apply", {
        code,
        amount: service.price,
        serviceIds: [service._id],
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
      const res = await client.get(`/api/coupons/available?amount=${service.price}&serviceIds=${service._id}`);
      setAvailableCoupons(Array.isArray(res.data?.coupons) ? res.data.coupons : []);
    } catch { } finally { setCouponsLoading(false); }
  };

  const applyFromList = (code: string) => {
    setCouponInput(code);
    setShowCoupons(false);
    applyCoupon();
  };

  const handleBook = async () => {
    if (!time) return setError("Please select a time slot.");
    if (!address.trim()) return setError("Please enter your address.");
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim()))
      return setError("Please enter a valid 6-digit pincode.");
    setError("");
    setLoading(true);
    setStep("paying");

    try {
      const bookingRes = await client.post("/api/booking/create", {
        services: [{ serviceId: service._id, quantity: 1, price: service.price }],
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

      const orderRes = await client.post("/api/payment/order", { bookingId });
      if (!orderRes.data?.success) throw new Error(orderRes.data?.message || "Payment order failed");

      const { order } = orderRes.data;

      const rzp = new Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || "INR",
        order_id: order.id,
        name: "QuickQare",
        description: service.name,
        theme: { color: "#22A06B" },
        handler: async (response: any) => {
          try {
            await client.post("/api/payment/verify", {
              bookingId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            onSuccess();
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
            <p className="text-sm text-muted mt-0.5">{service.name}</p>
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

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Preferred Date</label>
              <input type="date" className="input" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} />
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
                {TIME_SLOTS.map((t) => {
                  const isAvailable = availableSlotTimes === null || availableSlotTimes.includes(t.value);
                  const isSelected = time === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => isAvailable && setTime(t.value)}
                      disabled={!isAvailable}
                      className={`py-2 px-2 text-xs font-medium rounded-lg border transition relative ${
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : isAvailable
                          ? "border-border text-ink hover:border-primary"
                          : "border-border bg-gray-50 text-gray-300 cursor-not-allowed"
                      }`}
                    >
                      {t.label}
                      {!isAvailable && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[9px] text-gray-400 font-semibold">Full</span>
                        </span>
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
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              />
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
                    onClick={applyCoupon}
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
                <span className="font-semibold text-ink">₹{service.price.toLocaleString("en-IN")}</span>
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

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button className="btn-primary w-full" onClick={handleBook} disabled={loading}>
              {loading ? "Processing…" : "Confirm & Pay"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
