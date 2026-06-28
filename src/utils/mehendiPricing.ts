const normalize = (v: string) =>
  String(v).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const FEET_NAMES = new Set(["feet", "basic feet", "ankle", "above ankle", "mid leg", "below knee"]);

export const getMehendiPricingKey = (name?: string | null): string | null => {
  const n = normalize(name || "");
  if (n.includes("minimal mehendi"))              return "minimal";
  if (n.includes("palm length mehendi"))          return "palm";
  if (n.includes("bangle length mehendi"))        return "bangle";
  if (n.includes("mid length mehendi"))           return "mid";
  if (n.includes("elbow length bridal mehendi"))  return "elbow_bridal";
  if (n.includes("above elbow bridal mehendi"))   return "above_elbow_bridal";
  return null;
};

export const getMehendiHandsPrice = (key: string | null, hands: number): number | null => {
  const q = Math.max(hands, 1);
  if (key === "minimal")            return [0, 399, 699, 999, 1199][q] ?? q * 299;
  if (key === "palm")               return [0, 499, 798, 1149, 1499][q] ?? q * 399;
  if (key === "bangle")             return [0, 799, 1199, 1699, 2199][q] ?? Math.round(q * 599 * 0.95);
  if (key === "mid")                return [0, 999, 1499, 2099, 2599][q] ?? q * 629;
  if (key === "elbow_bridal")       return [0, 1799, 3000][q] ?? Math.round(q * 1799 * 0.75);
  if (key === "above_elbow_bridal") return [0, 2000, 3500][q] ?? null;
  return null;
};

export const isMehendiHandOption = (name?: string | null): boolean => {
  if (!name) return false;
  const n = normalize(name);
  if (!n.includes("mehendi") && !n.includes("mehndi")) return false;
  if (FEET_NAMES.has(n)) return false;
  if (n === "mehendi for guests") return false;
  return getMehendiPricingKey(name) !== null;
};

export const isMehendiAddon = (name?: string | null): boolean =>
  FEET_NAMES.has(normalize(name || ""));

export const isBridalMehendi = (name?: string | null): boolean =>
  normalize(name || "").includes("bridal mehendi");

export const hasBridalInCart = (cart: Array<{ name: string }>): boolean =>
  cart.some((i) => isBridalMehendi(i.name));

export const hasMehendiHandInCart = (cart: Array<{ name: string }>): boolean =>
  cart.some((i) => isMehendiHandOption(i.name));

export const getCartItemTotal = (
  item: { name: string; price: number; quantity: number; pricingKey?: string | null },
  cart: Array<{ name: string; price: number; quantity: number; pricingKey?: string | null }>
): number => {
  const rulePrice = getMehendiHandsPrice(item.pricingKey ?? null, item.quantity);
  if (rulePrice !== null) return rulePrice;

  const n = normalize(item.name);
  // Basic Feet free with bridal
  if ((n === "feet" || n === "basic feet") && hasBridalInCart(cart)) return 0;
  // Mid Leg / Below Knee 34% off when any hand design in cart
  if ((n === "mid leg" || n === "below knee") && hasMehendiHandInCart(cart))
    return Math.round(item.price * item.quantity * 0.66);

  return item.price * Math.max(item.quantity, 1);
};
