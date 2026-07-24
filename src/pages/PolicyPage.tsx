import React, { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import client from "../api/client";

type PolicyType = "privacy" | "terms" | "refund" | "anti_discrimination";

const POLICY_META: Record<PolicyType, { title: string; description: string }> = {
  privacy: {
    title: "Privacy Policy",
    description: "How QuickQare collects, uses, and protects your personal data.",
  },
  terms: {
    title: "Terms & Conditions",
    description: "Rules and guidelines for using the QuickQare platform.",
  },
  refund: {
    title: "Cancellation & Refund Policy",
    description: "Conditions under which cancellations and refunds are processed.",
  },
  anti_discrimination: {
    title: "Anti-discrimination Policy",
    description: "Our commitment to a platform free of discrimination for customers and partners.",
  },
};

const POLICY_PATH: Record<PolicyType, string> = {
  privacy: "privacy-policy",
  terms: "terms",
  refund: "refund-policy",
  anti_discrimination: "anti-discrimination-policy",
};

function policyTypeFromPath(path: string): PolicyType {
  if (path.includes("anti-discrimination")) return "anti_discrimination";
  if (path.includes("terms")) return "terms";
  if (path.includes("refund")) return "refund";
  return "privacy";
}

export default function PolicyPage() {
  const { pathname } = useLocation();
  const policyType = policyTypeFromPath(pathname);
  const meta = POLICY_META[policyType] ?? POLICY_META.privacy;

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    client
      .get(`/api/policies/${policyType}`)
      .then((res) => {
        const raw = res.data?.data?.content ?? "";
        setContent(raw.replace(/<[^>]+>/g, "").trim());
      })
      .catch(() => setError("Could not load this policy. Please try again later."))
      .finally(() => setLoading(false));
  }, [policyType]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted mb-8">
        <Link to="/" className="hover:text-primary transition-colors">QuickQare</Link>
        <span className="mx-2">›</span>
        <span className="text-ink">{meta.title}</span>
      </nav>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">{meta.title}</h1>
        <p className="text-muted text-sm">{meta.description}</p>
      </div>

      {/* Content */}
      <div className="card p-6 md:p-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-red-600 text-sm text-center py-8">{error}</p>
        ) : content ? (
          <div className="prose prose-sm max-w-none text-ink leading-7 whitespace-pre-line">
            {content}
          </div>
        ) : (
          <p className="text-muted text-sm text-center py-8">
            This policy is currently being updated. Please check back soon.
          </p>
        )}
      </div>

      {/* Footer links */}
      <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted">
        {(["privacy", "terms", "refund", "anti_discrimination"] as PolicyType[])
          .filter((t) => t !== policyType)
          .map((t) => (
            <Link
              key={t}
              to={`/${POLICY_PATH[t]}`}
              className="hover:text-primary transition-colors underline underline-offset-2"
            >
              {POLICY_META[t].title}
            </Link>
          ))}
      </div>
    </div>
  );
}
