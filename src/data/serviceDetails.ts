export type ServiceOption = {
  key: string;
  title: string;
  rating?: number;
  reviews?: string;
  price: number;
  duration: string;
  description: string;
  bullets?: string[];
  optionsCount?: number;
};

export type NestedServiceOption = {
  key: string;
  title: string;
  price: number;
  duration: string;
  description: string;
};

export type ServiceSection = {
  key: string;
  title: string;
  options: ServiceOption[];
};

export type ServiceTemplate = {
  heroTag: string;
  heroTitle: string;
  heroSubtitle: string;
  coverTitle: string;
  coverSubtitle: string;
  highlights: string[];
  sections: ServiceSection[];
};

export const AC_REPAIR_ISSUE_OPTIONS: NestedServiceOption[] = [
  { key: "less-no-cooling",      title: "Less / no cooling",       price: 299, duration: "60 mins", description: "Cooling performance check with diagnosis and issue identification." },
  { key: "power-issue",          title: "Power issue",             price: 299, duration: "60 mins", description: "Diagnosis for startup failure, breaker trip, or power connection issue." },
  { key: "unwanted-noise-smell", title: "Unwanted noise / smell",  price: 299, duration: "60 mins", description: "Inspection for vibration, odor source, fan issue, or internal blockage." },
  { key: "water-leakage",        title: "Water leakage",           price: 599, duration: "60 mins", description: "Drain line, tray, and flow-path inspection for leakage resolution." },
];

export const AC_INSTALLATION_OPTIONS: NestedServiceOption[] = [
  { key: "split-ac-installation",  title: "Split AC",  price: 1599, duration: "90 mins", description: "Installation for split AC indoor and outdoor units with setup check." },
  { key: "window-ac-installation", title: "Window AC", price: 999,  duration: "75 mins", description: "Installation for window AC with fitting and performance check." },
];

export const AC_UNINSTALLATION_OPTIONS: NestedServiceOption[] = [
  { key: "split-ac-uninstallation",  title: "Split AC",  price: 899, duration: "75 mins", description: "Safe uninstallation for split AC indoor and outdoor units." },
  { key: "window-ac-uninstallation", title: "Window AC", price: 699, duration: "60 mins", description: "Safe removal for window AC with fitting and support check." },
];

export const MEHENDI_FEET_ADDON_OPTIONS: NestedServiceOption[] = [
  { key: "mehendi-feet",        title: "Basic Feet",  price: 150, duration: "60 mins",  description: "Leg mehendi add-on covering both feet in one booking." },
  { key: "mehendi-ankle",       title: "Ankle",       price: 250, duration: "120 mins", description: "Leg mehendi add-on covering both legs up to ankle level in one booking." },
  { key: "mehendi-above-ankle", title: "Above Ankle", price: 350, duration: "150 mins", description: "Leg mehendi add-on covering both legs above ankle level in one booking." },
  { key: "mehendi-mid-leg",     title: "Mid Leg",     price: 599, duration: "180 mins", description: "Leg mehendi add-on covering both legs up to mid-leg in one booking." },
  { key: "mehendi-below-knee",  title: "Below Knee",  price: 799, duration: "240 mins", description: "Leg mehendi add-on covering both legs below knee level in one booking." },
];

const safePrice = (v: number | undefined, fallback: number) => {
  const p = Number(v);
  return Number.isFinite(p) && p > 0 ? Math.round(p) : fallback;
};

const buildAcTemplate = (name: string, price: number, desc?: string): ServiceTemplate => {
  const base = safePrice(price, 499);
  return {
    heroTag: "INSTANT",
    heroTitle: `${name} in 60 mins`,
    heroSubtitle: `Starts at ₹${base}`,
    coverTitle: "QuickQare cover",
    coverSubtitle: "Up to 30 days warranty on repair work",
    highlights: [
      "Preferred by customers for safe and proper AC setup",
      "Original spares used only when required",
      desc || "Transparent pricing before work starts",
    ],
    sections: [
      {
        key: "service",
        title: "Service",
        options: [
          { key: "lite-ac-service",  title: "Lite AC service",  price: base,       duration: "45 mins", description: "Applicable for window and split AC units.",           bullets: ["Indoor unit cleaning with water jet spray", "Filter and airflow inspection"] },
          { key: "deep-ac-service",  title: "Deep AC service",  price: 599,        duration: "75 mins", description: "Deep internal cleaning and coil maintenance.",          bullets: ["Foam jet cleaning for indoor unit", "Outdoor unit wash and performance check"] },
        ],
      },
      {
        key: "repair-gas-refill",
        title: "Repair & gas refill",
        options: [
          { key: "ac-repair",          title: "AC repair",            price: Math.max(base - 200, 299),  duration: "60 mins",        description: "Complete diagnosis to identify issues before repair.", optionsCount: 4 },
          { key: "gas-refill-checkup", title: "Gas refill & check-up", price: Math.max(base + 1900, 1800), duration: "2 hrs 30 mins", description: "Refrigerant refill with leak check and pressure test." },
        ],
      },
      {
        key: "installation-uninstallation",
        title: "Installation / uninstallation",
        options: [
          { key: "ac-installation",   title: "AC installation",   price: Math.max(base + 600, 1099), duration: "90 mins", description: "Installation of indoor and outdoor units with free gas check.", optionsCount: 2 },
          { key: "ac-uninstallation", title: "AC uninstallation", price: Math.max(base + 200, 699),  duration: "75 mins", description: "Safe unit removal for relocation or replacement.",              optionsCount: 2 },
        ],
      },
    ],
  };
};

const buildMehendiTemplate = (name: string, price: number, desc?: string): ServiceTemplate => {
  const base = safePrice(price, 399);
  return {
    heroTag: "BRIDAL",
    heroTitle: `${name} at home`,
    heroSubtitle: `Starts at ₹${base}`,
    coverTitle: "QuickQare mehendi promise",
    coverSubtitle: "Professional artists and hygienic cone application",
    highlights: [
      "Single artist or multi-artist booking support",
      "Choose one hand or both hands at checkout",
      "Organic cone made from natural ingredients",
      "Book by length now, pick your design later. Choose from our artist's lookbook or share your own design when they arrive.",
      desc || "Bridal and festive mehendi with customizable design length",
    ],
    sections: [
      {
        key: "design-length",
        title: "Design length",
        options: [
          { key: "minimal-mehendi",           title: "Minimal Mehendi Design",         price: Math.max(base, 399),         duration: "60 mins",  description: "Simple design on hands (front and back).",                            bullets: ["Good for small functions", "One hand base pricing"] },
          { key: "palm-length-mehendi",        title: "Palm Length Mehendi",            price: Math.max(base + 100, 499),   duration: "90 mins",  description: "Elegant design covering palm area (front and back)." },
          { key: "bangle-length-mehendi",      title: "Bangle Length Mehendi",          price: Math.max(base + 400, 799),   duration: "120 mins", description: "Traditional designs up to wrist/bangle length." },
          { key: "mid-length-mehendi",         title: "Mid Length Mehendi",             price: Math.max(base + 600, 999),   duration: "150 mins", description: "Mid-arm length designs for festive occasions." },
          { key: "elbow-bridal-mehendi",       title: "Elbow Length Bridal Mehendi",    price: Math.max(base + 1600, 1999), duration: "200 mins", description: "Intricate bridal designs on both hands up to elbow." },
          { key: "above-elbow-bridal-mehendi", title: "Above Elbow Bridal Mehendi",     price: Math.max(base + 2100, 2499), duration: "8 hrs",    description: "Premium bridal patterns above elbow with fine detailing.", bullets: ["Includes basic mehendi for feet"] },
        ],
      },
      {
        key: "add-on-services",
        title: "Add-on services",
        options: [
          { key: "mehendi-guests", title: "Mehendi for Guests", price: 150, duration: "30 mins", description: "Guest mehendi per person for family events and weddings." },
          ...MEHENDI_FEET_ADDON_OPTIONS.map((o) => ({ key: o.key, title: o.title, price: o.price, duration: o.duration, description: o.description })),
        ],
      },
    ],
  };
};

const buildPlumbingTemplate = (name: string, price: number, desc?: string): ServiceTemplate => {
  const base = safePrice(price, 349);
  return {
    heroTag: "TRUSTED",
    heroTitle: `${name} by verified experts`,
    heroSubtitle: `Starts at ₹${base}`,
    coverTitle: "QuickQare plumbing cover",
    coverSubtitle: "Service guarantee with post-job support",
    highlights: ["Leak, tap and drainage issues solved quickly", "Standardized materials and transparent billing", desc || "Skilled plumbing support for common home issues"],
    sections: [
      { key: "inspection-repair", title: "Inspection & repair", options: [
        { key: "tap-leak-repair", title: "Tap and leak repair",    price: base,        duration: "45 mins", description: "Fixing leakage, dripping taps and loose fittings." },
        { key: "drain-blockage",  title: "Drain blockage removal", price: base + 150,  duration: "60 mins", description: "Complete drain clearing with flow and pressure check." },
      ]},
      { key: "installation", title: "Installation", options: [
        { key: "fitting-installation", title: "Fitting installation", price: base + 350, duration: "75 mins", description: "Basin, shower and bathroom accessory installation with testing." },
      ]},
    ],
  };
};

const buildElectricianTemplate = (name: string, price: number, desc?: string): ServiceTemplate => {
  const base = safePrice(price, 299);
  return {
    heroTag: "SAFE",
    heroTitle: `${name} for home safety`,
    heroSubtitle: `Starts at ₹${base}`,
    coverTitle: "QuickQare electrical cover",
    coverSubtitle: "Safe tools and verified electricians for every task",
    highlights: ["Switchboard, fan and light repairs", "Load safety checks before installation", desc || "Certified electricians for reliable electrical work"],
    sections: [
      { key: "repairs", title: "Repairs", options: [
        { key: "switch-repair",      title: "Switch and socket repair", price: base,       duration: "30 mins", description: "Repair for sparking, loose points and faulty sockets." },
        { key: "wiring-inspection",  title: "Wiring inspection",        price: base + 200, duration: "50 mins", description: "Detailed circuit inspection with safety recommendations." },
      ]},
      { key: "installations", title: "Installations", options: [
        { key: "fan-light-installation", title: "Fan and light installation", price: 599, duration: "60 mins", description: "Installation and testing for fan, lights and fixtures." },
      ]},
    ],
  };
};

const buildFallbackTemplate = (name: string, price: number, desc?: string): ServiceTemplate => {
  const base = safePrice(price, 399);
  return {
    heroTag: "QUICKQARE",
    heroTitle: `${name} by verified partners`,
    heroSubtitle: `Starts at ₹${base}`,
    coverTitle: "QuickQare standard support",
    coverSubtitle: "Trusted experts, transparent pricing and on-time service",
    highlights: ["Verified professionals", "Clear pricing before work starts", desc || "Book your service and schedule a convenient slot"],
    sections: [
      { key: "recommended", title: "Recommended options", options: [
        { key: "basic-option",   title: `${name} basic`,   price: base,       duration: "45 mins", description: `Basic ${name.toLowerCase()} support for common issues.` },
        { key: "premium-option", title: `${name} premium`, price: base + 300, duration: "70 mins", description: `Detailed ${name.toLowerCase()} work with extra checks.` },
      ]},
    ],
  };
};

const buildCelebrationTemplate = (name: string, price: number, desc?: string): ServiceTemplate => {
  const base = safePrice(price, 799);
  return {
    heroTag: "FESTIVE",
    heroTitle: `${name} baked fresh for you`,
    heroSubtitle: `Starts at ₹${base}`,
    coverTitle: "QuickQare celebration promise",
    coverSubtitle: "Freshly baked cakes, customized for every occasion",
    highlights: [
      "Freshly baked to order by verified local bakers",
      "Personalize with a custom name on cake and reference photo",
      "Go big, save big. Perfect for crowds.",
      desc || "Customizable flavours, tiers and add-ons for every celebration",
    ],
    sections: [
      { key: "popular-picks", title: "Popular picks", options: [
        { key: "single-tier-cake", title: "Single tier celebration cake", price: base,       duration: "45 mins", description: "Classic single tier cake, freshly baked to order." },
        { key: "two-tier-cake",    title: "Two tier celebration cake",    price: base + 300, duration: "70 mins", description: "Two tier cake for bigger celebrations." },
      ]},
    ],
  };
};

export function getServiceTemplate(name: string, price?: number, desc?: string): ServiceTemplate {
  const n = (name || "Service").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const p = safePrice(price, 499);
  if (n.includes("ac"))                                        return buildAcTemplate(name, p, desc);
  if (n.includes("plumb"))                                     return buildPlumbingTemplate(name, p, desc);
  if (n.includes("elect"))                                     return buildElectricianTemplate(name, p, desc);
  if (n.includes("mehendi") || n.includes("mehndi") || n.includes("henna")) return buildMehendiTemplate(name, p, desc);
  if (n.includes("celebration") || n.includes("cake"))         return buildCelebrationTemplate(name, p, desc);
  return buildFallbackTemplate(name, p, desc);
}
