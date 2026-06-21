import { MSG91_COUNTRY_CODE, MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from "../config/msg91";

// Thin wrapper around MSG91's web OTP widget (verify.msg91.com/otp-provider.js).
// With exposeMethods:true the widget puts sendOtp/verifyOtp/retryOtp on window
// and suppresses its own popup, so we drive the UI ourselves and just consume
// the verified access token, which the backend exchanges for an app JWT.

const SCRIPT_SRC = "https://verify.msg91.com/otp-provider.js";

const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");

const toInternationalPhone = (phone: string) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  if (normalized.startsWith(MSG91_COUNTRY_CODE) && normalized.length > 10) return normalized;
  return `${MSG91_COUNTRY_CODE}${normalized}`;
};

// ── access-token extraction (mirrors the customer app's resilient parser) ──────
const maybeParseJson = (value: any) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
};

const looksLikeJwt = (value: any) =>
  typeof value === "string" && value.split(".").length === 3;

const extractAccessToken = (payload: any): string | null => {
  const p = maybeParseJson(payload);
  const data = maybeParseJson(p?.data);
  const candidates = [
    p, p?.accessToken, p?.["access-token"], p?.access_token, p?.token, p?.message,
    data, data?.accessToken, data?.["access-token"], data?.access_token, data?.token, data?.message,
  ];
  return candidates.find((v) => typeof v === "string" && v.trim() && looksLikeJwt(v.trim())) || null;
};

const extractError = (err: any): string => {
  const e = maybeParseJson(err);
  return (
    e?.message || e?.error || e?.data?.message ||
    (typeof e === "string" ? e : "") || "Something went wrong. Please try again."
  );
};

// ── widget bootstrap ──────────────────────────────────────────────────────────
let scriptPromise: Promise<void> | null = null;
let initialized = false;

const w = () => window as any;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (w().initSendOTP) return resolve();
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { scriptPromise = null; reject(new Error("Failed to load OTP service.")); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

// Wait until the widget has attached its methods to window (initSendOTP can take
// a tick to wire them up after the script loads).
function waitForMethods(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (typeof w().sendOtp === "function" && typeof w().verifyOtp === "function") return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error("OTP service not ready."));
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function ensureInit(): Promise<void> {
  await loadScript();
  if (!initialized) {
    w().initSendOTP({
      widgetId: MSG91_WIDGET_ID,
      tokenAuth: MSG91_TOKEN_AUTH,
      exposeMethods: true,
      success: () => {},
      failure: () => {},
    });
    initialized = true;
  }
  await waitForMethods();
}

// ── public API ────────────────────────────────────────────────────────────────
export async function sendWebOtp(phone: string): Promise<void> {
  await ensureInit();
  const identifier = toInternationalPhone(phone);
  if (!identifier) throw new Error("Valid phone number required.");
  return new Promise<void>((resolve, reject) => {
    w().sendOtp(identifier, () => resolve(), (err: any) => reject(new Error(extractError(err))));
  });
}

export async function resendWebOtp(phone: string): Promise<void> {
  await ensureInit();
  // retryOtp resends on the same request; channel "11" = text/SMS.
  if (typeof w().retryOtp === "function") {
    return new Promise<void>((resolve, reject) => {
      w().retryOtp("11", () => resolve(), (err: any) => reject(new Error(extractError(err))));
    });
  }
  // Fallback: re-send if retry isn't available.
  return sendWebOtp(phone);
}

export async function verifyWebOtp(otp: string): Promise<string> {
  await ensureInit();
  const code = String(otp || "").trim();
  return new Promise<string>((resolve, reject) => {
    w().verifyOtp(
      code,
      (data: any) => {
        const token = extractAccessToken(data);
        if (token) resolve(token);
        else reject(new Error("Invalid OTP. Please try again."));
      },
      (err: any) => reject(new Error(extractError(err)))
    );
  });
}
