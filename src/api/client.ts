import axios from "axios";

// Empty baseURL — all /api/* requests go through the Vite proxy to http://168.144.64.189:4000
const client = axios.create({ baseURL: "" });

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
