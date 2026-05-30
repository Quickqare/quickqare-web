import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import client from "../api/client";
import { useAuth } from "../contexts/AuthContext";

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
  partner?: { _id: string; name: string; phone: string; rating?: number } | null;
  estimateStatus?: "none" | "pending" | "approved" | "rejected";
  estimateItems?: { name: string; price: number; quantity: number }[];
  estimateTotal?: number;
  etaMinutes?: number;
  cancelledBy?: string;
  refundAmount?: number;
  refundStatus?: string;
  payment?: { status: string };
  rescheduleReason?: string;
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
  const [estimateAction, setEstimateAction] = useState<"approving" | "rejecting" | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
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
    const token = localStorage.getItem("qq_web_token");

    const socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
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
      } : prev);
    });

    return () => { socket.disconnect(); };
  }, [user?._id, bookingId]);

  const handleEstimateRespond = async (approved: boolean) => {
    setEstimateAction(approved ? "approving" : "rejecting");
    try {
      await client.post(`/api/booking/${bookingId}/estimate/respond`, { approved });
      setBooking((prev) => prev ? { ...prev, estimateStatus: approved ? "approved" : "rejected" } : prev);
      setShowEstimate(false);
    } catch { } finally {
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
            <p className="text-xs font-semibold text-blue-600 mb-2">Select a new date and time:</p>
            <div className="flex gap-2 mb-3">
              <input
                type="date"
                className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                value={rescheduleDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
              <select
                className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
              >
                <option value="">Select time</option>
                {["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00"].map((t) => (
                  <option key={t} value={t}>
                    {Number(t.split(":")[0]) >= 12
                      ? `${Number(t.split(":")[0]) === 12 ? 12 : Number(t.split(":")[0]) - 12}:00 PM`
                      : `${Number(t.split(":")[0])}:00 AM`}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleReschedule}
              disabled={rescheduling || !rescheduleDate || !rescheduleTime}
              className="w-full py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {rescheduling ? "Rescheduling…" : "Confirm New Slot"}
            </button>
          </div>
        )}

        {/* Estimate pending alert */}
        {booking.estimateStatus === "pending" && (
          <button
            onClick={() => setShowEstimate(true)}
            className="mt-3 w-full bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-left"
          >
            <p className="text-sm font-bold text-amber-700">⚠️ Estimate Pending Approval</p>
            <p className="text-xs text-amber-600 mt-0.5">Your partner submitted an estimate. Tap to review →</p>
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
          <p className="font-semibold text-red-600 mb-1">Booking Cancelled</p>
          {booking.cancelledBy && <p className="text-sm text-muted">Cancelled by {booking.cancelledBy}</p>}
          {booking.refundAmount != null && booking.refundAmount > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Refund of ₹{booking.refundAmount.toLocaleString("en-IN")} — {booking.refundStatus?.toLowerCase() ?? "pending"}
            </p>
          )}
        </div>
      )}

      {/* Partner info */}
      {booking.partner && (
        <div className="card p-5 mb-4">
          <h2 className="font-semibold text-ink text-sm mb-3">Your Service Partner</h2>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
              {booking.partner.name?.[0]?.toUpperCase() ?? "P"}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-ink">{booking.partner.name}</p>
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
        <button onClick={() => navigate(`/complaints/new?bookingId=${bookingId}`)} className="w-full card p-4 text-left flex items-center gap-3 hover:border-primary transition">
          <span className="text-xl">📝</span>
          <div>
            <p className="font-semibold text-ink text-sm">Raise a Complaint</p>
            <p className="text-xs text-muted">Report an issue with this booking</p>
          </div>
        </button>

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
                <p className="text-xs text-muted mb-3">Refund depends on how far ahead you cancel (100% if &gt;24h before service).</p>
                <div className="flex gap-2">
                  <button onClick={handleCancel} className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition">
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
                <span>Total</span>
                <span className="text-primary">₹{booking.estimateTotal?.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleEstimateRespond(true)}
                disabled={!!estimateAction}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {estimateAction === "approving" ? "Approving…" : "Approve"}
              </button>
              <button
                onClick={() => handleEstimateRespond(false)}
                disabled={!!estimateAction}
                className="flex-1 border border-red-300 text-red-600 rounded-xl py-2.5 font-semibold text-sm hover:bg-red-50 transition disabled:opacity-50"
              >
                {estimateAction === "rejecting" ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
