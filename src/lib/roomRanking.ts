import { getRoomDiscount, type DiscountRoom } from "@/lib/discountEngine"

export interface RankableRoom {
  id: string
  price: number
  capacity: number
  rating?: number
  reviews?: number
}

export interface RankContext {
  /** Adults + children from the guest's search (0 = not specified) */
  guests?: number
  /** Budget ceiling the guest picked — 99999 means "any" */
  budgetMax?: number
  discountRooms: DiscountRoom[]
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * Fit score (0–1): can it hold the party, and is it wastefully large?
 * Rooms too small for the party score 0 — they still show up in the full
 * list, they just never become an AI pick.
 */
function partyFit(capacity: number, guests: number): number {
  if (guests <= 0) return 0.7 // no party given → neutral
  if (capacity < guests) return 0
  return clamp01(1 - (capacity - guests) / 5)
}

/**
 * How good is this room for THIS guest, on a 0–100 scale.
 *
 * Weights: party fit 40%, guest rating 35% (scaled up by how many reviews
 * back it), value against budget 25% (discounted prices count).
 */
export function scoreRoom(room: RankableRoom, ctx: RankContext): number {
  const guests = ctx.guests ?? 0
  const budgetMax = ctx.budgetMax ?? 99999

  const discount = getRoomDiscount(ctx.discountRooms, room.id)
  const effectivePrice = discount ? discount.discountedPrice : room.price

  const value = budgetMax >= 99999 ? 0.7 : clamp01(1 - effectivePrice / budgetMax)

  const rating =
    room.rating != null && room.rating > 0
      ? (room.rating / 5) * (0.7 + 0.3 * clamp01((room.reviews ?? 0) / 20))
      : 0.6 // unrated rooms sit in the middle instead of at the bottom

  const score = 0.4 * partyFit(room.capacity, guests) + 0.35 * rating + 0.25 * value
  return Math.round(score * 100)
}

/** Rooms sorted best-match first (stable, so equal scores keep list order). */
export function rankRooms<T extends RankableRoom>(rooms: T[], ctx: RankContext): T[] {
  return [...rooms].sort((a, b) => scoreRoom(b, ctx) - scoreRoom(a, ctx))
}
