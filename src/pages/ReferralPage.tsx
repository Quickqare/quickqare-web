import { useEffect, useState } from "react";
import client from "../api/client";

type Stats = { totalReferrals: number; totalEarned: number; pendingAmount: number };
type HistoryItem = { _id: string; referredUser?: { name: string; phone: string }; status: string; rewardAmount: number; createdAt: string };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReferralPage() {
  const [code, setCode] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      client.get("/api/referral/code"),
      client.get("/api/referral/stats"),
      client.get("/api/referral/history"),
    ]).then(([codeRes, statsRes, historyRes]) => {
      setCode(codeRes.data?.referralCode ?? codeRes.data?.code ?? "");
      setStats(statsRes.data?.stats ?? statsRes.data ?? null);
      const h = historyRes.data?.history ?? historyRes.data ?? [];
      setHistory(Array.isArray(h) ? h : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-ink mb-2">Refer & Earn</h1>
      <p className="text-muted text-sm mb-6">Invite friends to QuickQare and earn rewards when they book.</p>

      {/* Referral code card */}
      <div className="card p-6 mb-5 text-center">
        <p className="text-sm text-muted mb-2">Your referral code</p>
        <p className="text-3xl font-extrabold tracking-widest text-ink mb-4">{code || "—"}</p>
        {code && (
          <button
            onClick={copyCode}
            className={`btn-primary px-8 transition ${copied ? "bg-green-600" : ""}`}
          >
            {copied ? "✓ Copied!" : "Copy Code"}
          </button>
        )}
      </div>

      {/* How it works */}
      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-ink mb-3">How it works</h2>
        <div className="space-y-3">
          {[
            { icon: "📤", text: "Share your code with friends" },
            { icon: "📲", text: "Friend signs up and books using your code" },
            { icon: "💰", text: `You earn ₹${stats ? 50 : "—"} · Friend gets a discount` },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xl w-8 text-center">{s.icon}</span>
              <p className="text-sm text-ink">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="card p-4 text-center">
            <p className="text-2xl font-extrabold text-primary">{stats.totalReferrals}</p>
            <p className="text-xs text-muted mt-1">Friends Referred</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-extrabold text-primary">₹{stats.totalEarned}</p>
            <p className="text-xs text-muted mt-1">Total Earned</p>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-ink mb-3">Referral History</h2>
          <div className="space-y-3">
            {history.map((h) => (
              <div key={h._id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-ink">{h.referredUser?.name || "Friend"}</p>
                  <p className="text-xs text-muted">{fmtDate(h.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary">+₹{h.rewardAmount}</p>
                  <p className="text-xs text-muted capitalize">{h.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
