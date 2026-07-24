import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

// Mirrors the API's own default page size (controllers/booking.controller.js
// caps `limit` at 50).
const PAGE_SIZE = 20;

type BookingService = {
  serviceId: string;
  name: string;
  price: number;
  lineTotal: number;
  quantity: number;
  category?: string;
  subCategory?: string;
  // Cake customization snapshot (Celebration orders)
  options?: {
    flavour?: string;
    weight?: string;
    tiers?: number;
    addons?: { name: string; price: number }[];
    nameOnCake?: string;
    referencePhotoUrl?: string;
  };
};

type Booking = {
  _id: string;
  services: BookingService[];
  serviceCategory?: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledStartAt?: string;
  estimatedDurationMinutes?: number;
  address?: string;
  houseDetails?: string;
  landmark?: string;
  pincode?: string;
  baseAmount: number;
  discountAmount?: number;
  couponCode?: string;
  couponDiscountAmount?: number;
  platformFeeAmount?: number;
  gstAmount?: number;
  totalAmount: number;
  payment?: { status: "PENDING" | "PAID" | "FAILED" };
  status: string;
  cancelledBy?: "user" | "partner" | null;
  refundAmount?: number;
  refundStatus?: string;
  completedAt?: string;
  createdAt: string;
  // Refund-policy snapshot taken at booking creation — used to preview the
  // refund % a cancel would land on (mirrors the backend's calculateRefund).
  cancellationTiersSnapshot?: { minHoursBefore: number; refundPercent: number }[];
  // Legacy cake orders refund by time since booking, not time to service
  cancellationPolicyTypeSnapshot?: "BEFORE_SERVICE" | "SINCE_BOOKING";
  sinceBookingTiersSnapshot?: { maxHoursAfterBooking: number; refundPercent: number }[];
  // Grace-period free-cancel deadline (last-minute orders) — cancelling at or
  // before this instant refunds 100% regardless of tier.
  freeCancelUntil?: string | null;
};

type CancelState =
  | null
  | "confirming"
  | "cancelling"
  | { percent: number; amount: number; status: string };

type StatusCfg = { bg: string; text: string; dot: string; label: string };
const STATUS_MAP: Record<string, StatusCfg> = {
  PENDING_PAYMENT:      { bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400",  label: "Awaiting Payment" },
  PENDING_ASSIGNMENT:   { bg: "bg-yellow-50",  text: "text-yellow-700", dot: "bg-yellow-400", label: "Finding Partner" },
  QUEUED:               { bg: "bg-yellow-50",  text: "text-yellow-700", dot: "bg-yellow-400", label: "Queued" },
  SEARCHING:            { bg: "bg-blue-50",    text: "text-blue-600",   dot: "bg-blue-400",   label: "Finding Partner" },
  ASSIGNED:             { bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-400", label: "Assigned" },
  CONFIRMED:            { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500",   label: "Confirmed" },
  NO_PARTNER_AVAILABLE: { bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-400", label: "No Partner Found" },
  PARTNER_ACCEPTED:     { bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500", label: "Partner Accepted" },
  ON_THE_WAY:           { bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500", label: "On the Way" },
  ARRIVED:              { bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500", label: "Arrived" },
  IN_PROGRESS:          { bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500", label: "In Progress" },
  COMPLETED:            { bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500",  label: "Completed" },
  CANCELLED:            { bg: "bg-red-50",     text: "text-red-700",    dot: "bg-red-400",    label: "Cancelled" },
  NEEDS_RESCHEDULING:   { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-400",   label: "⚠️ Reschedule Required" },
};

// NEEDS_RESCHEDULING is deliberately excluded from the generic cancel action
// here — it has its own dedicated reschedule-or-cancel-for-full-refund flow on
// the booking status page (with an explicit "company's fault" explanation),
// and duplicating that logic here previously meant this page's generic
// time-based cancel copy was shown for it instead, matching BookingStatusPage's
// own `isCancellable` exclusion.
const NON_CANCELLABLE = new Set(["IN_PROGRESS", "COMPLETED", "CANCELLED", "NEEDS_RESCHEDULING"]);

function getStatusCfg(status: string): StatusCfg {
  return STATUS_MAP[status] ?? { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: status };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDuration(min?: number) {
  if (!min) return null;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function serviceTitle(b: Booking): string {
  if (b.services?.length) {
    if (b.services.length === 1) return b.services[0].name;
    return `${b.services[0].name} +${b.services.length - 1} more`;
  }
  return b.serviceCategory
    ? b.serviceCategory.charAt(0).toUpperCase() + b.serviceCategory.slice(1)
    : "Service";
}

function serviceCategoryLabel(b: Booking): string | null {
  if (b.services?.[0]?.category) return b.services[0].category;
  if (b.serviceCategory) return b.serviceCategory;
  return null;
}

/* ── Booking Detail Panel ── */
function BookingDetail({
  b,
  cancelState,
  onCancelClick,
  onCancelConfirm,
  onCancelAbort,
}: {
  b: Booking;
  cancelState: CancelState;
  onCancelClick: () => void;
  onCancelConfirm: () => void;
  onCancelAbort: () => void;
}) {
  const hasDiscount = (b.discountAmount ?? 0) > 0 || (b.couponDiscountAmount ?? 0) > 0;
  const feesAndTaxes = (b.platformFeeAmount ?? 0) + (b.gstAmount ?? 0);
  const hasFeesAndTaxes = feesAndTaxes > 0;
  const discount = (b.discountAmount ?? 0) + (b.couponDiscountAmount ?? 0);
  const canCancel = !NON_CANCELLABLE.has(b.status);

  return (
    <div className="border-t border-border mt-4 pt-4 space-y-4">

      {/* Services list */}
      {b.services?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Services</p>
          <div className="space-y-1.5">
            {b.services.map((s, i) => (
              <div key={i} className="text-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <span className="text-ink">{s.name}</span>
                    {s.quantity > 1 && <span className="ml-1.5 text-muted text-xs">× {s.quantity}</span>}
                    {s.subCategory && <span className="ml-1.5 text-xs text-primary">{s.subCategory}</span>}
                  </div>
                  <span className="text-ink shrink-0">₹{s.lineTotal?.toLocaleString("en-IN")}</span>
                </div>
                {s.options?.flavour && (
                  <div className="mt-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-xs text-amber-800">
                    🎂 {[s.options.flavour, s.options.weight, Number(s.options.tiers) === 2 ? "2 tier" : "1 tier"].filter(Boolean).join(" · ")}
                    {(s.options.addons?.length ?? 0) > 0 && (
                      <> · Add-ons: {s.options.addons!.map((a) => a.name).join(", ")}</>
                    )}
                    {s.options.nameOnCake && <> · “{s.options.nameOnCake}”</>}
                    {s.options.referencePhotoUrl && (
                      <div className="mt-1.5">
                        <img
                          src={s.options.referencePhotoUrl}
                          alt="Reference"
                          className="w-14 h-14 object-cover rounded-md border border-amber-200"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Schedule</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
          <span>📅 {fmtDate(b.scheduledDate)}</span>
          <span>🕐 {fmtTime(b.scheduledTime)}</span>
          {b.estimatedDurationMinutes && <span>⏱ {fmtDuration(b.estimatedDurationMinutes)}</span>}
        </div>
      </div>

      {/* Address */}
      {(b.address || b.pincode || b.houseDetails) && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Address</p>
          <p className="text-sm text-ink">{b.address || "—"}</p>
          {b.houseDetails && (
            <p className="text-sm text-ink mt-0.5">{b.houseDetails}{b.landmark ? ` · ${b.landmark}` : ""}</p>
          )}
          {b.pincode && <p className="text-xs text-muted mt-0.5">Pincode: {b.pincode}</p>}
        </div>
      )}

      {/* Pricing */}
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Pricing</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-ink">
            <span>Subtotal</span>
            <span>₹{b.baseAmount?.toLocaleString("en-IN")}</span>
          </div>
          {hasDiscount && (
            <div className="flex justify-between text-green-600">
              <span>Discount{b.couponCode ? ` (${b.couponCode})` : ""}</span>
              <span>−₹{discount.toLocaleString("en-IN")}</span>
            </div>
          )}
          {hasFeesAndTaxes && (
            <div className="flex justify-between text-muted">
              <span>Fees and Taxes</span>
              <span>₹{feesAndTaxes.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-ink border-t border-border pt-1 mt-1">
            <span>Total</span>
            <span className="text-primary">₹{b.totalAmount?.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </div>

      {/* Payment status */}
      {b.payment && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Payment:</span>
          {b.payment.status === "PAID"    && <span className="text-green-600 font-medium">✓ Paid</span>}
          {b.payment.status === "PENDING" && <span className="text-amber-600 font-medium">⏳ Pending</span>}
          {b.payment.status === "FAILED"  && <span className="text-red-600 font-medium">✗ Failed</span>}
        </div>
      )}

      {/* Refund info (after cancellation) */}
      {b.status === "CANCELLED" && b.refundAmount != null && (
        <div className={`rounded-xl p-3 text-sm ${b.refundAmount > 0 ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-border"}`}>
          <p className="font-semibold text-ink mb-0.5">
            {b.refundAmount > 0 ? `Refund: ₹${b.refundAmount.toLocaleString("en-IN")}` : "No refund applicable"}
          </p>
          {b.refundStatus && (
            <p className="text-xs text-muted capitalize">{b.refundStatus.toLowerCase()} — will be credited within 5–7 business days</p>
          )}
        </div>
      )}

      {/* Reschedule required — points at the dedicated flow instead of
          duplicating its date/time picker and refund copy here. */}
      {b.status === "NEEDS_RESCHEDULING" && (
        <div className="border-t border-border pt-3">
          <Link to={`/bookings/${b._id}`} className="text-xs text-primary font-medium hover:underline">
            Pick a new time, or cancel for a full refund →
          </Link>
        </div>
      )}

      {/* Cancel section */}
      {canCancel && (
        <div className="border-t border-border pt-3">
          {cancelState === null && (
            <button
              onClick={onCancelClick}
              className="text-sm text-red-500 hover:text-red-700 font-medium transition"
            >
              Cancel Booking
            </button>
          )}

          {cancelState === "confirming" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-red-700">Cancel this booking?</p>
              <p className="text-xs text-red-600">
                {(() => {
                  // The professional has already reached the location — cancelling
                  // forfeits the fee regardless of the clock. Must be checked before
                  // the generic time-based copy below, which would otherwise promise
                  // a refund percentage that never gets paid out.
                  if (b.status === "ARRIVED") {
                    return "Your professional has already reached your location — no refund applies if you cancel now.";
                  }
                  // Grace window (backend freeCancelUntil): last-minute orders
                  // get a short free-cancel window from booking regardless of
                  // the tier they'd otherwise land in.
                  if (b.freeCancelUntil && Date.now() <= new Date(b.freeCancelUntil).getTime()) {
                    const until = new Date(b.freeCancelUntil);
                    return `You're within your free-cancellation window (until ${until.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}) — you'll receive a 100% refund.`;
                  }
                  // Legacy cake orders: refund is based on time since booking, not time to service.
                  const sinceTiers = b.sinceBookingTiersSnapshot;
                  if (b.cancellationPolicyTypeSnapshot === "SINCE_BOOKING" && sinceTiers?.length) {
                    const first = sinceTiers[0];
                    const lastPercent = sinceTiers[sinceTiers.length - 1]?.refundPercent ?? 50;
                    const hoursSinceBooking = (Date.now() - new Date(b.createdAt).getTime()) / 36e5;
                    return hoursSinceBooking <= first.maxHoursAfterBooking
                      ? `You're within ${first.maxHoursAfterBooking}h of booking — you'll receive a ${first.refundPercent}% refund.`
                      : `More than ${first.maxHoursAfterBooking}h have passed since booking — only ${lastPercent}% will be refunded.`;
                  }
                  // Preview the refund % this cancel lands on from the
                  // booking's tier snapshot (same rule as the backend's
                  // calculateRefund, including its default tiers).
                  const tiers = b.cancellationTiersSnapshot?.length
                    ? b.cancellationTiersSnapshot
                    : [
                        { minHoursBefore: 24, refundPercent: 100 },
                        { minHoursBefore: 4, refundPercent: 75 },
                        { minHoursBefore: 1, refundPercent: 50 },
                        { minHoursBefore: 0, refundPercent: 25 },
                      ];
                  const startAt = b.scheduledStartAt ? new Date(b.scheduledStartAt).getTime() : NaN;
                  if (Number.isFinite(startAt)) {
                    const hoursToService = (startAt - Date.now()) / 36e5;
                    const tier = [...tiers]
                      .sort((x, y) => y.minHoursBefore - x.minHoursBefore)
                      .find((t) => hoursToService >= t.minHoursBefore);
                    if (tier) return `Cancelling now refunds ${tier.refundPercent}% of the amount paid.`;
                  }
                  return "Refund depends on how far in advance you cancel.";
                })()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onCancelConfirm}
                  className="px-4 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition"
                >
                  Yes, cancel
                </button>
                <button
                  onClick={onCancelAbort}
                  className="px-4 py-1.5 border border-border text-xs font-semibold rounded-lg hover:border-ink transition"
                >
                  Keep booking
                </button>
              </div>
            </div>
          )}

          {cancelState === "cancelling" && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Cancelling…
            </div>
          )}

          {typeof cancelState === "object" && cancelState !== null && (
            <div className={`rounded-xl p-3 text-sm ${cancelState.amount > 0 ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-border"}`}>
              <p className="font-semibold text-ink">Booking cancelled</p>
              {cancelState.amount > 0 ? (
                <p className="text-xs text-green-700 mt-0.5">
                  Refund of ₹{cancelState.amount.toLocaleString("en-IN")} ({cancelState.percent}%) will be credited within 5–7 business days.
                </p>
              ) : (
                <p className="text-xs text-muted mt-0.5">No refund applicable for this cancellation.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted border-t border-border pt-3">
        <span>Booking ID: {b._id.slice(-8).toUpperCase()}</span>
        <span>Booked on {fmtDate(b.createdAt)}</span>
        {b.cancelledBy && <span className="text-red-500">Cancelled by {b.cancelledBy}</span>}
        {b.completedAt && <span>Completed on {fmtDate(b.completedAt)}</span>}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  // What the API says the customer actually has, which is not the same as what
  // we've loaded. null = an older API that doesn't report it.
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [lastPageCount, setLastPageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [cancelStates, setCancelStates] = useState<Record<string, CancelState>>({});

  // /api/booking/my is paginated (20 per page) and reports `total`. Fetching it
  // once with no params silently truncated the list at the first page, and the
  // header then billed that page's length as the customer's lifetime total — so
  // someone with 25 bookings saw 20 and was told "20 bookings total".
  const loadPage = useCallback(async (next: number) => {
    const res = await client.get(`/api/booking/my?page=${next}&limit=${PAGE_SIZE}`);
    const raw = res.data?.bookings ?? res.data ?? [];
    const rows: Booking[] = Array.isArray(raw) ? raw : [];

    setBookings((prev) => {
      // A booking created while the customer is paging shifts every later row
      // down one slot in the createdAt sort, which re-serves a row we already
      // hold. De-dupe rather than render it twice under the same key.
      const seen = new Set(prev.map((b) => b._id));
      return [...prev, ...rows.filter((b) => !seen.has(b._id))];
    });

    const reported = Number(res.data?.total);
    setTotal(Number.isFinite(reported) && reported >= 0 ? reported : null);
    setLastPageCount(rows.length);
    setPage(next);
  }, []);

  useEffect(() => {
    loadPage(1)
      .catch(() => setError("Could not load bookings."))
      .finally(() => setLoading(false));
  }, [loadPage]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setError("");
    try {
      await loadPage(page + 1);
    } catch {
      // Keep the rows already on screen — only the extra page failed.
      setError("Could not load more bookings. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  // An empty page always ends it. Without that floor, a booking created between
  // two page fetches shifts the window, the de-dupe above drops the row we'd
  // already loaded, and `bookings.length < total` stays true forever — leaving a
  // "Load older" button that fetches nothing. Otherwise trust `total`, falling
  // back to "the last page came back full" when the API doesn't report one.
  const hasMore =
    lastPageCount > 0 &&
    (total !== null ? bookings.length < total : lastPageCount === PAGE_SIZE);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setCancelState(id: string, state: CancelState) {
    setCancelStates((prev) => ({ ...prev, [id]: state }));
  }

  async function handleCancelConfirm(bookingId: string) {
    setCancelState(bookingId, "cancelling");
    try {
      const res = await client.patch(`/api/booking/user/cancel/${bookingId}`);
      const refund = res.data?.refund ?? { percent: 0, amount: 0, status: "NONE" };
      setCancelState(bookingId, { percent: refund.percent, amount: refund.amount, status: refund.status });
      // Update booking status in list
      setBookings((prev) =>
        prev.map((b) =>
          b._id === bookingId
            ? { ...b, status: "CANCELLED", cancelledBy: "user", refundAmount: refund.amount, refundStatus: refund.status }
            : b
        )
      );
    } catch (e: any) {
      setCancelState(bookingId, null);
      alert(e.response?.data?.message || "Could not cancel booking. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">My Bookings</h1>
        <p className="text-muted text-sm mt-1">
          {(() => {
            const count = total ?? bookings.length;
            const suffix = `booking${count !== 1 ? "s" : ""} total`;
            // Say what's on screen too, once it's only part of the whole.
            return bookings.length < count
              ? `Showing ${bookings.length} of ${count} ${suffix}`
              : `${count} ${suffix}`;
          })()}
        </p>
      </div>

      {error && <div className="card p-4 text-red-600 text-sm mb-6">{error}</div>}

      {bookings.length === 0 && !error ? (
        <div className="text-center py-20 text-muted">
          <p className="text-5xl mb-4">📋</p>
          <p className="font-semibold text-ink text-lg mb-1">No bookings yet</p>
          <p className="text-sm">Head back to the home page and book your first service.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const cfg = getStatusCfg(b.status);
            const isOpen = expanded.has(b._id);
            const title = serviceTitle(b);
            const cat = serviceCategoryLabel(b);
            const cancelState = cancelStates[b._id] ?? null;

            return (
              <div key={b._id} className="card p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-ink">{title}</h3>
                      {cat && <span className="badge bg-primary/10 text-primary text-xs">{cat}</span>}
                    </div>
                    <p className="text-sm text-muted">
                      {fmtDate(b.scheduledDate)}
                      {b.scheduledTime ? ` · ${fmtTime(b.scheduledTime)}` : ""}
                      {b.estimatedDurationMinutes ? ` · ${fmtDuration(b.estimatedDurationMinutes)}` : ""}
                    </p>
                    {b.address && <p className="text-sm text-muted mt-0.5 truncate">{b.address}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`badge ${cfg.bg} ${cfg.text} flex items-center gap-1.5`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="font-bold text-primary text-sm">
                      ₹{b.totalAmount?.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={() => toggleExpand(b._id)}
                    className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                  >
                    {isOpen ? "▲ Hide details" : "▼ View details"}
                  </button>
                  {!["COMPLETED", "CANCELLED", "PENDING_PAYMENT"].includes(b.status) && (
                    <Link
                      to={`/bookings/${b._id}`}
                      className="text-xs text-primary font-medium hover:underline"
                    >
                      Live status →
                    </Link>
                  )}
                </div>

                {/* Detail panel */}
                {isOpen && (
                  <BookingDetail
                    b={b}
                    cancelState={cancelState}
                    onCancelClick={() => setCancelState(b._id, "confirming")}
                    onCancelConfirm={() => handleCancelConfirm(b._id)}
                    onCancelAbort={() => setCancelState(b._id, null)}
                  />
                )}
              </div>
            );
          })}

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full card p-4 text-sm font-semibold text-primary hover:border-primary transition disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load older bookings"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
