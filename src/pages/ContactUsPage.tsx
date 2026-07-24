import { Link } from "react-router-dom";
import { useAppConfig } from "../hooks/useAppConfig";
import { safeExternalUrl } from "../lib/safeUrl";

export default function ContactUsPage() {
  const { contactInfo, socialLinks } = useAppConfig();
  const whatsappUrl = safeExternalUrl(socialLinks.whatsapp);
  const hasAnyContact = Boolean(contactInfo.email || contactInfo.phone || whatsappUrl);

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <nav className="text-sm text-muted mb-8">
        <Link to="/" className="hover:text-primary transition-colors">QuickQare</Link>
        <span className="mx-2">›</span>
        <span className="text-ink">Contact Us</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">Contact Us</h1>
        <p className="text-muted text-sm">We're happy to help with bookings, complaints, or anything else.</p>
      </div>

      <div className="card p-6 md:p-8">
        {!hasAnyContact ? (
          <p className="text-muted text-sm text-center py-8">
            Contact details are being updated. Please check back soon.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {contactInfo.email && (
              <a
                href={`mailto:${contactInfo.email}`}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5A2.25 2.25 0 0118.75 19.5H5.25A2.25 2.25 0 013 17.25V6.75z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 6.5l8.5 6 8.5-6" />
                  </svg>
                </span>
                <div>
                  <div className="text-xs text-muted uppercase tracking-wide">Email</div>
                  <div className="text-sm font-semibold text-ink">{contactInfo.email}</div>
                </div>
              </a>
            )}

            {contactInfo.phone && (
              <a
                href={`tel:${contactInfo.phone}`}
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h1.5a1.5 1.5 0 001.5-1.5v-2.006a1.5 1.5 0 00-1.212-1.472l-3.06-.612a1.5 1.5 0 00-1.503.44l-.774.773a11.25 11.25 0 01-5.964-5.964l.773-.774a1.5 1.5 0 00.44-1.503l-.612-3.06A1.5 1.5 0 007.756 4.5H5.75a1.5 1.5 0 00-1.5 1.5v.75z" />
                  </svg>
                </span>
                <div>
                  <div className="text-xs text-muted uppercase tracking-wide">Phone</div>
                  <div className="text-sm font-semibold text-ink">{contactInfo.phone}</div>
                </div>
              </a>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.35c1.37.73 2.94 1.15 4.62 1.15h.01c5.46 0 9.9-4.45 9.9-9.9C21.95 6.45 17.5 2 12.04 2z"/>
                  </svg>
                </span>
                <div>
                  <div className="text-xs text-muted uppercase tracking-wide">WhatsApp</div>
                  <div className="text-sm font-semibold text-ink">Chat with us</div>
                </div>
              </a>
            )}
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-wrap gap-4 text-sm text-muted">
        <Link to="/complaints/new" className="hover:text-primary transition-colors underline underline-offset-2">
          File a complaint
        </Link>
        <Link to="/register-professional" className="hover:text-primary transition-colors underline underline-offset-2">
          Register as a Professional
        </Link>
      </div>
    </div>
  );
}
