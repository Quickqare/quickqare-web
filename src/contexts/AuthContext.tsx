import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import client, { setToken } from "../api/client";
import {
  sendOtp as msg91SendOtp,
  verifyOtp as msg91VerifyOtp,
} from "../services/msg91";

type User = { _id: string; name: string; phone: string; email?: string; gender?: string };

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqIdRef = useRef<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("qq_web_token");
    const u = localStorage.getItem("qq_web_user");
    if (t) { setTokenState(t); setToken(t); }
    if (u) { try { setUser(JSON.parse(u)); } catch {} }
    setLoading(false);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await client.get("/api/auth/me");
      if (res.data?.user) {
        setUser(res.data.user);
        localStorage.setItem("qq_web_user", JSON.stringify(res.data.user));
      }
    } catch {}
  }, []);

  const sendOtp = async (phone: string) => {
    try {
      const result = await msg91SendOtp(phone);
      reqIdRef.current = result?.reqId ?? null;
      return { success: true, message: "" };
    } catch (e: any) {
      return { success: false, message: e.message ?? "Failed to send OTP" };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const { accessToken } = await msg91VerifyOtp(otp, reqIdRef.current);
      const res = await client.post("/api/auth/msg91/exchange", { phone, accessToken });
      if (res.data?.success) {
        const t = res.data.token;
        const u = res.data.user;
        setTokenState(t);
        setToken(t);
        setUser(u);
        localStorage.setItem("qq_web_token", t);
        localStorage.setItem("qq_web_user", JSON.stringify(u));
        reqIdRef.current = null;
        return { success: true, message: "" };
      }
      return { success: false, message: res.data?.message ?? "Verification failed" };
    } catch (e: any) {
      return { success: false, message: e.response?.data?.message ?? e.message ?? "Verification failed" };
    }
  };

  const logout = () => {
    setUser(null);
    setTokenState(null);
    setToken(null);
    localStorage.removeItem("qq_web_token");
    localStorage.removeItem("qq_web_user");
  };

  return (
    <Ctx.Provider value={{ user, token, loading, sendOtp, verifyOtp, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
};
