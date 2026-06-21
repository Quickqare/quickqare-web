import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

type Props = { onClose: () => void };

const GENDERS = ["Male", "Female", "Other"];
// Backend allows 1 OTP per 60s per phone — match that so resend never hits a 429.
const RESEND_COOLDOWN = 60;

export default function LoginModal({ onClose }: Props) {
  const { sendOtp, resendOtp, verifyOtp, completeProfile } = useAuth();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [step, setStep] = useState<"phone" | "otp" | "details">("phone");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  // Tick the resend cooldown down once per second while it's running.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleSend = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 10) return setError("Enter a valid 10-digit phone number.");
    setError("");
    setLoading(true);
    const res = await sendOtp(cleaned);
    setLoading(false);
    if (res.success) {
      setStep("otp");
      setCooldown(RESEND_COOLDOWN);
    } else {
      setError(res.message || "Could not send OTP.");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError("");
    setOtp("");
    setResending(true);
    const res = await resendOtp(phone.replace(/\D/g, ""));
    setResending(false);
    if (res.success) setCooldown(RESEND_COOLDOWN);
    else setError(res.message || "Could not resend OTP.");
  };

  const handleVerify = async () => {
    if (otp.length < 4) return setError("Enter the OTP you received.");
    setError("");
    setLoading(true);
    const res = await verifyOtp(phone.replace(/\D/g, ""), otp);
    setLoading(false);
    if (res.success) {
      if (res.isNewUser) setStep("details");
      else onClose();
    } else {
      setError(res.message || "Invalid OTP.");
    }
  };

  const handleCompleteProfile = async () => {
    if (!name.trim()) return setError("Please enter your name.");
    if (!gender) return setError("Please select your gender.");
    setError("");
    setLoading(true);
    const res = await completeProfile(name.trim(), gender);
    setLoading(false);
    if (res.success) onClose();
    else setError(res.message || "Failed to save profile.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="card w-full max-w-sm p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-ink">
              {step === "phone" && "Log in to QuickQare"}
              {step === "otp" && "Verify OTP"}
              {step === "details" && "Complete your profile"}
            </h2>
            <p className="text-sm text-muted mt-1">
              {step === "phone" && "Enter your phone number to continue"}
              {step === "otp" && `OTP sent to +91 ${phone}`}
              {step === "details" && "Just a few details to get you started"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-ink transition text-2xl leading-none">×</button>
        </div>

        {/* Phone step */}
        {step === "phone" && (
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
        )}

        {/* OTP step */}
        {step === "otp" && (
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
              className="text-sm w-full text-center transition disabled:text-muted disabled:cursor-not-allowed text-primary hover:text-primary/80"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
            >
              {resending
                ? "Resending…"
                : cooldown > 0
                ? `Resend OTP in ${cooldown}s`
                : "Resend OTP"}
            </button>
            <button
              className="text-sm text-muted w-full text-center hover:text-primary transition"
              onClick={() => { setStep("phone"); setOtp(""); setError(""); setCooldown(0); }}
            >
              Change number
            </button>
          </div>
        )}

        {/* Details step (new users only) */}
        {step === "details" && (
          <div className="space-y-4">
            <input
              className="input"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCompleteProfile()}
              autoFocus
            />
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-xl border text-sm font-medium transition ${
                    gender === g
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/50"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button className="btn-primary w-full" onClick={handleCompleteProfile} disabled={loading}>
              {loading ? "Saving…" : "Get Started"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
