import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { localDateISOPlusDays } from "../lib/date";

const SOCKET_URL = ((import.meta as any).env.VITE_API_BASE_URL || "")
  .replace(/\/api\/?$/, "") || window.location.origin;

type BookingStatus =
  | "PENDING_PAYMENT" | "SEARCHING" | "QUEUED" | "PENDING_ASSIGNMENT"
  | "ASSIGNED" | "CONFIRMED" | "PARTNER_ACCEPTED" | "NO_PARTNER_AVAILABLE"
  | "ON_THE_WAY" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  | "NEEDS_RESCHEDULING";

type Booking = {
  _id: string;
  status: BookingStatus;
  services: { name: string; quantity: number; lineTotal: number }[];
  serviceCategory?: string;
  scheduledDate: string;
  scheduledTime: string;
  address?: string;
  houseDetails?: string;
  pincode?: string;
  totalAmount: number;
  partner?: { _id: string; name: string; phone: string; rating?: number; selfieUrl?: string; selfieVerificationStatus?: string } | null;
  estimateStatus?: "none" | "pending" | "approved" | "rejected";
  estimateItems?: { name: string; price: number; quantity: number }[];
  estimateTotal?: number;
  estimatePayment?: { status?: "NONE" | "PENDING" | "PAID" | "FAILED" };
  etaMinutes?: number;
  cancelledBy?: string;
  cancelReason?: string;
  refundAmount?: number;
  refundStatus?: string;
  payment?: { status: string };
  rescheduleReason?: string;
  partnerReportedIssue?: string | null;
  createdAt?: string;
  scheduledStartAt?: string;
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

const STATUS_STEPS: { status: BookingStatus; label: string; icon: string }[] = [
  { status: "SEARCHING",        label: "Finding Partner",   icon: "🔍" },
  { status: "PARTNER_ACCEPTED", label: "Partner Accepted",  icon: "✅" },
  { status: "ON_THE_WAY",       label: "On the Way",        icon: "🚗" },
  { status: "ARRIVED",          label: "Arrived",           icon: "📍" },
  { status: "IN_PROGRESS",      label: "In Progress",       icon: "🔧" },
  { status: "COMPLETED",        label: "Completed",         icon: "🎉" },
];

const ORDER: Record<string, number> = {
  PENDING_PAYMENT: 0, SEARCHING: 1, QUEUED: 1, PENDING_ASSIGNMENT: 1,
  ASSIGNED: 2, CONFIRMED: 2, PARTNER_ACCEPTED: 2, NO_PARTNER_AVAILABLE: 1,
  ON_THE_WAY: 3, ARRIVED: 4, IN_PROGRESS: 5, COMPLETED: 6, CANCELLED: -1, NEEDS_RESCHEDULING: -1,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export default function BookingStatusPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelState, setCancelState] = useState<"idle" | "confirming" | "cancelling">("idle");
  const [showEstimate, setShowEstimate] = useState(false);
  const [estimateAction, setEstimateAction] = useState<"approving" | "rejecting" | "paying" | null>(null);
  // Fee-inclusive estimate detail (payable total + paymentStatus), loaded from
  // GET /estimate when the modal opens — the booking payload only carries the
  // parts subtotal, not fees/GST or the payment state.
  const [estimateDetail, setEstimateDetail] = useState<{
    totalAmount: number;
    paymentStatus: "NONE" | "PENDING" | "PAID" | "FAILED";
    status: "none" | "pending" | "approved" | "rejected";
  } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [liveSlots, setLiveSlots] = useState<{ start: string; label: string }[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState("");
  const socketRef = useRef<Socket | null>(null);

  // Fetch booking
  useEffect(() => {
    if (!bookingId) return;
    client.get(`/api/booking/${bookingId}`)
      .then((res) => setBooking(res.data?.booking ?? res.data))
      .catch(() => setError("Booking not found."))
      .finally(() => setLoading(false));
  }, [bookingId]);

  // Socket.io for live updates
  useEffect(() => {
    if (!user?._id || !bookingId) return;
    // The session cookie is httpOnly, so we can't pass a token in the handshake.
    // withCredentials makes the browser send the cookie; the server reads it.
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("joinUserRoom", user._id);
    });

    socket.on("booking_update", (data: any) => {
      if (String(data?.bookingId) !== String(bookingId)) return;
      setBooking((prev) => prev ? {
        ...prev,
        status: data.status ?? prev.status,
        etaMinutes: data.etaMinutes ?? prev.etaMinutes,
        partner: data.partner ?? prev.partner,
        rescheduleReason: data.rescheduleReason ?? prev.rescheduleReason,
        partnerReportedIssue: data.partnerReportedIssue ?? prev.partnerReportedIssue,
        ...(data.cancelledBy ? { cancelledBy: data.cancelledBy } : {}),
        ...(data.cancelReason ? { cancelReason: data.cancelReason } : {}),
        ...(data.refundAmount != null ? { refundAmount: data.refundAmount } : {}),
      } : prev);
      // Refetch when a partner is assigned to get full partner info (including selfie)
      // and on CANCELLED to get accurate refund details from DB.
      if (["CANCELLED", "ASSIGNED", "CONFIRMED", "PARTNER_ACCEPTED"].includes(data.status)) {
        client.get(`/api/booking/${bookingId}`)
          .then((r) => setBooking(r.data?.booking ?? r.data))
          .catch(() => {});
      }
    });

    return () => { socket.disconnect(); };
  }, [user?._id, bookingId]);

  // Load the fee-inclusive estimate detail (payable total + payment state) when
  // the modal opens. Falls back silently to the booking's parts subtotal.
  const openEstimate = async () => {
    setShowEstimate(true);
    try {
      const res = await client.get(`/api/booking/${bookingId}/estimate`);
      const e = res.data?.estimate;
      if (e) {
        setEstimateDetail({
          totalAmount: Number(e.totalAmount || 0),
          paymentStatus: e.paymentStatus || "NONE",
          status: e.status || "pending",
        });
      }
    } catch { /* keep the subtotal fallback from the booking payload */ }
  };

  const handleRejectEstimate = async () => {
    setEstimateAction("rejecting");
    try {
      await client.post(`/api/booking/${bookingId}/estimate/respond`, { approved: false });
      setBooking((prev) => prev ? { ...prev, estimateStatus: "rejected" } : prev);
      setShowEstimate(false);
    } catch { } finally {
      setEstimateAction(null);
    }
  };

  // Approve (if still pending) then pay for the estimate: same order → Razorpay
  // → verify sequence as a normal booking, against the estimate endpoints. The
  // technician is only credited for the extra work once this reaches PAID.
  const handleApproveAndPayEstimate = async () => {
    if (typeof (window as any).Razorpay === "undefined") {
      setError("Couldn't load the payment window. Disable any ad blocker for this site and try again.");
      return;
    }

    setEstimateAction("paying");
    try {
      // Approve only if it hasn't been approved already (a retry after a dropped
      // checkout is already "approved" — respond would 409 then).
      const alreadyApproved =
        estimateDetail?.status === "approved" || booking?.estimateStatus === "approved";
      if (!alreadyApproved) {
        await client.post(`/api/booking/${bookingId}/estimate/respond`, { approved: true });
        setBooking((prev) => prev ? { ...prev, estimateStatus: "approved" } : prev);
      }

      const orderRes = await client.post(`/api/booking/${bookingId}/estimate/create-order`);
      if (!orderRes.data?.success) throw new Error(orderRes.data?.message || "Payment order failed");
      const { order } = orderRes.data;

      const rzp = new (window as any).Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || "INR",
        order_id: order.id,
        name: "QuickQare",
        description: "Additional parts / service",
        theme: { color: "#22A06B" },
        handler: async (response: any) => {
          try {
            await client.post(`/api/booking/${bookingId}/estimate/verify`, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            setEstimateDetail((prev) => prev ? { ...prev, paymentStatus: "PAID" } : prev);
            setBooking((prev) =>
              prev ? { ...prev, estimatePayment: { status: "PAID" } } : prev
            );
            setShowEstimate(false);
          } catch {
            setError("Payment verification failed. Please contact support.");
          } finally {
            setEstimateAction(null);
          }
        },
        modal: {
          ondismiss: () => setEstimateAction(null),
        },
      });
      rzp.open();
    } catch (e: any) {
      setError(e.response?.data?.message ?? e.message ?? "Could not start payment. Try again.");
      setEstimateAction(null);
    }
  };

  const handleCancel = async () => {
    setCancelState("cancelling");
    try {
      const res = await client.patch(`/api/booking/user/cancel/${bookingId}`);
      const refund = res.data?.refund ?? { amount: 0, status: "NONE" };
      setBooking((prev) => prev ? {
        ...prev, status: "CANCELLED", cancelledBy: "user",
        refundAmount: refund.amount, refundStatus: refund.status,
      } : prev);
      setCancelState("idle");
    } catch (e: any) {
      alert(e.response?.data?.message || "Could not cancel.");
      setCancelState("idle");
    }
  };

  // Cancel after the partner has arrived — no refund (the professional travelled
  // and reached the location). Distinct from the time-based cancel above.
  const handleCancelArrived = async () => {
    setCancelState("cancelling");
    try {
      await client.patch(`/api/booking/user/cancel/${bookingId}`, {
        reason: "Customer cancelled after professional arrived",
      });
      setBooking((prev) => prev ? {
        ...prev, status: "CANCELLED", cancelledBy: "user",
        refundAmount: 0, refundStatus: "NONE",
      } : prev);
      setCancelState("idle");
    } catch (e: any) {
      alert(e.response?.data?.message || "Could not cancel.");
      setCancelState("idle");
    }
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error || !booking) return (
    <div className="max-w-xl mx-auto px-4 py-10 text-center">
      <p className="text-red-500">{error || "Booking not found"}</p>
      <button onClick={() => navigate("/bookings")} className="mt-4 btn-primary">My Bookings</button>
    </div>
  );

  const currentOrder = ORDER[booking.status] ?? 0;
  const isCancellable = !["IN_PROGRESS", "COMPLETED", "CANCELLED", "NEEDS_RESCHEDULING"].includes(booking.status);
  const isNeedsRescheduling = booking.status === "NEEDS_RESCHEDULING";

  // Live slot availability — same endpoint the booking flow uses, so the
  // customer can only pick a slot that actually has a free partner.
  const fetchAvailableSlots = async (date: string) => {
    if (!date || !booking) return;
    const services = (booking.services || [])
      .map((s: any) => (s.serviceId ? { serviceId: String(s.serviceId), quantity: s.quantity || 1 } : null))
      .filter(Boolean);
    const coords = (booking as any).location?.coordinates; // [lng, lat]
    setSlotLoading(true);
    setSlotError("");
    try {
      const res = await client.post("/api/booking/available-slots", {
        date,
        services,
        serviceCategory: booking.serviceCategory,
        pincode: booking.pincode || undefined,
        latitude: Array.isArray(coords) ? coords[1] : undefined,
        longitude: Array.isArray(coords) ? coords[0] : undefined,
      });
      const rows: any[] = Array.isArray(res.data?.slots) ? res.data.slots : [];
      const mapped = rows
        .map((slot) => {
          const start = String(slot?.time || "").trim();
          if (!start) return null;
          const [hh, mm] = start.split(":").map((v: string) => Number(v) || 0);
          const end = new Date();
          end.setHours(hh, mm + 60, 0, 0);
          const endStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
          return { start, label: `${start} - ${endStr}` };
        })
        .filter(Boolean) as { start: string; label: string }[];
      setLiveSlots(mapped);
      if (!mapped.length) setSlotError("No slots available for this date. Please pick another date.");
    } catch (e: any) {
      setLiveSlots([]);
      setSlotError(e.response?.data?.message || "Couldn't load available slots. Please try another date.");
    } finally {
      setSlotLoading(false);
    }
  };

  const handleSelectRescheduleDate = (date: string) => {
    setRescheduleDate(date);
    setRescheduleTime("");
    fetchAvailableSlots(date);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) { alert("Please select a date and time."); return; }
    setRescheduling(true);
    try {
      await client.patch(`/api/booking/user/reschedule/${bookingId}`, {
        scheduledDate: rescheduleDate,
        scheduledTime: rescheduleTime,
      });
      setBooking((prev) => prev ? { ...prev, status: "SEARCHING" } : prev);
    } catch (e: any) {
      alert(e.response?.data?.message || "Reschedule failed. Please try again.");
    } finally {
      setRescheduling(false);
    }
  };

  // Cancelling from a reschedule is the company's fault, so the backend grants a
  // full refund. Distinct messaging from the normal time-based cancel.
  const handleCancelReschedule = async () => {
    if (!window.confirm("Since we couldn't complete your booking, you'll receive a full refund. Cancel instead of rescheduling?")) return;
    await handleCancel();
  };
  const serviceName = booking.services?.length
    ? (booking.services.length === 1 ? booking.services[0].name : `${booking.services[0].name} +${booking.services.length - 1} more`)
    : booking.serviceCategory ?? "Service";

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/bookings")} className="flex items-center gap-1.5 text-sm text-muted hover:text-ink mb-6 transition">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
        </svg>
        My Bookings
      </button>

      {/* Header card */}
      <div className="card p-5 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="font-bold text-ink text-lg leading-tight">{serviceName}</h1>
            <p className="text-sm text-muted mt-0.5">
              {fmtDate(booking.scheduledDate)} · {fmtTime(booking.scheduledTime)}
            </p>
            {booking.address && <p className="text-sm text-muted mt-0.5 truncate">{booking.address}</p>}
          </div>
          <span className="font-bold text-primary shrink-0">₹{booking.totalAmount?.toLocaleString("en-IN")}</span>
        </div>

        {/* ETA */}
        {booking.status === "ON_THE_WAY" && booking.etaMinutes && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-sm text-orange-700 font-semibold">
            🚗 Partner arriving in ~{booking.etaMinutes} min
          </div>
        )}

        {/* Reschedule required banner */}
        {isNeedsRescheduling && (
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-800 mb-1">📅 Rescheduling Required</p>
            {booking.rescheduleReason && (
              <p className="text-sm text-blue-700 mb-3 leading-relaxed">
                {booking.rescheduleReason}, we are unable to complete your booking at the scheduled time.
                We'd like to reschedule your service at no extra charge.
              </p>
            )}
            <p className="text-xs font-semibold text-blue-600 mb-2">Select a new date:</p>
            <input
              type="date"
              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mb-3"
              value={rescheduleDate}
              min={localDateISOPlusDays(1)}
              onChange={(e) => handleSelectRescheduleDate(e.target.value)}
            />
            {rescheduleDate && (
              <>
                <p className="text-xs font-semibold text-blue-600 mb-2">Select a time slot:</p>
                {slotLoading ? (
                  <p className="text-sm text-blue-700 mb-3">Checking available slots…</p>
                ) : slotError ? (
                  <p className="text-sm text-red-600 mb-3">{slotError}</p>
                ) : (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {liveSlots.map((slot) => (
                      <button
                        key={slot.start}
                        onClick={() => setRescheduleTime(slot.start)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                          rescheduleTime === slot.start
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-blue-700 border-blue-200 hover:border-blue-400"
                        }`}
                      >
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <button
              onClick={handleReschedule}
              disabled={rescheduling || !rescheduleDate || !rescheduleTime}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {rescheduling ? "Rescheduling…" : "Confirm New Slot"}
            </button>

            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-blue-200" />
              <span className="text-xs text-blue-500">or</span>
              <div className="flex-1 h-px bg-blue-200" />
            </div>

            <button
              onClick={handleCancelReschedule}
              disabled={cancelState === "cancelling"}
              className="w-full py-2.5 border border-red-300 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 transition disabled:opacity-50"
            >
              {cancelState === "cancelling" ? "Cancelling…" : "Cancel & Get Full Refund"}
            </button>
          </div>
        )}

        {/* Estimate alert — pending review, or approved but not yet paid */}
        {(booking.estimateStatus === "pending" ||
          (booking.estimateStatus === "approved" &&
            booking.estimatePayment?.status !== "PAID" &&
            (booking.estimateItems?.length ?? 0) > 0)) && (
          <button
            onClick={openEstimate}
            className="mt-3 w-full bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-left"
          >
            {booking.estimateStatus === "approved" ? (
              <>
                <p className="text-sm font-bold text-amber-700">💳 Estimate Awaiting Payment</p>
                <p className="text-xs text-amber-600 mt-0.5">You approved the extra work. Tap to complete payment →</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-amber-700">⚠️ Estimate Pending Approval</p>
                <p className="text-xs text-amber-600 mt-0.5">Your partner submitted an estimate. Tap to review →</p>
              </>
            )}
          </button>
        )}
      </div>

      {/* Status timeline */}
      {booking.status !== "CANCELLED" ? (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-ink text-sm mb-4">Booking Status</h2>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, i) => {
              const stepOrder = ORDER[step.status] ?? 0;
              const done = currentOrder > stepOrder;
              const active = currentOrder === stepOrder;
              return (
                <div key={step.status} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                    done ? "bg-primary text-white" : active ? "bg-primary/10 border-2 border-primary" : "bg-gray-100"
                  }`}>
                    {done ? "✓" : step.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${active ? "text-primary" : done ? "text-ink" : "text-muted"}`}>
                      {step.label}
                    </p>
                  </div>
                  {active && (
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card p-5 mb-4">
          {typeof booking.cancelReason === "string" && booking.cancelReason.includes("No replacement partner") ? (
            <>
              <p className="font-semibold text-red-600 mb-1">😔 We couldn't find a professional</p>
              <p className="text-sm text-muted mb-1">
                Our partner cancelled and we were unable to find a replacement for your slot. We're sorry for the inconvenience.
              </p>
            </>
          ) : (
            <p className="font-semibold text-red-600 mb-1">Booking Cancelled</p>
          )}
          {booking.refundAmount != null && booking.refundAmount > 0 ? (
            <p className="text-sm text-green-600 mt-1">
              Refund of ₹{booking.refundAmount.toLocaleString("en-IN")} — {booking.refundStatus?.toLowerCase() ?? "pending"}
            </p>
          ) : (
            <p className="text-sm text-muted mt-1">No refund applicable for this cancellation.</p>
          )}
        </div>
      )}

      {/* Partner arrived but customer not ready */}
      {booking.status === "ARRIVED" && booking.partnerReportedIssue && (
        <div className="card p-5 mb-4 border-amber-300 bg-amber-50">
          <p className="font-semibold text-amber-800 mb-1">📍 Your professional has arrived</p>
          <p className="text-sm text-amber-900 mb-2 leading-relaxed">
            {booking.partnerReportedIssue === "CUSTOMER_ASKED_LATER"
              ? "We noted you asked them to come later. They can't wait at your location — if you can't proceed now, you can cancel below."
              : "They couldn't reach you at your location. If you can't proceed now, you can cancel below."}
          </p>
          <p className="text-xs font-semibold text-amber-700 mb-3">
            Note: no refund applies after the professional has arrived.
          </p>
          <button
            onClick={handleCancelArrived}
            disabled={cancelState === "cancelling"}
            className="w-full py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50"
          >
            {cancelState === "cancelling" ? "Cancelling…" : "Cancel Booking (No Refund)"}
          </button>
        </div>
      )}

      {/* Partner info */}
      {booking.partner && (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-ink text-sm mb-3">Your Service Partner</h2>
          <div className="flex items-center gap-3">
            {booking.partner.selfieUrl ? (
              <div className="relative shrink-0">
                <img
                  src={booking.partner.selfieUrl}
                  alt={booking.partner.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-border"
                />
                {booking.partner.selfieVerificationStatus === "APPROVED" && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-white">✓</span>
                )}
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {booking.partner.name?.[0]?.toUpperCase() ?? "P"}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-ink">{booking.partner.name}</p>
                {booking.partner.selfieVerificationStatus === "APPROVED" && (
                  <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Verified</span>
                )}
              </div>
              {booking.partner.rating && (
                <p className="text-xs text-muted">⭐ {booking.partner.rating.toFixed(1)} rating</p>
              )}
            </div>
            <a
              href={`tel:${booking.partner.phone}`}
              className="flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary rounded-xl px-3 py-2 hover:bg-primary hover:text-white transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z"/>
              </svg>
              Call
            </a>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {/* The backend only accepts complaints against COMPLETED/CANCELLED
            bookings — showing this as a live action on an in-progress booking
            would deep-link somewhere that always rejects the submission. */}
        {["COMPLETED", "CANCELLED"].includes(booking.status) ? (
          <button onClick={() => navigate(`/complaints/new?bookingId=${bookingId}`)} className="w-full card p-4 text-left flex items-center gap-3 hover:border-primary transition">
            <span className="text-xl">📝</span>
            <div>
              <p className="font-semibold text-ink text-sm">Raise a Complaint</p>
              <p className="text-xs text-muted">Report an issue with this booking</p>
            </div>
          </button>
        ) : (
          <div className="w-full card p-4 flex items-center gap-3 opacity-60">
            <span className="text-xl">📝</span>
            <div>
              <p className="font-semibold text-ink text-sm">Raise a Complaint</p>
              <p className="text-xs text-muted">Available once this booking is completed or cancelled</p>
            </div>
          </div>
        )}

        {isCancellable && (
          <div>
            {cancelState === "idle" && (
              <button onClick={() => setCancelState("confirming")} className="w-full text-sm text-red-500 hover:text-red-700 font-medium py-2 transition">
                Cancel Booking
              </button>
            )}
            {cancelState === "confirming" && (
              <div className="card p-4 border-red-200">
                <p className="text-sm font-semibold text-red-700 mb-1">Cancel this booking?</p>
                <p className="text-xs text-muted mb-3">
                  {(() => {
                    if (booking.status === "ARRIVED") {
                      return "Your professional has already reached your location — no refund applies if you cancel now.";
                    }
                    // Grace window (backend freeCancelUntil): last-minute
                    // orders get a short free-cancel window from booking
                    // regardless of the tier they'd otherwise land in.
                    if (booking.freeCancelUntil && Date.now() <= new Date(booking.freeCancelUntil).getTime()) {
                      const until = new Date(booking.freeCancelUntil);
                      return `You're within your free-cancellation window (until ${until.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}) — you'll receive a 100% refund.`;
                    }
                    // Legacy cake orders: refund keyed on time since booking.
                    const sinceTiers = booking.sinceBookingTiersSnapshot;
                    if (booking.cancellationPolicyTypeSnapshot === "SINCE_BOOKING" && sinceTiers?.length && booking.createdAt) {
                      const first = sinceTiers[0];
                      const lastPercent = sinceTiers[sinceTiers.length - 1]?.refundPercent ?? 50;
                      const hoursSinceBooking = (Date.now() - new Date(booking.createdAt).getTime()) / 36e5;
                      return hoursSinceBooking <= first.maxHoursAfterBooking
                        ? `You're within ${first.maxHoursAfterBooking}h of booking — you'll receive a ${first.refundPercent}% refund.`
                        : `More than ${first.maxHoursAfterBooking}h have passed since booking — only ${lastPercent}% will be refunded.`;
                    }
                    // Preview the refund % this cancel lands on from the
                    // booking's tier snapshot (same rule as the backend's
                    // calculateRefund, including its default tiers).
                    const tiers = booking.cancellationTiersSnapshot?.length
                      ? booking.cancellationTiersSnapshot
                      : [
                          { minHoursBefore: 24, refundPercent: 100 },
                          { minHoursBefore: 4, refundPercent: 75 },
                          { minHoursBefore: 1, refundPercent: 50 },
                          { minHoursBefore: 0, refundPercent: 25 },
                        ];
                    const startAt = booking.scheduledStartAt ? new Date(booking.scheduledStartAt).getTime() : NaN;
                    if (Number.isFinite(startAt)) {
                      const hoursToService = (startAt - Date.now()) / 36e5;
                      const tier = [...tiers]
                        .sort((a, b) => b.minHoursBefore - a.minHoursBefore)
                        .find((t) => hoursToService >= t.minHoursBefore);
                      if (tier) {
                        return `Cancelling now refunds ${tier.refundPercent}% of the amount paid.`;
                      }
                    }
                    return "Refund depends on how far ahead you cancel.";
                  })()}
                </p>
                <div className="flex gap-2">
                  <button onClick={booking.status === "ARRIVED" ? handleCancelArrived : handleCancel} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition">
                    Yes, cancel
                  </button>
                  <button onClick={() => setCancelState("idle")} className="px-4 py-2 border border-border text-xs font-bold rounded-lg hover:border-ink transition">
                    Keep booking
                  </button>
                </div>
              </div>
            )}
            {cancelState === "cancelling" && (
              <div className="flex items-center gap-2 text-sm text-muted py-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Cancelling…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Estimate modal */}
      {showEstimate && booking.estimateItems && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-ink">Partner's Estimate</h3>
              <button onClick={() => setShowEstimate(false)} className="text-gray-400 hover:text-ink text-2xl leading-none">×</button>
            </div>
            <div className="space-y-2 mb-4">
              {booking.estimateItems.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-ink">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span>
                  <span className="font-semibold text-ink">₹{(item.price * (item.quantity || 1)).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-ink border-t border-border pt-2 mt-2">
                <span>Total Payable</span>
                <span className="text-primary">
                  ₹{(estimateDetail?.totalAmount ?? booking.estimateTotal ?? 0).toLocaleString("en-IN")}
                </span>
              </div>
              {estimateDetail && estimateDetail.totalAmount > (booking.estimateTotal ?? 0) && (
                <p className="text-[11px] text-muted text-right">Includes platform fee &amp; GST</p>
              )}
            </div>

            {estimateDetail?.paymentStatus === "PAID" ? (
              <p className="text-center text-sm font-bold text-green-600 py-2">
                ✓ Paid — your technician can continue the work.
              </p>
            ) : (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={handleApproveAndPayEstimate}
                    disabled={!!estimateAction}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    {estimateAction === "paying"
                      ? "Processing…"
                      : `Approve & Pay ₹${(estimateDetail?.totalAmount ?? booking.estimateTotal ?? 0).toLocaleString("en-IN")}`}
                  </button>
                  {/* Reject is only possible while still pending — once approved the
                      backend won't reverse it (it may already be paid). */}
                  {booking.estimateStatus === "pending" && estimateDetail?.status !== "approved" && (
                    <button
                      onClick={handleRejectEstimate}
                      disabled={!!estimateAction}
                      className="flex-1 border border-red-300 text-red-600 rounded-xl py-2.5 font-semibold text-sm hover:bg-red-50 transition disabled:opacity-50"
                    >
                      {estimateAction === "rejecting" ? "Rejecting…" : "Reject"}
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted text-center mt-3">🔒 Secured by Razorpay</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
