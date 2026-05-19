import axios from "axios";

const API_BASE_URL =
  (import.meta as unknown as { env: Record<string, string | undefined> }).env
    .VITE_API_BASE_URL || "";

// Production uses the public API domain; local dev can still rely on the Vite proxy.
const client = axios.create({ baseURL: API_BASE_URL });

client.interceptors.request.use((config) => {
  const raw = localStorage.getItem("qq_web_token");
  if (raw) config.headers.Authorization = `Bearer ${raw}`;
  return config;
});

export default client;

export const setToken = (token: string | null) => {
  if (token) localStorage.setItem("qq_web_token", token);
  else localStorage.removeItem("qq_web_token");
};
