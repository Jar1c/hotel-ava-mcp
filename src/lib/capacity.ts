/**
 * Guest-facing capacity labels: spell out what the room actually allows and
 * hide zero parts — "2 Adults · 1 Child · Pet Friendly", never "0C".
 * Pets follow the admin form's rule (amenity contains "Pet").
 */

export function roomAllowsPets(room: { amenities?: string[] }): boolean {
  return (room.amenities ?? []).some((a) => a.includes("Pet"))
}

export function formatRoomCapacity(room: {
  max_adults?: number
  max_children?: number
  amenities?: string[]
}): string | null {
  const parts: string[] = []
  const adults = room.max_adults ?? 0
  const children = room.max_children ?? 0
  if (adults > 0) parts.push(`${adults} ${adults === 1 ? "Adult" : "Adults"}`)
  if (children > 0) parts.push(`${children} ${children === 1 ? "Child" : "Children"}`)
  if (roomAllowsPets(room)) parts.push("Pet Friendly")
  return parts.length > 0 ? parts.join(" · ") : null
}
