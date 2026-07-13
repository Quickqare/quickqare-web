import { Link } from "react-router-dom";
import { useAppConfig, SocialLinks } from "../hooks/useAppConfig";
import { safeExternalUrl } from "../lib/safeUrl";

// ─── Social icons ───────────────────────────────────────────────────────────────
const WhatsAppIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.35c1.37.73 2.94 1.15 4.62 1.15h.01c5.46 0 9.9-4.45 9.9-9.9C21.95 6.45 17.5 2 12.04 2zm5.72 14.13c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.13.11-1.82-.12-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.02-2.41.27-.29.58-.36.78-.36.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.48-.14.14-.28.28-.12.56.16.28.72 1.19 1.55 1.93 1.06.95 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.68-.79.86-1.06.18-.28.36-.23.6-.14.24.09 1.55.73 1.82.86.27.14.45.2.51.31.07.12.07.66-.17 1.34z"/>
  </svg>
);
const InstagramIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke={color} strokeWidth="1.8"/>
    <circle cx="12" cy="12" r="4.3" stroke={color} strokeWidth="1.8"/>
    <circle cx="17.4" cy="6.6" r="1.15" fill={color}/>
  </svg>
);
const FacebookIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M15.12 8.5H13V7c0-.75.5-.93.85-.93h1.22V3.6L13.06 3.6C10.68 3.6 10.1 5.36 10.1 6.86V8.5H8.3v3h1.8V21h2.9v-9.5h2.09l.33-3z"/>
  </svg>
);
const XIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M18.24 3H21l-6.35 7.26L22 21h-6.24l-4.88-6.4L5.3 21H2.5l6.8-7.77L2 3h6.4l4.4 5.86L18.24 3zm-1.1 16h1.53L7 4.9H5.36L17.14 19z"/>
  </svg>
);
const YouTubeIcon = ({ size = 18, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M22 12c0-2.1-.2-3.5-.4-4.2-.3-.8-.9-1.4-1.7-1.7C18.8 5.7 12 5.7 12 5.7s-6.8 0-7.9.4c-.8.3-1.4.9-1.7 1.7C2.2 8.5 2 9.9 2 12s.2 3.5.4 4.2c.3.8.9 1.4 1.7 1.7 1.1.4 7.9.4 7.9.4s6.8 0 7.9-.4c.8-.3 1.4-.9 1.7-1.7.2-.7.4-2.1.4-4.2zM10 15.2V8.8l5.5 3.2-5.5 3.2z"/>
  </svg>
);

const SOCIAL_ICON_MAP: Record<
  keyof SocialLinks,
  { Icon: React.FC<{ size?: number; color?: string }>; label: string }
> = {
  whatsapp:  { Icon: WhatsAppIcon,  label: "WhatsApp" },
  instagram: { Icon: InstagramIcon, label: "Instagram" },
  facebook:  { Icon: FacebookIcon,  label: "Facebook" },
  twitter:   { Icon: XIcon,         label: "X" },
  youtube:   { Icon: YouTubeIcon,   label: "YouTube" },
};

// Site-wide footer — rendered once in App.tsx (sibling to <Routes>) so every
// page gets it. Previously lived only inline inside HomePage, so every other
// page (bookings, profile, complaints, referral, policies…) had no footer at
// all. A separate, unused, differently-styled Footer.tsx also existed —
// dead code from before the inline version replaced it — this file now
// supersedes both with the one actually shown to customers.
export default function Footer() {
  const { socialLinks } = useAppConfig();
  // An icon whose configured URL isn't a safe http(s) link is dropped rather
  // than rendered as an exploitable href — see lib/safeUrl.
  const activeSocialLinks = (Object.keys(SOCIAL_ICON_MAP) as (keyof SocialLinks)[])
    .flatMap((key) => {
      const url = safeExternalUrl(socialLinks[key]);
      return url ? [{ key, url, ...SOCIAL_ICON_MAP[key] }] : [];
    });

  return (
    <div className="border-t border-border py-6 px-4 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-4">
        {activeSocialLinks.length > 0 && (
          <div className="flex items-center justify-center md:justify-start gap-3">
            {activeSocialLinks.map(({ key, url, Icon, label }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted hover:text-ink hover:border-ink transition"
              >
                <Icon size={16} color="currentColor" />
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted">
          <span>© {new Date().getFullYear()} QuickQare. All rights reserved.</span>
          <div className="flex items-center gap-5">
            <Link to="/privacy-policy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-ink transition-colors">Terms & Conditions</Link>
            <Link to="/refund-policy" className="hover:text-ink transition-colors">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
