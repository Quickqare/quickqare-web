import React from "react";

// App-level error boundary. Without one, any render-time exception unmounts the
// whole React tree and the customer is left staring at a blank white page mid-
// checkout. This catches those errors, shows a recoverable fallback, and gives
// us a single place to forward the crash to an error tracker later.
//
// Styles are inline so the fallback still renders even if the CSS bundle failed
// to load (which is itself a common cause of a broken page).

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Keep a console record for local/dev debugging.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught render error:", error, info);

    // TODO(observability): forward to Sentry once a web DSN is configured, e.g.
    //   import * as Sentry from "@sentry/react";
    //   Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#f7f8fa",
          color: "#1f2937",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, margin: "0 0 20px", color: "#4b5563" }}>
            The page ran into an unexpected error. Your payment, if any, is safe —
            nothing is charged without a confirmation. Please reload and try again.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "none",
                background: "#22A06B",
                color: "#fff",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#1f2937",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
