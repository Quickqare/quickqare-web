import axios from "axios";

const API_BASE_URL =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env
    .VITE_API_BASE_URL || "";

// Production uses the public API domain; local dev relies on the Vite proxy.
//
// The customer session is carried in an httpOnly cookie set by the API, not in
// JS-readable storage. `withCredentials` makes the browser send that cookie on
// every request (and accept Set-Cookie on login/logout). Same-site deployment
// (quickqare.in <-> api.quickqare.in) means the SameSite=Lax cookie is sent.
const client = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

export default client;
