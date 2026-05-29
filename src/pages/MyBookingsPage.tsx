import React, { useEffect, useState } from "react";
import client from "../api/client";

/* ── Types matching Booking.js schema exactly ── */
type BookingService = {
  serviceId: string;
  name: string;
  price: number;
  lineTotal: number;
  quantity: number;
  category?: string;
  subCategory?: string;
};

type Booking = {
  _id: string;
  // Multi-service cart (new flow)
  services: BookingService[];
  // Legacy single-service (old flow)
  serviceCategory?: string;
  // Schedule
  scheduledDate: string;
  scheduledTime: string;
  estimatedDurationMinutes?: number;
  // Location
  address?: string;
  pincode?: string;
  // Pricing
  baseAmount: number;
  discountAmount?: number;
  couponCode?: string;
  couponDiscountAmount?: number;
  platformFeeAmount?: number;
  gstAmount?: number;
  totalAmount: number;
  // Payment
  payment?: { status: "PENDING" | "PAID" | "FAILED" };
  // Status
  status: string;
  cancelledBy?: "user" | "partner" | null;
  completedAt?: string;
  // Assignment
  assignmentStage?: number;
  createdAt: string;
};

/* ── Status display map ── */
type StatusCfg = { bg: string; text: string; dot: string; label: string };
const STATUS_MAP: Record<string, StatusCfg> = {
  PENDING_PAYMENT:     { bg: "bg-amber-50",   text: "text-amber-700",  dot: "bg-amber-400",  label: "Awaiting Payment" },
  PENDING_ASSIGNMENT:  { bg: "bg-yellow-50",  text: "text-yellow-700", dot: "bg-yellow-400", label: "Finding Partner" },
  QUEUED:              { bg: "bg-yellow-50",  text: "text-yellow-700", dot: "bg-yellow-400", label: "Queued" },
  SEARCHING:           { bg: "bg-blue-50",    text: "text-blue-600",   dot: "bg-blue-400",   label: "Finding Partner" },
  ASSIGNED:            { bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-400", label: "Assigned" },
  CONFIRMED:           { bg: "bg-blue-50",    text: "text-blue-700",   dot: "bg-blue-500",   label: "Confirmed" },
  NO_PARTNER_AVAILABLE:{ bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-400", label: "No Partner Found" },
  PARTNER_ACCEPTED:    { bg: "bg-indigo-50",  text: "text-indigo-700", dot: "bg-indigo-500", label: "Partner Accepted" },
  ON_THE_WAY:          { bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500", label: "On the Way" },
  IN_PROGRESS:         { bg: "bg-orange-50",  text: "text-orange-700", dot: "bg-orange-500", label: "In Progress" },
  COMPLETED:           { bg: "bg-green-50",   text: "text-green-700",  dot: "bg-green-500",  label: "Completed" },
  CANCELLED:           { bg: "bg-red-50",     text: "text-red-700",    dot: "bg-red-400",    label: "Cancelled" },
};

function getStatusCfg(status: string): StatusCfg {
  return STATUS_MAP[status] ?? { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400", label: status };
}

/* ── Helpers ── */
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
  return b.serviceCategory ? b.serviceCategory.charAt(0).toUpperCase() + b.serviceCategory.slice(1) : "Service";
}

function serviceCategoryLabel(b: Booking): string | null {
  if (b.services?.[0]?.category) return b.services[0].category;
  if (b.serviceCategory) return b.serviceCategory;
  return null;
}

/* ── Booking Detail Panel ── */
function BookingDetail({ b }: { b: Booking }) {
  const hasDiscount = (b.discountAmount ?? 0) > 0 || (b.couponDiscountAmount ?? 0) > 0;
  const feesAndTaxes = (b.platformFeeAmount ?? 0) + (b.gstAmount ?? 0);
  const hasFeesAndTaxes = feesAndTaxes > 0;
  const discount = (b.discountAmount ?? 0) + (b.couponDiscountAmount ?? 0);

  return (
    <div className="border-t border-border mt-4 pt-4 space-y-4">
      {/* Services list */}
      {b.services?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Services</p>
          <div className="space-y-1.5">
            {b.services.map((s, i) => (
              <div key={i} className="flex justify-between items-start text-sm">
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-ink">{s.name}</span>
                  {s.quantity > 1 && (
                    <span className="ml-1.5 text-muted text-xs">× {s.quantity}</span>
                  )}
                  {s.subCategory && (
                    <span className="ml-1.5 text-xs text-primary">{s.subCategory}</span>
                  )}
                </div>
                <span className="text-ink shrink-0">₹{s.lineTotal?.toLocaleString("en-IN")}</span>
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
          {b.estimatedDurationMinutes && (
            <span>⏱ {fmtDuration(b.estimatedDurationMinutes)}</span>
          )}
        </div>
      </div>

      {/* Location */}
      {(b.address || b.pincode) && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Address</p>
          <p className="text-sm text-ink">{b.address || "—"}</p>
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
          {b.payment.status === "PAID" && (
            <span className="text-green-600 font-medium">✓ Paid</span>
          )}
          {b.payment.status === "PENDING" && (
            <span className="text-amber-600 font-medium">⏳ Pending</span>
          )}
          {b.payment.status === "FAILED" && (
            <span className="text-red-600 font-medium">✗ Failed</span>
          )}
        </div>
      )}

      {/* Extra info */}
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted border-t border-border pt-3">
        <span>Booking ID: {b._id.slice(-8).toUpperCase()}</span>
        <span>Booked on {fmtDate(b.createdAt)}</span>
        {b.cancelledBy && (
          <span className="text-red-500">Cancelled by {b.cancelledBy}</span>
        )}
        {b.completedAt && (
          <span>Completed on {fmtDate(b.completedAt)}</span>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    client
      .get("/api/booking/my")
      .then((res) => {
        const raw = res.data?.bookings ?? res.data ?? [];
        setBookings(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setError("Could not load bookings."))
      .finally(() => setLoading(false));
  }, []);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          {bookings.length} booking{bookings.length !== 1 ? "s" : ""} total
        </p>
      </div>

      {error && (
        <div className="card p-4 text-red-600 text-sm mb-6">{error}</div>
      )}

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

            return (
              <div key={b._id} className="card p-5">
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-ink">{title}</h3>
                      {cat && (
                        <span className="badge bg-primary/10 text-primary text-xs">{cat}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted">
                      {fmtDate(b.scheduledDate)}
                      {b.scheduledTime ? ` · ${fmtTime(b.scheduledTime)}` : ""}
                      {b.estimatedDurationMinutes ? ` · ${fmtDuration(b.estimatedDurationMinutes)}` : ""}
                    </p>
                    {b.address && (
                      <p className="text-sm text-muted mt-0.5 truncate">{b.address}</p>
                    )}
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

                {/* Expand toggle */}
                <button
                  onClick={() => toggleExpand(b._id)}
                  className="mt-3 text-xs text-primary font-medium flex items-center gap-1 hover:underline"
                >
                  {isOpen ? "▲ Hide details" : "▼ View details"}
                </button>

                {/* Detail panel */}
                {isOpen && <BookingDetail b={b} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
