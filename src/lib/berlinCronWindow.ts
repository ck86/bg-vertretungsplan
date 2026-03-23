/**
 * True during [06:00, 15:00) in Europe/Berlin (6:00 inclusive through 14:59).
 * Used because Vercel cron schedules are UTC-only; we narrow with a TZ-aware check.
 */
export function isWithinBerlinPlanWatchWindow(date = new Date()): boolean {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "numeric",
    hour12: false,
  }).format(date)
  const hour = Number.parseInt(hourStr, 10)
  if (Number.isNaN(hour)) return false
  return hour >= 6 && hour < 15
}
