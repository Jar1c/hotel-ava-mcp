/** Sidebar filter model shared by the Rooms page and the filter panel. */

export type FilterableRoom = {
  id: string
  type: string
  /** Effective nightly price (discount already applied). */
  price: number
  rating: number | null
  amenities: string[]
  allows_children: boolean
  petFriendly: boolean
  hasDeal: boolean
}

export type RoomFilterState = {
  types: string[]
  amenities: string[]
  /** null = any price */
  priceMax: number | null
  minRating: number
  dealsOnly: boolean
  petFriendly: boolean
  familyFriendly: boolean
}

export const DEFAULT_ROOM_FILTERS: RoomFilterState = {
  types: [],
  amenities: [],
  priceMax: null,
  minRating: 0,
  dealsOnly: false,
  petFriendly: false,
  familyFriendly: false,
}

export function countActiveFilters(f: RoomFilterState): number {
  return (
    f.types.length +
    f.amenities.length +
    (f.priceMax === null ? 0 : 1) +
    (f.minRating > 0 ? 1 : 0) +
    (f.dealsOnly ? 1 : 0) +
    (f.petFriendly ? 1 : 0) +
    (f.familyFriendly ? 1 : 0)
  )
}

export function roomMatchesFilter(room: FilterableRoom, f: RoomFilterState): boolean {
  if (f.types.length > 0 && !f.types.includes(room.type)) return false
  if (f.priceMax !== null && room.price > f.priceMax) return false
  if (f.minRating > 0 && (room.rating ?? 0) < f.minRating) return false
  if (f.dealsOnly && !room.hasDeal) return false
  if (f.petFriendly && !room.petFriendly) return false
  if (f.familyFriendly && !room.allows_children) return false
  // Every picked amenity must be present (AND, not OR)
  if (f.amenities.length > 0 && !f.amenities.every((a) => room.amenities.includes(a))) return false
  return true
}
