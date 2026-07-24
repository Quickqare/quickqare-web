import { useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";

export default function RegisterProfessionalPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length < 10) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await client.post("/api/partner-leads", { name: name.trim(), phone: cleanedPhone });
      if (res.data?.success !== false) {
        setSubmitted(true);
      } else {
        setError(res.data?.message || "Could not submit right now. Please try again.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not submit right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <nav className="text-sm text-muted mb-8">
        <Link to="/" className="hover:text-primary transition-colors">QuickQare</Link>
        <span className="mx-2">›</span>
        <span className="text-ink">Register as a Professional</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Register as a Professional</h1>
        <p className="text-muted text-sm">
          Share your number and our team will call you to walk through onboarding — AC service, plumbing, mehendi, electrical work, and more.
        </p>
      </div>

      <div className="card p-6 md:p-8">
        {submitted ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-ink mb-1">Thanks — we've got your number</h2>
            <p className="text-muted text-sm">Our team will call you shortly to get you started.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-semibold text-muted mb-1.5 block">Your name (optional)</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                maxLength={100}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted mb-1.5 block">Phone number</label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                maxLength={15}
                disabled={loading}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading ? "Submitting…" : "Request a Callback"}
            </button>

            <p className="text-xs text-muted text-center">
              By submitting, you agree to be contacted by QuickQare about partner onboarding.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
