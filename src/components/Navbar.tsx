import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

type Props = { onLoginClick: () => void };

export default function Navbar({ onLoginClick }: Props) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleCart = () => {
    if (user) navigate("/bookings");
    else onLoginClick();
  };

  const active = (to: string) =>
    location.pathname === to ? "text-primary font-semibold" : "text-white/70 hover:text-white";

  return (
    <nav className="fixed top-0 inset-x-0 z-40 bg-[#0A0A0A] border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-white font-extrabold text-base tracking-tight">
          <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white text-xs font-bold">Q</span>
          QuickQare
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link to="/" className={`text-sm transition ${active("/")}`}>Home</Link>
          {user && <Link to="/bookings" className={`text-sm transition ${active("/bookings")}`}>My Bookings</Link>}
          {user && <Link to="/profile" className={`text-sm transition ${active("/profile")}`}>Profile</Link>}
        </div>

        {/* Cart icon — desktop */}
        <button
          onClick={handleCart}
          aria-label="My bookings"
          className="hidden md:flex items-center justify-center w-9 h-9 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition"
        >
          <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-9H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
          </svg>
        </button>

        {/* Auth */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <span className="text-sm text-white/50 max-w-[120px] truncate">
                {user.name?.split(" ")[0] || user.phone}
              </span>
              <button
                onClick={logout}
                className="text-sm text-white/70 hover:text-white border border-white/20 rounded-lg px-4 py-1.5 transition"
              >
                Logout
              </button>
            </>
          ) : (
            <button
              onClick={onLoginClick}
              className="btn-primary text-sm px-5 py-1.5"
            >
              Login
            </button>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-white/70 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="md:hidden bg-[#141414] border-t border-white/10 px-4 py-4 flex flex-col gap-4">
          <Link to="/" className={`text-sm ${active("/")}`} onClick={() => setMenuOpen(false)}>Home</Link>
          {user && (
            <Link to="/bookings" className={`text-sm ${active("/bookings")}`} onClick={() => setMenuOpen(false)}>
              My Bookings
            </Link>
          )}
          {user && (
            <Link to="/profile" className={`text-sm ${active("/profile")}`} onClick={() => setMenuOpen(false)}>
              Profile
            </Link>
          )}
          <button
            onClick={() => { handleCart(); setMenuOpen(false); }}
            className="text-sm text-white/70 text-left flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-9H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            My Bookings
          </button>

          {user ? (
            <button
              onClick={() => { logout(); setMenuOpen(false); }}
              className="text-sm text-white/50 text-left"
            >
              Logout
            </button>
          ) : (
            <button
              onClick={() => { onLoginClick(); setMenuOpen(false); }}
              className="btn-primary text-sm"
            >
              Login
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
