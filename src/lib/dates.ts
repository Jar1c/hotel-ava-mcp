import type { Room } from "@/data/rooms"

export function isRoomAvailable(
  room: Room,
  checkIn: string,
  checkOut: string
): boolean {
  if (!checkIn || !checkOut || !room.bookedDates) {
    return true
  }

  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)

  for (const bookedDate of room.bookedDates) {
    const booked = new Date(bookedDate)
    if (booked >= checkInDate && booked < checkOutDate) {
      return false
    }
  }
  return true
}

export function calculateNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const start = new Date(checkIn)
  const end = new Date(checkOut)
  const diff = end.getTime() - start.getTime()
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export function generateMockBookedDates(): string[] {
  const dates: string[] = []
  const today = new Date()
  
  for (let i = 0; i < 5 + Math.floor(Math.random() * 6); i++) {
    const offset = 3 + Math.floor(Math.random() * 25)
    const date = new Date(today)
    date.setDate(today.getDate() + offset)
    dates.push(formatDate(date))
  }
  
  return dates.sort()
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const dt = new Date(y, (m || 1) - 1, (d || 1) + days)
  return formatDate(dt)
}

// Extract the LOCAL calendar date (YYYY-MM-DD) from a Date.
// Never use toISOString().split("T")[0] for this: a Date at local midnight
// (e.g. from react-datepicker) maps to the PREVIOUS day in UTC (UTC+8).
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

// Parse a date URL param. Date-only strings ("2026-09-26") are parsed as
// LOCAL midnight so the intended calendar date survives in any timezone;
// full ISO strings round-trip as instants.
export function parseDateParam(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(v)
}