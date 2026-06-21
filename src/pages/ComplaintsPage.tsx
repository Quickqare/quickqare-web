import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import client from "../api/client";

const ISSUE_TYPES = [
  "Service quality issue",
  "Partner behaviour",
  "Late arrival",
  "Overcharged",
  "Incomplete work",
  "Partner didn't show up",
  "Other",
];

type Complaint = {
  _id: string;
  issueType: string;
  description: string;
  status: string;
  createdAt: string;
  bookingId?: string | { _id: string; serviceCategory?: string };
};

const STATUS_STYLE: Record<string, string> = {
  open:        "bg-amber-50 text-amber-700",
  in_progress: "bg-blue-50 text-blue-700",
  resolved:    "bg-green-50 text-green-700",
  closed:      "bg-gray-100 text-gray-600",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ComplaintsPage() {
  const [searchParams] = useSearchParams();
  const prefillBookingId = searchParams.get("bookingId") || "";

  const [tab, setTab] = useState<"list" | "new">(prefillBookingId ? "new" : "list");
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [bookingId, setBookingId] = useState(prefillBookingId);
  const [issueType, setIssueType] = useState(ISSUE_TYPES[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    client.get("/api/complaints")
      .then((res) => {
        const raw = res.data?.complaints ?? res.data ?? [];
        setComplaints(Array.isArray(raw) ? raw : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!description.trim()) { setFormError("Please describe the issue."); return; }
    setFormError("");
    setSubmitting(true);
    try {
      const res = await client.post("/api/complaints", {
        issueType,
        description: description.trim(),
        bookingId: bookingId.trim() || undefined,
      });
      const newComplaint = res.data?.complaint ?? res.data;
      if (newComplaint) setComplaints((prev) => [newComplaint, ...prev]);
      setSubmitted(true);
      setDescription("");
      setBookingId("");
      setIssueType(ISSUE_TYPES[0]);
      setTimeout(() => { setTab("list"); setSubmitted(false); }, 1500);
    } catch (e: any) {
      setFormError(e.response?.data?.message || "Could not submit complaint.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-ink mb-6">Help & Complaints</h1>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {(["list", "new"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t === "list" ? "My Complaints" : "Raise Complaint"}
          </button>
        ))}
      </div>

      {tab === "list" ? (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-ink mb-1">No complaints yet</p>
            <p className="text-sm">If you have an issue, raise a complaint above.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.map((c) => (
              <div key={c._id} className="card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-ink text-sm">{c.issueType}</p>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLE[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {c.status?.replace("_", " ")}
                  </span>
                </div>
                <p className="text-sm text-muted line-clamp-2">{c.description}</p>
                <p className="text-xs text-muted mt-2">{fmtDate(c.createdAt)}</p>
              </div>
            ))}
          </div>
        )
      ) : (
        submitted ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">✅</p>
            <p className="font-bold text-ink text-lg">Complaint submitted</p>
            <p className="text-sm text-muted mt-1">Our team will review and get back to you.</p>
          </div>
        ) : (
          <div className="card p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Issue Type</label>
              <select className="input" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Booking ID <span className="text-muted font-normal">(optional)</span>
              </label>
              <input
                className="input"
                placeholder="Last 8 characters of booking ID"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Description *</label>
              <textarea
                className="input resize-none"
                rows={4}
                placeholder="Describe the issue in detail…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <button className="btn-primary w-full" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit Complaint"}
            </button>
          </div>
        )
      )}
    </div>
  );
}
