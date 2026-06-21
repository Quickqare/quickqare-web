import React, { Component, ErrorInfo, ReactNode } from "react";

/* =====================================================
   ERROR BOUNDARY — Customer Web App
   Catches any React render crash within its subtree
   and shows a user-friendly fallback instead of a
   blank white screen.

   To integrate Sentry later, add in componentDidCatch:
     Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });
===================================================== */

interface Props {
  children: ReactNode;
  /** Optional custom fallback. Defaults to the built-in UI. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console for now — swap console.error for Sentry.captureException when ready
    console.error("[ErrorBoundary] Uncaught React error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={styles.overlay}>
          <div style={styles.card}>
            <div style={styles.icon}>⚠️</div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.subtitle}>
              We hit an unexpected error. Your data is safe — please reload
              the page to continue.
            </p>
            <button style={styles.button} onClick={this.handleReload}>
              Reload Page
            </button>
            {process.env.NODE_ENV === "development" && (
              <pre style={styles.debug}>{this.state.errorMessage}</pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/* =====================================================
   INLINE STYLES
   Kept inline so the fallback works even if CSS fails
   to load (which can happen when the crash is severe).
===================================================== */
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    padding: "24px",
  },
  card: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    padding: "48px 40px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
    backdropFilter: "blur(12px)",
    boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
  },
  icon: {
    fontSize: "56px",
    marginBottom: "16px",
    lineHeight: 1,
  },
  title: {
    color: "#ffffff",
    fontSize: "22px",
    fontWeight: 700,
    margin: "0 0 12px",
  },
  subtitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "15px",
    lineHeight: 1.6,
    margin: "0 0 32px",
  },
  button: {
    background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
    color: "#ffffff",
    border: "none",
    borderRadius: "12px",
    padding: "14px 32px",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    transition: "opacity 0.2s",
  },
  debug: {
    marginTop: "24px",
    background: "rgba(239,68,68,0.15)",
    border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: "8px",
    padding: "12px",
    color: "#fca5a5",
    fontSize: "12px",
    textAlign: "left",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
};

export default ErrorBoundary;
