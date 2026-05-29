import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-[#0A0A0A] border-t border-white/10 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-white/40 text-sm">© {new Date().getFullYear()} QuickQare. All rights reserved.</p>
        <div className="flex items-center gap-6 text-sm text-white/50">
          <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
          <Link to="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link>
        </div>
      </div>
    </footer>
  );
}
