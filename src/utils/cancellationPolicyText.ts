/**
 * Renders a service's real, admin-configured cancellation policy as
 * human-readable lines — sourced from the same tier data the backend uses to
 * actually compute the refund (utils/pricing.js calculateSinceBookingRefund /
 * booking.controller.js calculateRefund on the backend). Screens previously
 * hardcoded "cancel within 1 hour for 100%, 50% after" regardless of what an
 * admin had actually configured for that service — an admin change made the
 * app's checkout copy quietly false. These helpers can never diverge from the
 * backend because they use the identical tier values and tie-break rules.
 */
export type SinceBookingTier = { maxHoursAfterBooking: number; refundPercent: number };
export type BeforeServiceTier = { minHoursBefore: number; refundPercent: number };

const hourWord = (h: number) => `${h} hour${h === 1 ? "" : "s"}`;

/**
 * SINCE_BOOKING policy (cakes): refund keyed on hours elapsed since the order
 * was PLACED, not time to delivery. Mirrors calculateSinceBookingRefund
 * exactly, including "beyond the last tier, the final (least generous) tier
 * applies forever" — never silently drops to 0%.
 */
export function getSinceBookingPolicyLines(tiers?: SinceBookingTier[] | null): string[] {
  if (!Array.isArray(tiers) || tiers.length === 0) return [];
  const sorted = [...tiers].sort(
    (a, b) => Number(a.maxHoursAfterBooking) - Number(b.maxHoursAfterBooking)
  );

  if (sorted.length === 1) {
    return [`You'll receive a ${Number(sorted[0].refundPercent)}% refund if you cancel this order.`];
  }

  const lines: string[] = [];
  const first = sorted[0];
  lines.push(
    `Cancel within ${hourWord(Number(first.maxHoursAfterBooking))} of booking for a ${Number(first.refundPercent)}% refund.`
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const isLast = i === sorted.length - 1;
    lines.push(
      isLast
        ? `After ${hourWord(Number(prev.maxHoursAfterBooking))}, cancelling refunds ${Number(cur.refundPercent)}% of the amount paid.`
        : `Cancel between ${hourWord(Number(prev.maxHoursAfterBooking))} and ${hourWord(Number(cur.maxHoursAfterBooking))} after booking for a ${Number(cur.refundPercent)}% refund.`
    );
  }
  return lines;
}

const DEFAULT_BEFORE_SERVICE_TIERS: BeforeServiceTier[] = [
  { minHoursBefore: 24, refundPercent: 100 },
  { minHoursBefore: 4, refundPercent: 75 },
  { minHoursBefore: 1, refundPercent: 50 },
  { minHoursBefore: 0, refundPercent: 25 },
];

/**
 * BEFORE_SERVICE policy (default for everything else): refund keyed on hours
 * remaining until the scheduled service. Falls back to the platform default
 * tiers when the service has none configured — the same fallback
 * calculateRefund applies — so this text can never promise more than the
 * backend will actually pay out.
 */
export function getBeforeServicePolicyLines(tiers?: BeforeServiceTier[] | null): string[] {
  const active = Array.isArray(tiers) && tiers.length > 0 ? tiers : DEFAULT_BEFORE_SERVICE_TIERS;
  const sorted = [...active].sort((a, b) => Number(b.minHoursBefore) - Number(a.minHoursBefore));

  return sorted.map((tier, idx) => {
    const hours = Number(tier.minHoursBefore);
    const percent = Number(tier.refundPercent);
    if (idx === 0) {
      return `More than ${hourWord(hours)} before your scheduled time: ${percent}% refund.`;
    }
    const prevHours = Number(sorted[idx - 1].minHoursBefore);
    return hours > 0
      ? `Between ${hourWord(hours)} and ${hourWord(prevHours)} before: ${percent}% refund.`
      : `Less than ${hourWord(prevHours)} before your scheduled time: ${percent}% refund.`;
  });
}

/** Cake lead-time note — "orders must be placed at least N day(s) before delivery." */
export function getLeadTimeLine(minLeadDays?: number | null): string | null {
  const n = Math.max(Number(minLeadDays) || 0, 0);
  if (n <= 0) return null;
  return `Cakes are baked to order, so orders must be placed at least ${n} day${n === 1 ? "" : "s"} before delivery.`;
}

export type CancellationGrace = {
  windowMinutes?: number;
  appliesBelowLeadHours?: number;
};

const windowWord = (minutes: number) =>
  minutes % 60 === 0 ? hourWord(minutes / 60) : `${minutes} minutes`;

/**
 * Grace-period line — mirrors the backend's freeCancelUntil rule (computed at
 * booking creation in createBooking): an order placed with under
 * appliesBelowLeadHours of notice gets windowMinutes from booking to cancel
 * at 100%, overriding the tier it would otherwise land in.
 */
export function getGraceLine(grace?: CancellationGrace | null): string | null {
  const windowMinutes = Number(grace?.windowMinutes) || 0;
  if (windowMinutes <= 0) return null;
  const threshold = Number(grace?.appliesBelowLeadHours) || 0;
  return threshold > 0
    ? `Ordering less than ${hourWord(threshold)} before delivery? You still get ${windowWord(windowMinutes)} from booking to cancel for a full refund.`
    : `You get ${windowWord(windowMinutes)} from booking to cancel for a full refund.`;
}

/**
 * Picks the right policy branch for a service and renders it end to end —
 * the one function screens actually call.
 */
export function getCancellationPolicyLines(service?: {
  cancellationPolicyType?: "BEFORE_SERVICE" | "SINCE_BOOKING";
  sinceBookingTiers?: SinceBookingTier[];
  cancellationTiers?: BeforeServiceTier[];
  cancellationGrace?: CancellationGrace | null;
} | null): string[] {
  let lines: string[] = [];
  if (service?.cancellationPolicyType === "SINCE_BOOKING") {
    lines = getSinceBookingPolicyLines(service.sinceBookingTiers);
  }
  if (!lines.length) {
    lines = getBeforeServicePolicyLines(service?.cancellationTiers);
  }
  const graceLine = getGraceLine(service?.cancellationGrace);
  return graceLine ? [...lines, graceLine] : lines;
}
