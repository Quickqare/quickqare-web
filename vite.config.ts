import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Razorpay Checkout: checkout.js is loaded from checkout.razorpay.com (see
// index.html) and renders its payment sheet in an iframe served from
// api.razorpay.com. Payments break if these aren't allow-listed.
const RAZORPAY = ["https://checkout.razorpay.com", "https://*.razorpay.com"];

// The browser calls MSG91's widget endpoints directly to send/verify the login
// OTP — see src/services/msg91.ts.
const MSG91 = "https://control.msg91.com";

/**
 * Content-Security-Policy for the production build.
 *
 * The point of this is the `javascript:` href class of bug: admin-supplied
 * banner and social links are rendered into <a href>, and React does not block
 * `javascript:` URLs. src/lib/safeUrl.ts is the actual fix; this is the net
 * under it, and it also stops any injected script from exfiltrating to a host we
 * don't talk to.
 *
 * Build-only on purpose: the dev server injects an inline react-refresh preamble
 * that `script-src 'self'` would kill. Exercise the real policy with
 * `npm run build && npm run preview`.
 */
function cspPlugin(apiBaseUrl: string): Plugin {
  // In production VITE_API_BASE_URL points at the API domain and Socket.IO
  // upgrades to a WebSocket on the same host. Reduce it to a bare origin: a CSP
  // source carrying a path ("https://api.quickqare.in/api") only matches that
  // path, which would block the socket (BookingStatusPage strips "/api" off it).
  // Empty or relative means the API is same-origin, where 'self' already covers
  // both — so the CSP and the client stay in agreement either way, because both
  // are derived from this same value at build time.
  let apiOrigin = "";
  try {
    if (apiBaseUrl.trim()) apiOrigin = new URL(apiBaseUrl.trim()).origin;
  } catch {
    /* relative base — same-origin */
  }

  const connectSrc = ["'self'", MSG91, ...RAZORPAY];
  if (apiOrigin) {
    connectSrc.push(apiOrigin, apiOrigin.replace(/^http/, "ws"));
  }

  const policy = Object.entries({
    "default-src": ["'self'"],
    // The Vite build emits no inline <script>; Razorpay is the only third party.
    "script-src": ["'self'", ...RAZORPAY],
    // Razorpay injects <style> blocks for its checkout overlay. (React's style
    // prop goes through the CSSOM, which CSP doesn't govern.)
    "style-src": ["'self'", "'unsafe-inline'"],
    // Banner art, partner selfies and customer-uploaded cake reference photos
    // come from object storage / CDNs we don't enumerate here. data: is the
    // inline favicon.
    "img-src": ["'self'", "data:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": connectSrc,
    "frame-src": RAZORPAY,
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  })
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");

  return {
    name: "quickqare-csp",
    apply: "build",
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: "meta",
            injectTo: "head-prepend",
            attrs: { "http-equiv": "Content-Security-Policy", content: policy },
          },
        ],
      };
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), cspPlugin(env.VITE_API_BASE_URL || "")],
    server: {
      port: 5174,
      proxy: {
        "/api": {
          target: env.VITE_API_TARGET || "http://localhost:4000",
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
