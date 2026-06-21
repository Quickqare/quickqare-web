import React, { useState } from "react";
import client from "../api/client";

type Service = {
  _id: string;
  name: string;
  price: number;
  category?: { name: string } | string | null;
};
type Props = { service: Service; onClose: () => void; onSuccess: () => void };

/* 24-hour values sent to backend; 12-hour labels shown to user */
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

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function BookingModal({ service, onClose, onSuccess }: Props) {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(""); // "HH:MM" 24-hour
  const [address, setAddress] = useState("");
  const [pincode, setPincode] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBook = async () => {
    if (!time) return setError("Please select a time slot.");
    if (!address.trim()) return setError("Please enter your address.");
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim()))
      return setError("Please enter a valid 6-digit pincode.");
    setError("");
    setLoading(true);
    try {
      await client.post("/api/booking/create", {
        // New multi-service format
        services: [{ serviceId: service._id, quantity: 1, price: service.price }],
        scheduledDate: date,
        scheduledTime: time, // backend expects "HH:MM" 24-hour
        address: address.trim(),
        pincode: pincode.trim(),
        notes: notes.trim(),
        // Provide a dummy location so assignment engine has coordinates
        // In production this should come from the browser geolocation
        location: { type: "Point", coordinates: [0, 0] },
      });
      onSuccess();
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Could not place booking. Try again.");
    } finally {
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-ink text-2xl leading-none ml-4"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Preferred Date
            </label>
            <input
              type="date"
              className="input"
              value={date}
              min={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Time slot */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Time Slot
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TIME_SLOTS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTime(t.value)}
                  className={`py-2 px-2 text-xs font-medium rounded-lg border transition ${
                    time === t.value
                      ? "border-primary bg-primary text-white"
                      : "border-border text-ink hover:border-primary"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Service Address
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Flat no, building, street, city…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {/* Pincode */}
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              Pincode
            </label>
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
              Notes (optional)
            </label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Any special instructions…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Price summary */}
          <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-sm text-muted">Starting from</span>
            <span className="font-bold text-ink text-base">
              ₹{service.price?.toLocaleString("en-IN")}
            </span>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            className="btn-primary w-full"
            onClick={handleBook}
            disabled={loading}
          >
            {loading ? "Booking…" : "Confirm Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
