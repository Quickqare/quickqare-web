// Local-calendar-date helpers.
//
// `Date#toISOString()` first converts to UTC, so `new Date().toISOString().split("T")[0]`
// silently returns YESTERDAY's date for any IST customer booking between
// midnight and 5:29 AM (UTC+5:30 means local midnight is still 18:30 UTC the
// PREVIOUS day). That shifted the date picker's `min` a day into the past and
// let a cake's minLeadDays resolve to "today" instead of "tomorrow". Building
// the string from local Y/M/D components instead avoids the UTC round-trip.
export function localDateISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Local-calendar date `days` days from now (negative to go backward).
export function localDateISOPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateISO(d);
}
