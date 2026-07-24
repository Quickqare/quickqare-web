import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import MyBookingsPage from "./pages/MyBookingsPage";
import ProfilePage from "./pages/ProfilePage";
import PolicyPage from "./pages/PolicyPage";
import ContactUsPage from "./pages/ContactUsPage";
import RegisterProfessionalPage from "./pages/RegisterProfessionalPage";
import BookingStatusPage from "./pages/BookingStatusPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ReferralPage from "./pages/ReferralPage";
import LoginModal from "./components/LoginModal";
import RatingModal from "./components/RatingModal";
import CategoryPage from "./pages/CategoryPage";
import client from "./api/client";

// Gate for authenticated routes. A logged-out visitor who reaches one — e.g.
// via the footer's "My bookings" or "Refer & earn" links — used to be silently
// redirected to home, so the link appeared to do nothing. Instead we open the
// login modal and HOLD them on this route: because we never navigate away, a
// successful login (which sets `user` in context) re-renders straight into the
// page they asked for, with no destination lost.
function RequireAuth({ onLoginClick, children }: { onLoginClick: () => void; children: ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) onLoginClick();
  }, [user, onLoginClick]);

  if (user) return <>{children}</>;

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <p className="text-5xl mb-4">🔒</p>
      <h1 className="text-xl font-bold text-ink mb-1">Please log in</h1>
      <p className="text-muted text-sm mb-6">Log in with your phone to view this page.</p>
      <button className="btn-primary" onClick={onLoginClick}>Log in</button>
      <div className="mt-4">
        <Link to="/" className="text-sm text-primary hover:underline">Back to home</Link>
      </div>
    </div>
  );
}

function AppInner() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [pendingRating, setPendingRating] = useState<{ bookingId: string } | null>(null);

  // Check for pending rating on login
  const checkPendingRating = useCallback(async () => {
    if (!user) return;
    try {
      const res = await client.get("/api/ratings/pending");
      const bookingId = res.data?.bookingId ?? res.data?.booking?._id ?? null;
      if (bookingId) setPendingRating({ bookingId });
    } catch { }
  }, [user]);

  useEffect(() => {
    checkPendingRating();
  }, [checkPendingRating]);

  // Stable so RequireAuth's effect doesn't re-fire the modal on every render.
  const openLogin = useCallback(() => setShowLogin(true), []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const requireAuth = (el: ReactNode) => (
    <RequireAuth onLoginClick={openLogin}>{el}</RequireAuth>
  );

  return (
    <>
      <Navbar onLoginClick={() => setShowLogin(true)} />
      <div className="pt-14">
        <Routes>
          <Route path="/" element={<HomePage onLoginClick={() => setShowLogin(true)} />} />
          <Route path="/category/:catSlug" element={<CategoryPage onLoginClick={() => setShowLogin(true)} />} />
          <Route path="/bookings" element={requireAuth(<MyBookingsPage />)} />
          <Route path="/bookings/:bookingId" element={requireAuth(<BookingStatusPage />)} />
          <Route path="/profile" element={requireAuth(<ProfilePage />)} />
          <Route path="/complaints" element={requireAuth(<ComplaintsPage />)} />
          <Route path="/complaints/new" element={requireAuth(<ComplaintsPage />)} />
          <Route path="/referral" element={requireAuth(<ReferralPage />)} />
          <Route path="/privacy-policy" element={<PolicyPage />} />
          <Route path="/terms" element={<PolicyPage />} />
          <Route path="/refund-policy" element={<PolicyPage />} />
          <Route path="/anti-discrimination-policy" element={<PolicyPage />} />
          <Route path="/contact-us" element={<ContactUsPage />} />
          <Route path="/register-professional" element={<RegisterProfessionalPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Rendered once here (not per-page) so every route gets a footer —
          previously it lived only inline inside HomePage. */}
      <Footer />

      {showLogin && <LoginModal onClose={() => { setShowLogin(false); checkPendingRating(); }} />}

      {pendingRating && (
        <RatingModal
          bookingId={pendingRating.bookingId}
          onClose={() => setPendingRating(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return <AppInner />;
}
