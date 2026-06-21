// MSG91 widget credentials — same widget the customer app uses, so web hits the
// non-DLT widget endpoints (control.msg91.com/api/v5/widget/*) directly instead
// of the DLT-gated REST OTP API. See services/msg91.ts.
// tokenAuth is a public widget token (already shipped in the mobile app bundle),
// not a server secret, so it is safe to include in client code.
export const MSG91_WIDGET_ID = "366462723463333736383232";
export const MSG91_TOKEN_AUTH = "504623T79zrvvcR69ced429P1";
export const MSG91_COUNTRY_CODE = "91";
