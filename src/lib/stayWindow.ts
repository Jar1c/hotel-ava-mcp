/**
 * Guest-facing stay window shown before booking.
 *
 * Overnight stays follow the standard hotel clock: check-in 2:00 PM,
 * check-out 12:00 PM (noon) the next day — like every other booking site.
 * Both ends are dated so a summary never reads "10:00 PM - 12:00 PM"
 * with no day attached.
 */

const shortDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

/** Fixed overnight check-in clock (no picker — house policy). */
export const OVERNIGHT_CHECK_IN = "2:00 PM"
/** Fixed overnight check-out clock — noon. */
export const OVERNIGHT_CHECK_OUT = "12:00 PM"

export type OvernightWindow = { checkIn: string; checkOut: string }

/** null until both dates are chosen. */
export function overnightWindow(
  checkIn: Date | null | undefined,
  checkOut: Date | null | undefined,
): OvernightWindow | null {
  if (!checkIn || !checkOut) return null
  return {
    checkIn: `${shortDay(checkIn)}, ${OVERNIGHT_CHECK_IN}`,
    checkOut: `${shortDay(checkOut)}, ${OVERNIGHT_CHECK_OUT}`,
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
