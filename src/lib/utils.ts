import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Booking calendar cap — guests can reserve at most 6 months ahead.
// Matches the server-side gate in create_booking (backend/app.py).
export function maxBookingDate(): Date {
  const d = new Date()
  d.setMonth(d.getMonth() + 6)
  return d
}
