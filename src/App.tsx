import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import MyBookingsPage from "./pages/MyBookingsPage";
import ProfilePage from "./pages/ProfilePage";
import PolicyPage from "./pages/PolicyPage";
import BookingStatusPage from "./pages/BookingStatusPage";
import ComplaintsPage from "./pages/ComplaintsPage";
import ReferralPage from "./pages/ReferralPage";
import LoginModal from "./components/LoginModal";
import RatingModal from "./components/RatingModal";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import client from "./api/client";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const requireAuth = (el: ReactNode) =>
    user ? el : <Navigate to="/" replace />;

  return (
    <>
      <Navbar onLoginClick={() => setShowLogin(true)} />
      <div className="pt-14">
        <Routes>
          <Route path="/" element={<HomePage onLoginClick={() => setShowLogin(true)} />} />
          <Route path="/category/:catSlug" element={<ServiceDetailPage onLoginClick={() => setShowLogin(true)} />} />
          <Route path="/bookings" element={requireAuth(<MyBookingsPage />)} />
          <Route path="/bookings/:bookingId" element={requireAuth(<BookingStatusPage />)} />
          <Route path="/profile" element={requireAuth(<ProfilePage />)} />
          <Route path="/complaints" element={requireAuth(<ComplaintsPage />)} />
          <Route path="/complaints/new" element={requireAuth(<ComplaintsPage />)} />
          <Route path="/referral" element={requireAuth(<ReferralPage />)} />
          <Route path="/privacy-policy" element={<PolicyPage />} />
          <Route path="/terms" element={<PolicyPage />} />
          <Route path="/refund-policy" element={<PolicyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

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
