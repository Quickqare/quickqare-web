import { MSG91_COUNTRY_CODE, MSG91_TOKEN_AUTH, MSG91_WIDGET_ID } from "../config/msg91";

// MSG91 OTP for web — calls the widget REST endpoints directly via fetch, the
// same ones the @msg91comm/sendotp-react-native SDK uses internally. This is
// deliberately NOT the verify.msg91.com/otp-provider.js browser widget, which
// rejects browser origins ("Web requests are not allowed for this widget").
// These endpoints only need widgetId + tokenAuth, so they work from the browser
// exactly like they do from the mobile SDK.
//
//   POST https://control.msg91.com/api/v5/widget/sendOtpMobile
//   POST https://control.msg91.com/api/v5/widget/verifyOtp
//   POST https://control.msg91.com/api/v5/widget/retryOtp

const BASE_URL = "https://control.msg91.com/api/v5/widget";

const normalizePhone = (phone: string) => String(phone || "").replace(/\D/g, "");

const toInternationalPhone = (phone: string) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  if (normalized.startsWith(MSG91_COUNTRY_CODE) && normalized.length > 10) return normalized;
  return `${MSG91_COUNTRY_CODE}${normalized}`;
};

async function postWidget(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetId: MSG91_WIDGET_ID, tokenAuth: MSG91_TOKEN_AUTH, ...body }),
  });
  return res.json();
}

// ── response parsing (mirrors the customer app's resilient parser) ────────────
const maybeParseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
};

const looksLikeJwt = (value: unknown): value is string =>
  typeof value === "string" && value.split(".").length === 3;

const extractAccessToken = (payload: unknown): string | null => {
  const p = maybeParseJson(payload) as any;
  const data = maybeParseJson(p?.data) as any;
  const candidates = [
    p, p?.accessToken, p?.["access-token"], p?.access_token, p?.token, p?.message,
    data, data?.accessToken, data?.["access-token"], data?.access_token, data?.token, data?.message,
  ];
  return candidates.find(looksLikeJwt) ?? null;
};

// reqId ties send → verify → retry together; it comes back from sendOtp.
const extractReqId = (payload: unknown): string | null => {
  const p = maybeParseJson(payload) as any;
  const data = maybeParseJson(p?.data) as any;
  const candidates = [
    p?.reqId, p?.request_id, p?.requestId,
    data?.reqId, data?.request_id, data?.requestId,
    p?.message, data?.message,
  ];
  return candidates.find((v) => typeof v === "string" && v.trim() && !looksLikeJwt(v)) ?? null;
};

const isError = (result: any) =>
  result?.type === "error" ||
  result?.data?.type === "error" ||
  (typeof result?.message === "string" && result.message.toLowerCase().includes("match"));

// Remember the latest reqId so verify/retry target the right request.
let lastReqId: string | null = null;

// ── public API ────────────────────────────────────────────────────────────────
export async function sendWebOtp(phone: string): Promise<void> {
  const identifier = toInternationalPhone(phone);
  if (!identifier) throw new Error("Valid phone number required.");
  const result = await postWidget("/sendOtpMobile", { identifier });
  if (isError(result)) throw new Error(result?.message || "Failed to send OTP.");
  lastReqId = extractReqId(result);
}

export async function resendWebOtp(phone: string): Promise<void> {
  const result = await postWidget("/retryOtp", lastReqId ? { reqId: lastReqId } : {});
  if (isError(result)) throw new Error(result?.message || "Failed to resend OTP.");
  const fresh = extractReqId(result);
  if (fresh) lastReqId = fresh;
}

export async function verifyWebOtp(otp: string): Promise<string> {
  const code = String(otp || "").trim();
  const result = await postWidget("/verifyOtp", {
    otp: code,
    ...(lastReqId ? { reqId: lastReqId } : {}),
  });
  if (isError(result)) {
    throw new Error(result?.message || result?.data?.message || "Invalid OTP. Please try again.");
  }
  const accessToken = extractAccessToken(result);
  if (!accessToken) {
    throw new Error(result?.message || result?.data?.message || "Invalid OTP. Please try again.");
  }
  return accessToken;
}
