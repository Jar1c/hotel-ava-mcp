export type NearbyCategory = "Landmark" | "Shopping" | "Nature" | "Transport" | "Attraction"

export interface NearbyPlace {
  name: string
  category: NearbyCategory
  /** Approximate distance from Hotel Ava, in kilometers. */
  km: number
  /** Local photo in /public/places (Wikimedia Commons, stored in the repo). */
  image: string
}

/**
 * Points of interest around Hotel Ava — 2184 Madre Ignacia St., cor. Quirino Ave.,
 * Malate, Manila. Distances are approximate (rounded), the way hotel sites
 * normally show "top attractions" next to a room. Photos are downloaded from
 * Wikimedia Commons into public/places so they load without an internet
 * connection.
 */
export const nearbyPlaces: NearbyPlace[] = [
  { name: "Manila Baywalk (Roxas Blvd.)", category: "Nature", km: 0.9, image: "/places/baywalk.jpg" },
  { name: "De La Salle University — Manila", category: "Landmark", km: 1.0, image: "/places/dlsu-manila.jpg" },
  { name: "Malate Church — Our Lady of Remedies", category: "Landmark", km: 1.2, image: "/places/malate-church.jpg" },
  { name: "Robinsons Place Manila", category: "Shopping", km: 1.3, image: "/places/robinsons.jpg" },
  { name: "Manila Zoological Garden", category: "Attraction", km: 1.4, image: "/places/manila-zoo.jpg" },
  { name: "Gil Puyat LRT-1 Station", category: "Transport", km: 1.6, image: "/places/gil-puyat.jpg" },
  { name: "Star City", category: "Attraction", km: 2.6, image: "/places/star-city.jpg" },
  { name: "Rizal Park (Luneta)", category: "Landmark", km: 3.2, image: "/places/rizal-park.jpg" },
  { name: "Mall of Asia (MOA)", category: "Shopping", km: 3.5, image: "/places/mall-of-asia.jpg" },
  { name: "National Museum Complex", category: "Landmark", km: 3.8, image: "/places/national-museum.jpg" },
  { name: "Manila Ocean Park", category: "Attraction", km: 4.3, image: "/places/ocean-park.jpg" },
  { name: "Intramuros & Manila Cathedral", category: "Landmark", km: 4.8, image: "/places/intramuros.jpg" },
  { name: "NAIA Terminal 1", category: "Transport", km: 6.5, image: "/places/naia.jpg" },
]

/** "0.9 km · 11 min walk" under 1.5 km, otherwise "3.5 km · 14 min drive". */
export function travelLabel(km: number): string {
  if (km <= 1.5) {
    // ~4.8 km/h walking pace
    const mins = Math.max(3, Math.round((km / 4.8) * 60))
    return `${km.toFixed(1)} km · ${mins} min walk`
  }
  // Manila city traffic ≈ 15 km/h
  const mins = Math.max(5, Math.round((km / 15) * 60))
  return `${km.toFixed(1)} km · ${mins} min drive`
}
