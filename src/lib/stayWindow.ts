/**
 * Guest-facing stay window shown before booking.
 *
 * Overnight stays run for 24 hours: check-out falls on the same clock time on
 * the check-out date. The summary used to echo the start time with no date
 * ("10:00 PM - 10:00 PM"), which testers read as a bug, so both ends are now
 * dated.
 */

const shortDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

export type OvernightWindow = { checkIn: string; checkOut: string }

/** null until both dates and the check-in time are chosen. */
export function overnightWindow(
  checkIn: Date | null | undefined,
  checkOut: Date | null | undefined,
  startTime: string,
): OvernightWindow | null {
  if (!checkIn || !checkOut || !startTime) return null
  return {
    checkIn: `${shortDay(checkIn)}, ${startTime}`,
    checkOut: `${shortDay(checkOut)}, ${startTime}`,
  }
}

/** 'Sep 30, 8:00 PM - 11:00 PM' - a day-use window always starts and ends on the same date. */
export function dayUseWindow(
  checkIn: Date | null | undefined,
  startTime: string,
  endTime: string,
): string | null {
  if (!checkIn || !startTime || !endTime) return null
  return `${shortDay(checkIn)}, ${startTime} - ${endTime}`
}
