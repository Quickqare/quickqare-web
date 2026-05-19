import React, { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import MyBookingsPage from "./pages/MyBookingsPage";
import ProfilePage from "./pages/ProfilePage";
import LoginModal from "./components/LoginModal";

export default function App() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar onLoginClick={() => setShowLogin(true)} />
      <div className="pt-14">
        <Routes>
          <Route path="/" element={<HomePage onLoginClick={() => setShowLogin(true)} />} />
          <Route
            path="/bookings"
            element={user ? <MyBookingsPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/profile"
            element={user ? <ProfilePage /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}
