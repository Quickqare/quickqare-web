// Scheme guard for links that come from the API and get rendered into an <a href>
// (home banners, footer social links).
//
// React does NOT block `javascript:` hrefs — it only logs a dev-time warning and
// still renders them. A banner whose linkUrl is
//   javascript:fetch('/api/user/me',{method:'DELETE'})
// therefore executes on our own origin when the customer clicks it, with their
// session cookie attached. The API validates the scheme on write too, but rows
// saved before that guard existed are still in the database, so the render path
// has to check as well.

const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

// Returns the URL when it is safe to use as an href, otherwise null so the caller
// can render the content without a link rather than an exploitable one.
//
// Parsing with the URL constructor rather than a regex is deliberate: it strips
// the tabs and newlines that "java\nscript:alert(1)" hides behind before
// resolving the scheme, so obfuscated payloads normalise and get rejected.
export function safeExternalUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}
