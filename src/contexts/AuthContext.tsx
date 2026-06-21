import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import client, { setToken } from "../api/client";

type User = { _id: string; name: string; phone: string; email?: string; gender?: string };

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message: string; isNewUser?: boolean }>;
  completeProfile: (name: string, gender: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      await client.post("/api/auth/send-otp", { phone });
      return { success: true, message: "" };
    } catch (e: any) {
      return { success: false, message: e.response?.data?.message ?? e.message ?? "Failed to send OTP" };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const res = await client.post("/api/auth/verify-otp", { phone, otp });
      if (res.data?.success) {
        const t = res.data.token;
        const u = res.data.user;
        setTokenState(t);
        setToken(t);
        setUser(u);
        localStorage.setItem("qq_web_token", t);
        localStorage.setItem("qq_web_user", JSON.stringify(u));
        const isNewUser = u?.name === "User" || !u?.gender;
        return { success: true, message: "", isNewUser };
      }
      return { success: false, message: res.data?.message ?? "Verification failed" };
    } catch (e: any) {
      return { success: false, message: e.response?.data?.message ?? e.message ?? "Verification failed" };
    }
  };

  const completeProfile = async (name: string, gender: string) => {
    try {
      const res = await client.patch("/api/user/profile", { name, gender });
      if (res.data?.success) {
        const u = res.data.data?.user;
        if (u) {
          const mapped = { ...u, _id: u.id ?? u._id };
          setUser(mapped as User);
          localStorage.setItem("qq_web_user", JSON.stringify(mapped));
        }
        return { success: true };
      }
      return { success: false, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e.response?.data?.message ?? "Failed to update profile" };
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
    <Ctx.Provider value={{ user, token, loading, sendOtp, verifyOtp, completeProfile, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
};
