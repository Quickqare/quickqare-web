import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

type Props = { onClose: () => void };

export default function LoginModal({ onClose }: Props) {
  const { sendOtp, verifyOtp } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return setError("Enter a valid 10-digit phone number.");
    setError("");
    setLoading(true);
    const res = await sendOtp(cleaned);
    setLoading(false);
    if (res.success) setStep("otp");
    else setError(res.message || "Could not send OTP.");
  };

  const handleVerify = async () => {
    if (otp.length < 4) return setError("Enter the OTP you received.");
    setError("");
    setLoading(true);
    const res = await verifyOtp(phone.replace(/\D/g, ""), otp);
    setLoading(false);
    if (res.success) onClose();
    else setError(res.message || "Invalid OTP.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="card w-full max-w-sm p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-ink">
              {step === "phone" ? "Log in to QuickQare" : "Verify OTP"}
            </h2>
            <p className="text-sm text-muted mt-1">
              {step === "phone"
                ? "Enter your phone number to continue"
                : `OTP sent to +91 ${phone}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-ink transition text-2xl leading-none">×</button>
        </div>

        {/* Fields */}
        {step === "phone" ? (
          <div className="space-y-4">
            <div className="flex">
              <span className="flex items-center px-4 border border-r-0 border-border rounded-l-xl bg-gray-50 text-muted text-sm font-medium">+91</span>
              <input
                className="input rounded-l-none flex-1"
                type="tel"
                placeholder="98765 43210"
                value={phone}
                maxLength={10}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button className="btn-primary w-full" onClick={handleSend} disabled={loading}>
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <input
              className="input text-center text-2xl tracking-widest font-bold"
              type="number"
              placeholder="• • • •"
              value={otp}
              maxLength={6}
              onChange={(e) => setOtp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              autoFocus
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button className="btn-primary w-full" onClick={handleVerify} disabled={loading}>
              {loading ? "Verifying…" : "Verify & Login"}
            </button>
            <button
              className="text-sm text-muted w-full text-center hover:text-primary transition"
              onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
            >
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
