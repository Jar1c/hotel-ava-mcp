/**
 * Guest-facing stay window shown before booking.
 *
 * The backend's conflict window runs to the same clock time on the check-out
 * date, which made the summary read "10:00 PM - 10:00 PM". Guests are told the
 * hotel's published 12:00 NN check-out everywhere else (receipts, My Bookings),
 * so the pre-booking summary shows the same thing - with the dates attached.
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
    checkOut: `${shortDay(checkOut)}, 12:00 NN`,
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
