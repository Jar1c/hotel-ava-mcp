/**
 * Front-desk check-in / "In-house" state.
 *
 * checked_in_at is the only thing we ever store — whether the stay is actually
 * RUNNING is derived from the clock, so a guest who scans at 9:50 AM for a
 * 10:00 AM booking sits at "early" and flips to "in_house" on its own once the
 * booked time passes. Nothing is scheduled; the next render does the work.
 *
 * deriveArrival() mirrors arrival_state() in backend/app.py exactly. Keep the
 * two in sync — the server value is the source of truth on every fetch, and
 * this one exists so the badge can flip while a dialog stays open.
 */

export type ArrivalState = "none" | "early" | "in_house" | "ended"

/**
 * Overnight stays store a date, not a clock, so they need a house time.
 * Must match DEFAULT_CHECK_IN_TIME in backend/app.py.
 */
export const DEFAULT_CHECK_IN_TIME = "2:00 PM"

const DAY_MS = 86_400_000

export interface ArrivalBooking {
  status?: string | null
  stay_type?: string | null
  check_in?: string | null
  check_out?: string | null
  start_time?: string | null
  duration?: number | string | null
  checked_in_at?: string | null
}

function isDayStay(b: ArrivalBooking) {
  return (b.stay_type || "overnight").trim() === "day"
}

/** '10:00 AM' / '14:00' -> minutes past midnight. */
function parseClock(text?: string | null, fallback = 0): number {
  if (!text) return fallback
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(text))
  if (!m) return fallback
  let hours = Number(m[1])
  const minutes = Number(m[2])
  const period = (m[3] || "").toUpperCase()
  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0
  if (hours > 23 || minutes > 59) return fallback
  return hours * 60 + minutes
}

/** '2026-10-05' or an ISO timestamp -> a timezone-free day number. */
function toDayNumber(value?: string | null): number | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value))
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** The viewer's calendar day as the same timezone-free day number. */
function todayNumber(now: Date) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
}

function startMoment(b: ArrivalBooking) {
  const day = toDayNumber(b.check_in)
  if (day === null) return null
  // Overnight starts at the check-in time the guest picked (2:00 PM default).
  const fallback = isDayStay(b) ? 0 : parseClock(DEFAULT_CHECK_IN_TIME, 14 * 60)
  return { day, minutes: parseClock(b.start_time, fallback) }
}

function endMoment(b: ArrivalBooking) {
  if (isDayStay(b)) {
    if (!b.start_time || !b.duration) return null
    const day = toDayNumber(b.check_in)
    if (day === null) return null
    return { day, minutes: parseClock(b.start_time) + Math.max(0, Number(b.duration) || 0) * 60 }
  }
  const out = toDayNumber(b.check_out)
  // Overnight stays end at midnight of the day AFTER check-out — same rule the
  // backend's auto-complete uses.
  return out === null ? null : { day: out + DAY_MS, minutes: 0 }
}

export function deriveArrival(b: ArrivalBooking, now: Date = new Date()): ArrivalState {
  if (b.status === "cancelled" || b.status === "completed" || b.status === "checked-out") {
    return "ended"
  }

  const today = todayNumber(now)
  const minutesNow = now.getHours() * 60 + now.getMinutes()

  const end = endMoment(b)
  if (end && (today > end.day || (today === end.day && minutesNow >= end.minutes))) return "ended"
  if (!b.checked_in_at) return "none"

  const start = startMoment(b)
  if (!start) return "in_house"
  if (today < start.day) return "early"
  if (today === start.day && minutesNow < start.minutes) return "early"
  return "in_house"
}

function clockLabel(minutes: number) {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60) % 24
  const mins = total % 60
  const period = hours < 12 ? "AM" : "PM"
  const display = hours % 12 || 12
  return `${display}:${String(mins).padStart(2, "0")} ${period}`
}

/** 'Oct 5, 2:00 PM' — when the stay starts running. */
export function startMomentLabel(b: ArrivalBooking): string {
  const start = startMoment(b)
  if (!start) return ""
  const day = new Date(start.day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
  return `${day}, ${clockLabel(start.minutes)}`
}

/** '9:50 AM' — when the front desk actually stamped the arrival. */
export function arrivalTimeLabel(checkedInAt?: string | null): string {
  if (!checkedInAt) return ""
  const d = new Date(checkedInAt)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

/**
 * 'Oct 1, 2026 · 10:00 PM' (overnight) or 'Sep 30, 2026 · 5:00 PM' (day use) —
 * when the guest has to be out of the room.
 *
 * Overnight runs 24 hours from the check-in time, so check-out is the same
 * clock time on the check-out date. endMoment() is midnight AFTER the check-out
 * date, but that is only the grace window the backend uses to auto-complete the
 * booking — not what the guest is told.
 */
export function checkoutMomentLabel(b: ArrivalBooking): string {
  const day = (n: number) =>
    new Date(n).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })

  if (isDayStay(b)) {
    const end = endMoment(b)
    if (!end) return ""
    return `${day(end.day)} · ${clockLabel(end.minutes)}`
  }

  const out = toDayNumber(b.check_out)
  const start = startMoment(b)
  if (out === null || !start) return ""
  return `${day(out)} · ${clockLabel(start.minutes)}`
}

/** Minutes until the stay starts running. 0 once it has; negative if it passed. */
export function minutesUntilStart(b: ArrivalBooking, now: Date = new Date()): number | null {
  const start = startMoment(b)
  if (!start) return null
  const days = Math.round((start.day - todayNumber(now)) / DAY_MS)
  return days * 1440 + (start.minutes - (now.getHours() * 60 + now.getMinutes()))
}

/** True once the guest has been stamped as arrived (early or in-house). */
export function hasArrived(b: ArrivalBooking) {
  return Boolean(b.checked_in_at)
}

/**
 * Front desk may stamp an arrival only for a confirmed booking on/after its
 * check-in date that hasn't been stamped yet. Mirrors the guards in
 * POST /api/bookings/<id>/check-in.
 */
export function canCheckIn(b: ArrivalBooking, now: Date = new Date()): boolean {
  if (b.status !== "confirmed") return false
  if (deriveArrival(b, now) !== "none") return false
  const day = toDayNumber(b.check_in)
  return day !== null && todayNumber(now) >= day
}

/**
 * The guest may still cancel: booked, and not yet at the hotel.
 * Mirrors cancel_booking in backend/app.py.
 */
export function canCancel(b: ArrivalBooking, now: Date = new Date()): boolean {
  if (b.status !== "pending" && b.status !== "confirmed") return false
  const state = deriveArrival(b, now)
  return state !== "early" && state !== "in_house"
}
