/**
 * Report boundaries are computed in the shop's own timezone (REPORT_TZ) so a
 * "day" matches the owner's day, not UTC.
 */
export const TZ = () => process.env.REPORT_TZ || 'Asia/Kolkata';

/** Offset of `tz` from UTC, in minutes, at the given instant. */
function tzOffsetMinutes(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return (asUTC - date.getTime()) / 60000;
}

/** Turns a wall-clock time in `tz` into the correct UTC Date. */
function zonedToUtc(y, m, d, hh = 0, mm = 0, ss = 0, ms = 0, tz = TZ()) {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, ss, ms));
  const offset = tzOffsetMinutes(guess, tz);
  return new Date(guess.getTime() - offset * 60000);
}

/** "2026-09-22" -> [startOfDayUTC, startOfNextDayUTC) */
export function dayRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) throw Object.assign(new Error('Use date=YYYY-MM-DD'), { status: 400 });
  return { from: zonedToUtc(y, m, d), to: zonedToUtc(y, m, d + 1) };
}

/** "2026-09" -> [startOfMonthUTC, startOfNextMonthUTC) */
export function monthRange(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  if (!y || !m) throw Object.assign(new Error('Use month=YYYY-MM'), { status: 400 });
  return { from: zonedToUtc(y, m, 1), to: zonedToUtc(y, m + 1, 1) };
}

/**
 * The Monday→Sunday week that contains `dateStr` (YYYY-MM-DD).
 * Returns { from, to, start, end } where start/end are YYYY-MM-DD labels.
 */
export function weekRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) throw Object.assign(new Error('Use date=YYYY-MM-DD'), { status: 400 });
  // Weekday of the date (0=Sun..6=Sat) computed in UTC to avoid tz drift.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const backToMonday = (dow + 6) % 7; // days since Monday
  const from = zonedToUtc(y, m, d - backToMonday);
  const to = zonedToUtc(y, m, d - backToMonday + 7);
  const fmt = (dt) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
  return { from, to, start: fmt(from), end: fmt(new Date(to.getTime() - 86400000)) };
}

/** Today's date in the shop timezone, as YYYY-MM-DD. */
export function todayStr(tz = TZ()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
