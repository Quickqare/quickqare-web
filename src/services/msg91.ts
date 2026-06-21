/**
 * MSG91 OTP service for web.
 *
 * Mirrors @msg91comm/sendotp-react-native exactly — same widget endpoints,
 * same accessToken extraction logic — but uses plain browser fetch so no
 * extra npm package is needed.
 *
 * Endpoints (from MSG91 widget SDK source):
 *   POST https://control.msg91.com/api/v5/widget/sendOtpMobile
 *   POST https://control.msg91.com/api/v5/widget/verifyOtp
 *   POST https://control.msg91.com/api/v5/widget/retryOtp
 */

const WIDGET_ID    = "366462723463333736383232";
const TOKEN_AUTH   = "504623T79zrvvcR69ced429P1";
const COUNTRY_CODE = "91";
const BASE_URL     = "https://control.msg91.com/api/v5/widget";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const normalizePhone = (phone: string) =>
  String(phone || "").replace(/\D/g, "");

const toInternationalPhone = (phone: string) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  if (normalized.startsWith(COUNTRY_CODE) && normalized.length > 10) return normalized;
  return `${COUNTRY_CODE}${normalized}`;
};

async function postWidget(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ widgetId: WIDGET_ID, tokenAuth: TOKEN_AUTH, ...body }),
  });
  return res.json();
}

const maybeParseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
};

const looksLikeJwt = (value: unknown): value is string =>
  typeof value === "string" && value.split(".").length === 3;

const extractAccessToken = (payload: unknown): string | null => {
  const normalized = maybeParseJson(payload) as any;
  const data = maybeParseJson(normalized?.data) as any;

  const candidates = [
    normalized,
    normalized?.accessToken,
    normalized?.["access-token"],
    normalized?.access_token,
    normalized?.token,
    normalized?.message,
    data,
    data?.accessToken,
    data?.["access-token"],
    data?.access_token,
    data?.token,
    data?.message,
  ];

  return candidates.find(looksLikeJwt) ?? null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const sendOtp = async (phone: string): Promise<{ reqId?: string }> => {
  const mobile = toInternationalPhone(phone);
  const result = await postWidget("/sendOtpMobile", { identifier: mobile });

  if (result?.type === "error") {
    throw new Error(result?.message || "Failed to send OTP");
  }

  return result;
};

export const retryOtp = async (reqId?: string | null): Promise<unknown> => {
  return postWidget("/retryOtp", reqId ? { reqId } : {});
};

export const verifyOtp = async (
  otp: string,
  reqId?: string | null
): Promise<{ raw: unknown; accessToken: string }> => {
  const result = await postWidget("/verifyOtp", {
    otp: String(otp || "").trim(),
    ...(reqId ? { reqId } : {}),
  });

  // Check for explicit error responses
  if (
    result?.type === "error" ||
    result?.data?.type === "error" ||
    (typeof result?.message === "string" &&
      result.message.toLowerCase().includes("match"))
  ) {
    throw new Error(
      result?.message || result?.data?.message || "Invalid OTP. Please try again."
    );
  }

  const accessToken = extractAccessToken(result);
  if (!accessToken) {
    throw new Error(
      result?.message || result?.data?.message || "Invalid OTP. Please try again."
    );
  }

  return { raw: result, accessToken };
};
