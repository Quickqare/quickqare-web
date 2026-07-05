import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import client from "../api/client";
import { useAppConfig } from "../hooks/useAppConfig";

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { referral } = useAppConfig();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const initials = user.name
    ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : user.phone.slice(-2);

  const handleSave = async () => {
    setSaving(true);
    setMsg("");
    setError("");
    try {
      await client.patch("/api/user/profile", { name, email, gender });
      await refreshUser();
      setMsg("Profile updated!");
      setEditing(false);
    } catch (e: any) {
      setError(e.response?.data?.message ?? "Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setName(user.name ?? "");
    setEmail(user.email ?? "");
    setGender(user.gender ?? "");
    setEditing(false);
    setError("");
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await client.delete("/api/user/me", { data: { reason: deleteReason.trim() } });
      logout();
      navigate("/");
    } catch (e: any) {
      alert(e.response?.data?.message || "Could not delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      {/* Avatar card */}
      <div className="card p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold shrink-0">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">{user.name || "—"}</h2>
            <p className="text-sm text-muted">+91 {user.phone}</p>
            {user.email && <p className="text-sm text-muted">{user.email}</p>}
          </div>
        </div>
      </div>

      {/* Info / Edit form */}
      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-ink">Personal Details</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline font-medium">Edit</button>
          )}
        </div>
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Email (optional)</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Gender</label>
              <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button className="btn-primary flex-1" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
              <button className="btn-outline flex-1" onClick={handleCancel} disabled={saving}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Row label="Phone" value={"+91 " + user.phone} />
            <Row label="Name" value={user.name || "—"} />
            <Row label="Email" value={user.email || "—"} />
            <Row label="Gender" value={user.gender ? capitalize(user.gender) : "—"} />
          </div>
        )}
        {msg && !editing && <p className="text-green-600 text-sm mt-3">{msg}</p>}
      </div>

      {/* Quick links */}
      <div className="card divide-y divide-border mb-4">
        <Link to="/complaints" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
          <div className="flex items-center gap-3">
            <span className="text-xl">📝</span>
            <span className="text-sm font-medium text-ink">Help & Complaints</span>
          </div>
          <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </Link>
        {referral.isEnabled && (
          <Link to="/referral" className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎁</span>
              <div>
                <p className="text-sm font-medium text-ink">Refer & Earn</p>
                <p className="text-xs text-muted">Earn ₹{referral.referrerRewardAmount} per referral</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
            </svg>
          </Link>
        )}
      </div>

      {/* Logout */}
      <button onClick={logout} className="w-full btn-outline text-red-600 border-red-200 hover:bg-red-50 mb-4">
        Logout
      </button>

      {/* Delete account */}
      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full text-xs text-muted hover:text-red-500 transition py-2"
        >
          Delete my account
        </button>
      ) : (
        <div className="card p-5 border-red-200">
          <p className="font-semibold text-red-700 mb-1">Delete Account?</p>
          <p className="text-xs text-muted mb-3">This is permanent and cannot be undone. All your data will be removed.</p>
          <textarea
            className="input resize-none text-sm mb-3"
            rows={2}
            placeholder="Reason for leaving (optional)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-2 border border-border text-sm font-semibold rounded-xl hover:border-ink transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-muted w-20 shrink-0">{label}</span>
      <span className="text-sm text-ink font-medium text-right">{value}</span>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
