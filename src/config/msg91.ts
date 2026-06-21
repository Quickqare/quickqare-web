// MSG91 web OTP widget credentials — mirror the customer app's widget so web
// uses the same (non-DLT) widget flow instead of the REST OTP API.
// tokenAuth is a public widget token (already shipped in the mobile app bundle),
// not a server secret, so it is safe to include in client code.
export const MSG91_WIDGET_ID = "366462723463333736383232";
export const MSG91_TOKEN_AUTH = "504623T79zrvvcR69ced429P1";
export const MSG91_COUNTRY_CODE = "91";
