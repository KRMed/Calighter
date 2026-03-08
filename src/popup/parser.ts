import {
  parse as parseDF,
  isValid,
  addDays,
  getDay,
  isBefore,
  startOfDay,
  nextSunday,
  nextMonday,
  nextTuesday,
  nextWednesday,
  nextThursday,
  nextFriday,
  nextSaturday,
} from "date-fns";

// -------------------- Types --------------------
export type DateOnly = { year: number; month: number; day: number };
export type TimeOnly = { hour: number; minute: number };
export type ParsedTime =
  | { type: "none" }
  | { type: "single"; start: TimeOnly }
  | { type: "range"; start: TimeOnly; end: TimeOnly };

export type ParsedZone = { iana?: string; offsetMinutes?: number } | null;

// -------------------- Constants & Utils --------------------
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const nextMap: Record<string, (d: Date) => Date> = {
  sunday: nextSunday,
  monday: nextMonday,
  tuesday: nextTuesday,
  wednesday: nextWednesday,
  thursday: nextThursday,
  friday: nextFriday,
  saturday: nextSaturday,
};

// Common TZ abbreviations → IANA
const TZ_MAP: Record<string, string> = {
  // US / North America (incl. shorthand ET/CT/MT/PT)
  et: "America/New_York",
  est: "America/New_York",
  edt: "America/New_York",
  ct: "America/Chicago",
  cst: "America/Chicago",
  cdt: "America/Chicago",
  mt: "America/Denver",
  mst: "America/Denver",
  mdt: "America/Denver",
  pt: "America/Los_Angeles",
  pst: "America/Los_Angeles",
  pdt: "America/Los_Angeles",

  // Common international
  gmt: "Etc/GMT",
  utc: "Etc/UTC",
  cet: "Europe/Berlin",
  cest: "Europe/Berlin",
  bst: "Europe/London",
  ist: "Asia/Kolkata", // ambiguous; we pick India here
  jst: "Asia/Tokyo",
  aest: "Australia/Sydney",
  aedt: "Australia/Sydney",
};

const normalize = (s: string) =>
  s
    .replace(/\u00A0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

// -------------------- DATE PARSER --------------------
export function extractDateOnly(text: string, now = new Date()): DateOnly | null {
  const s = normalize(text);

  // today / tomorrow
  if (/\btoday\b/.test(s)) {
    const d = startOfDay(now);
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  if (/\btomorrow\b/.test(s)) {
    const d = startOfDay(addDays(now, 1));
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  // next <weekday>
  const wd = s.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd && /\bnext\b/.test(s)) {
    const f = nextMap[wd[1]];
    const d = startOfDay(f(now));
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  // yyyy-MM-dd
  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) {
    const d = parseDF(m[0], "yyyy-M-d", now);
    if (isValid(d)) return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  // MM/DD/YYYY
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) {
    const d = parseDF(m[0], "M/d/yyyy", now);
    if (isValid(d)) return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  // MM/DD/YY (2-digit year, e.g. "3/15/26")
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2})(?!\d)\b/);
  if (m) {
    const month = +m[1], day = +m[2];
    let yr = +m[3];
    yr = yr <= 69 ? 2000 + yr : 1900 + yr; // pivot: 00–69 → 2000–2069, 70–99 → 1900–1999
    const d = new Date(yr, month - 1, day);
    if (isValid(d)) return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  // Month names with optional ordinals: "Oct 11", "Oct 11th", "October 2nd, 2025"
  m = s.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?\b/
  );
  if (m) {
    const raw = m[0].replace(",", "").replace(/\b(\d{1,2})(st|nd|rd|th)\b/, "$1").trim();
    // normalize() lowercased everything; capitalize for date-fns locale matching
    // Try both full ("MMMM" = "March") and abbreviated ("MMM" = "Mar") month name formats
    const rawCap = raw.charAt(0).toUpperCase() + raw.slice(1);
    let d = parseDF(rawCap, "MMMM d yyyy", now);
    if (!isValid(d)) d = parseDF(rawCap, "MMM d yyyy", now);
    if (!isValid(d)) d = parseDF(rawCap, "MMMM d", now);
    if (!isValid(d)) d = parseDF(rawCap, "MMM d", now);
    if (isValid(d)) return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  // MM/DD (no year), optional weekday e.g., "Friday 10/10"
  // Lookbehind prevents matching the DD/YY tail of an MM/DD/YY string
  m = s.match(/(?<![/\d])\b(\d{1,2})\/(\d{1,2})(?![/\d])\b/);
  if (m) {
    const month = +m[1],
      day = +m[2];
    let year = now.getFullYear();
    let d = new Date(year, month - 1, day);
    if (!isValid(d)) return null;

    const wanted = wd ? WEEKDAYS.indexOf(wd[1]) : -1;
    if (wanted !== -1 && getDay(d) !== wanted) {
      const dNextYear = new Date(year + 1, month - 1, day);
      if (getDay(dNextYear) === wanted) d = dNextYear;
    } else {
      const today = startOfDay(now);
      if (isBefore(d, today)) d = new Date(year + 1, month - 1, day); // forward-only if past
    }
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }

  return null;
}

// -------------------- TIME PARSER --------------------
export function extractTimeOnly(text: string): ParsedTime {
  const s = normalize(text).replace(/[,;.!?]/g, "");

  if (/\bnoon\b/.test(s)) return { type: "single", start: { hour: 12, minute: 0 } };
  if (/\bmidnight\b/.test(s)) return { type: "single", start: { hour: 0, minute: 0 } };

  // Range: "3-5pm", "3pm-5", "from 3 to 5", "between 3 and 5"
  let m =
    s.match(
      /\b(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)?\b/
    ) ||
    s.match(
      /\b(?:from|between)\s+(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)?\s+(?:to|and)\s+(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)?\b/
    );
  if (m) {
    let [, h1, mm1, ap1, h2, mm2, ap2] = m;
    if (!ap1 && ap2) ap1 = ap2; // propagate am/pm to start if only at end
    const H1 = to24(+h1, ap1),
      M1 = mm1 ? +mm1 : 0;
    const H2 = to24(+h2, ap2),
      M2 = mm2 ? +mm2 : 0;
    return { type: "range", start: { hour: H1, minute: M1 }, end: { hour: H2, minute: M2 } };
  }

  // Single 12h: "6pm" / "6:00 pm"
  m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a|am|p|pm)\b/);
  if (m) {
    const H = to24(+m[1], m[3]),
      M = m[2] ? +m[2] : 0;
    return { type: "single", start: { hour: H, minute: M } };
  }

  // Single 24h: "18:30"
  m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) {
    const H = +m[1],
      M = +m[2];
    if (H >= 0 && H <= 23 && M >= 0 && M <= 59)
      return { type: "single", start: { hour: H, minute: M } };
  }

  // "@ 6" / "at 6" — prefix is required to avoid matching bare day numbers (e.g. "March 15")
  m = s.match(/\b(?:@|at)\s+(\d{1,2})\b/);
  if (m) {
    const H = +m[1];
    if (H >= 0 && H <= 23) return { type: "single", start: { hour: H, minute: 0 } };
  }

  return { type: "none" };
}

// -------------------- TIME ZONE DETECTION --------------------
export function extractTimeZoneCode(text: string): ParsedZone {
  const s = normalize(text);

  // 1) Numeric UTC/GMT offsets: UTC+2 | UTC-07 | GMT+0530 | UTC+05:30
  const off = parseUtcOffset(s);
  if (off !== null) return { offsetMinutes: off };

  // 2) Full IANA like Europe/Paris or America/New_York
  const iana = s.match(/\b([a-z]+\/[a-z_]+)\b/i);
  if (iana) return { iana: iana[1] };

  // 3) Abbreviations (ET, PDT, CET, etc.)
  const tokens = s.match(/\b([a-z]{2,4})\b/gi);
  if (tokens) {
    for (const token of tokens) {
      const k = token.toLowerCase();
      if (TZ_MAP[k]) return { iana: TZ_MAP[k] };
    }
  }
  return null;
}

function parseUtcOffset(text: string): number | null {
  const m = text.match(/\b(?:utc|gmt)\s*([+-])\s*(\d{1,2})(?::?(\d{2}))?\b/i);
  if (!m) return null;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = parseInt(m[2], 10);
  const mm = m[3] ? parseInt(m[3], 10) : 0;
  if (hh > 14 || mm > 59) return null; // sanity guard
  return sign * (hh * 60 + mm);
}

// -------------------- Helpers --------------------
function to24(h: number, ap?: string | null): number {
  if (!ap) return h; // assume 24h if no suffix
  const isPM = ap.toLowerCase().startsWith("p");
  return (h % 12) + (isPM ? 12 : 0);
}

// Compute zone offset (in minutes) for an instant in a given IANA zone, using Intl.* (DST-aware).
function getOffsetMinutesForInstant(utcInstant: Date, iana: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: iana,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(utcInstant);
  const nums: Record<string, number> = {};
  for (const p of parts) {
    if (
      p.type === "year" ||
      p.type === "month" ||
      p.type === "day" ||
      p.type === "hour" ||
      p.type === "minute" ||
      p.type === "second"
    ) {
      nums[p.type] = parseInt(p.value, 10);
    }
  }
  const asUTCms = Date.UTC(
    nums.year,
    nums.month - 1,
    nums.day,
    nums.hour,
    nums.minute,
    nums.second || 0
  );
  return (asUTCms - utcInstant.getTime()) / 60000;
}

/**
 * Convert a wall time to the true UTC instant, using:
 *  - IANA zone (DST-aware via Intl) OR
 *  - fixed UTC offset (UTC±HH[:MM]) OR
 *  - local machine time if no zone provided.
 */
export function toInstantFromZone(
  d: DateOnly,
  t?: TimeOnly,
  zone?: { iana?: string; offsetMinutes?: number } | null
): Date {
  // Start from the wall time treated as if it were UTC
  const naiveUtc = Date.UTC(
    d.year,
    d.month - 1,
    d.day,
    t?.hour ?? 0,
    t?.minute ?? 0,
    0,
    0
  );

  if (zone?.iana) {
    // Fixed-point iteration to stabilize around DST boundaries:
    let guess = new Date(naiveUtc);
    let off1 = getOffsetMinutesForInstant(guess, zone.iana);
    let corrected = new Date(naiveUtc - off1 * 60000);
    let off2 = getOffsetMinutesForInstant(corrected, zone.iana);
    if (off2 !== off1) corrected = new Date(naiveUtc - off2 * 60000);
    return corrected; // UTC instant
  }

  if (typeof zone?.offsetMinutes === "number") {
    return new Date(naiveUtc - zone.offsetMinutes * 60000);
  }

  // No zone specified → interpret as local machine time
  return new Date(d.year, d.month - 1, d.day, t?.hour ?? 0, t?.minute ?? 0, 0, 0);
}

// Convenience (explicit local interpretation)
export function toLocalDate(d: DateOnly, t?: TimeOnly): Date {
  return new Date(d.year, d.month - 1, d.day, t?.hour ?? 0, t?.minute ?? 0, 0, 0);
}

// ==================== High-level resolver ====================

export type ResolvedEvent = {
  start: Date;
  end: Date;
  hasTime: boolean;   // true if a clock time was provided (single/range)
  zone?: ParsedZone;  // whatever was detected (if any)
};

/**
 * Parse free text into concrete start/end instants.
 * - If time is present but date is not → defaults to today's date.
 * - If only date (no time) → all-day (start 00:00, end +1 day).
 * - If neither date nor time → returns null.
 */
export function resolveEventFromText(
  text: string,
  now = new Date()
): ResolvedEvent | null {
  const dateOnly = extractDateOnly(text, now);
  const timeOnly = extractTimeOnly(text);
  const zone = extractTimeZoneCode(text);

  // If neither date nor time, nothing to resolve
  if (!dateOnly && timeOnly.type === "none") return null;

  // If no date but we do have a time, default to today:
  const effectiveDate: DateOnly =
    dateOnly || {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };

  // Time provided: single or range
  if (timeOnly.type === "single") {
    const start = toInstantFromZone(effectiveDate, timeOnly.start, zone || undefined);
    const end = new Date(start.getTime() + 60 * 60 * 1000); // default 60 min
    return { start, end, hasTime: true, zone: zone || null };
  }

  if (timeOnly.type === "range") {
    const start = toInstantFromZone(effectiveDate, timeOnly.start, zone || undefined);
    let end = toInstantFromZone(effectiveDate, timeOnly.end, zone || undefined);
    // Overnight (e.g., 10pm–1am)
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    return { start, end, hasTime: true, zone: zone || null };
  }

  // Date but no time → all-day
  if (dateOnly) {
    const startLocal = toLocalDate(effectiveDate, { hour: 0, minute: 0 });
    const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);
    return { start: startLocal, end: endLocal, hasTime: false, zone: zone || null };
  }

  return null;
}

