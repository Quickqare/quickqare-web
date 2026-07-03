import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import client from "../api/client";
import { resendWebOtp, sendWebOtp, verifyWebOtp } from "../services/msg91";

type User = { _id: string; name: string; phone: string; email?: string; gender?: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  resendOtp: (phone: string) => Promise<{ success: boolean; message: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message: string; isNewUser?: boolean }>;
  completeProfile: (name: string, gender: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // The session lives in an httpOnly cookie the browser sends automatically, so
  // there is no token in JS. We learn who the user is by asking the API.
  const refreshUser = useCallback(async () => {
    try {
      const res = await client.get("/api/auth/me");
      setUser(res.data?.user ?? null);
    } catch {
      // 401 (no/invalid cookie) — treat as logged out.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser]);

  const sendOtp = async (phone: string) => {
    try {
      await sendWebOtp(phone);
      return { success: true, message: "" };
    } catch (e: any) {
      return { success: false, message: e?.message ?? "Failed to send OTP" };
    }
  };

  const resendOtp = async (phone: string) => {
    try {
      await resendWebOtp(phone);
      return { success: true, message: "" };
    } catch (e: any) {
      return { success: false, message: e?.message ?? "Failed to resend OTP" };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      // 1) Verify the OTP with the MSG91 widget to obtain a verified access token.
      const accessToken = await verifyWebOtp(otp);
      // 2) Exchange it server-side for the session — the API replies with the
      //    user and sets the httpOnly auth cookie (no token reaches JS).
      const res = await client.post("/api/auth/msg91/exchange", { phone, accessToken });
      if (res.data?.success) {
        const u = res.data.user;
        setUser(u);
        const isNewUser = res.data?.isNewUser === true || u?.name === "User" || !u?.gender;
        return { success: true, message: "", isNewUser };
      }
      return { success: false, message: res.data?.message ?? "Verification failed" };
    } catch (e: any) {
      return { success: false, message: e.response?.data?.message ?? e?.message ?? "Verification failed" };
    }
  };

  const completeProfile = async (name: string, gender: string) => {
    try {
      const res = await client.patch("/api/user/profile", { name, gender });
      if (res.data?.success) {
        const u = res.data.data?.user;
        if (u) setUser({ ...u, _id: u.id ?? u._id } as User);
        return { success: true };
      }
      return { success: false, message: res.data?.message };
    } catch (e: any) {
      return { success: false, message: e.response?.data?.message ?? "Failed to update profile" };
    }
  };

  const logout = useCallback(async () => {
    try {
      await client.post("/api/auth/logout"); // clears the httpOnly cookie server-side
    } catch {
      // best-effort — clear local state regardless
    }
    setUser(null);
  }, []);

  return (
    <Ctx.Provider value={{ user, loading, sendOtp, resendOtp, verifyOtp, completeProfile, logout, refreshUser }}>
      {children}
    </Ctx.Provider>
  );
};
