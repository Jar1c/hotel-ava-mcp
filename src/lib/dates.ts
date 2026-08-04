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

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}