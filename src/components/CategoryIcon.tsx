import React from "react";
import { useAppConfig } from "../hooks/useAppConfig";

// ─── SVG category icons matching the app ──────────────────────────────────────
const AcIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <rect x="1.5" y="2.5" width="25" height="13" rx="2.2" stroke={color} strokeWidth="1.6"/>
    <circle cx="22.5" cy="6" r="1.1" fill={color}/>
    <line x1="3.5" y1="13" x2="18" y2="13" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.55"/>
    <line x1="3.5" y1="10.8" x2="18" y2="10.8" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.55"/>
    <line x1="3.5" y1="8.6" x2="18" y2="8.6" stroke={color} strokeWidth="0.9" strokeLinecap="round" opacity="0.55"/>
    <line x1="8" y1="16.5" x2="8" y2="22.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
    <line x1="14" y1="16.5" x2="14" y2="25.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
    <line x1="20" y1="16.5" x2="20" y2="22.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.3"/>
  </svg>
);

const PlumbingIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <line x1="5" y1="23" x2="19" y2="7" stroke={color} strokeWidth="2.2" strokeLinecap="round"/>
    <circle cx="21.5" cy="6.5" r="4.5" stroke={color} strokeWidth="2"/>
    <line x1="4" y1="18" x2="4" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
    <line x1="4" y1="26" x2="12" y2="26" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.55"/>
  </svg>
);

const MehendiIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <rect x="4.5" y="5" width="3" height="11" rx="1.5" fill={color}/>
    <rect x="8.5" y="3" width="3" height="13" rx="1.5" fill={color}/>
    <rect x="12.5" y="4" width="3" height="12" rx="1.5" fill={color}/>
    <rect x="16.5" y="7" width="3" height="9" rx="1.5" fill={color}/>
    <rect x="3.5" y="15" width="17" height="10" rx="3" fill={color}/>
    <rect x="12" y="19" width="3" height="3" rx="0.4" fill="white" transform="rotate(45 13.5 20.5)"/>
    <rect x="0" y="17.5" width="3" height="7" rx="1.5" fill={color} transform="rotate(-18 1.5 21)"/>
  </svg>
);

const ElectricianIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="14" r="11" stroke={color} strokeWidth="1.6"/>
    <path d="M16 5.5L9.5 14.5H14.5L11 22.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CakeIcon = ({ size = 28, color = "#0A0A0A" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
    <circle cx="14" cy="4" r="1.4" fill={color}/>
    <line x1="14" y1="6.5" x2="14" y2="10" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M9 14v-2.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 19 11.5V14" stroke={color} strokeWidth="1.6"/>
    <path d="M4.5 22v-5.5A2.5 2.5 0 0 1 7 14h14a2.5 2.5 0 0 1 2.5 2.5V22" stroke={color} strokeWidth="1.6"/>
    <path d="M4.5 17.5c1.6 0 1.6 1.6 3.2 1.6s1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6 1.6 1.6 3.2 1.6 1.6-1.6 3.2-1.6" stroke={color} strokeWidth="1.3" strokeLinecap="round" opacity="0.6"/>
    <line x1="2.5" y1="22.5" x2="25.5" y2="22.5" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);

const SLUG_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  ac:          AcIcon,
  plumbing:    PlumbingIcon,
  mehendi:     MehendiIcon,
  mehndi:      MehendiIcon,
  electrician: ElectricianIcon,
  celebration: CakeIcon,
  cake:        CakeIcon,
};

export function getCatIcon(slug: string): React.FC<{ size?: number; color?: string }> {
  const key = slug.toLowerCase().replace(/\s+/g, "-");
  if (SLUG_ICONS[key]) return SLUG_ICONS[key];
  for (const k of Object.keys(SLUG_ICONS)) {
    if (key.includes(k) || k.includes(key)) return SLUG_ICONS[k];
  }
  return AcIcon;
}

// Renders the admin-uploaded category icon when set, else the built-in SVG.
export function CategoryIcon({ slug, size, color }: { slug: string; size: number; color: string }) {
  const { homeTheme } = useAppConfig();
  const k = slug.toLowerCase();
  const ci = homeTheme.categoryIcons;
  let url = "";
  if (k.includes("celebrat") || k.includes("cake")) url = ci.celebration ?? "";
  else if (k.includes("ac")) url = ci.acRepair ?? "";
  else if (k.includes("plumb")) url = ci.plumbing ?? "";
  else if (k.includes("mehend") || k.includes("mehndi")) url = ci.mehendi ?? "";
  else if (k.includes("electric")) url = ci.electrician ?? "";

  if (url) return <img src={url} alt="" style={{ width: size, height: size, objectFit: "contain" }} />;
  const Icon = getCatIcon(slug);
  return <Icon size={size} color={color} />;
}
