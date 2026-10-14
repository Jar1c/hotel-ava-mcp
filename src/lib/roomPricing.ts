/** Day-use duration menu — kept in one place for admin form + guest booking. */
export const DAY_USE_DURATIONS = [3, 6, 8, 12] as const

export type DayUseFields = {
  price: number
  day_use_3h?: number | null
  day_use_6h?: number | null
  day_use_8h?: number | null
  day_use_12h?: number | null
}

/** Admin-set rate for this duration, or null when the room relies on auto pro-rata. */
export function dayUseExplicit(room: DayUseFields, hours: number): number | null {
  const v =
    hours === 3 ? room.day_use_3h
    : hours === 6 ? room.day_use_6h
    : hours === 8 ? room.day_use_8h
    : hours === 12 ? room.day_use_12h
    : null
  return v == null || v === ("" as unknown as number) ? null : Number(v)
}

/**
 * Day-use base rate for a duration — mirrors backend `_compute_booking_total`:
 * - No admin price → pro-rate `fallbackRate` (the possibly discounted nightly rate).
 * - Admin price set → that rate is the base; when `fallbackRate` is a discounted
 *   nightly rate, the same ratio (discounted ÷ full) is applied to the day base,
 *   so offers and holiday discounts hit day use exactly like overnight.
 */
export function dayUseRate(room: DayUseFields, hours: number, fallbackRate?: number): number {
  const explicit = dayUseExplicit(room, hours)
  if (explicit == null) {
    return Math.max(1, Math.round((fallbackRate ?? room.price) * (hours / 24)))
  }
  const base = Math.max(1, explicit)
  if (fallbackRate != null && room.price > 0 && fallbackRate !== room.price) {
    return Math.max(1, Math.round(base * (fallbackRate / room.price)))
  }
  return base
}
