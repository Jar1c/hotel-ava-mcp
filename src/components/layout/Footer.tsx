import { useEffect, useState } from "react"
import { Link } from "react-router"
import { footerLinkGroups } from "@/data/navigation"
import { devTeam } from "@/data/devTeam"
import { rooms as fallbackRooms } from "@/data/rooms"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import { getCached, setCache } from "@/lib/cache"
import { MapPin, Phone, Globe } from "lucide-react"

interface AccommodationLink {
  label: string
  path: string
}

/** Footer label for a room type — reads naturally in prose. */
function typeLabel(type: string): string {
  if (type === "Standard") return "Standard Room"
  if (type === "Deluxe") return "Deluxe Room"
  return type
}

/** Preferred display order for known room types; unknown ones follow. */
const TYPE_ORDER = ["Standard", "Deluxe", "Executive Deluxe", "Junior Suite", "Superior Suite"]

/**
 * One link per room type pointing at the first room (by name) of that type,
 * e.g. "Standard Room" → /rooms/<uuid of Standard Room 101>. Built from the
 * live /api/rooms/public payload so the footer never links to dead pages.
 */
function buildAccommodationLinks(list: Pick<PublicRoomData, "id" | "name" | "type">[]): AccommodationLink[] {
  const firstOfEachType = new Map<string, { id: string; name: string }>()
  for (const room of [...list].sort((a, b) => a.name.localeCompare(b.name))) {
    if (!firstOfEachType.has(room.type)) firstOfEachType.set(room.type, { id: room.id, name: room.name })
  }
  return [...firstOfEachType.entries()]
    .sort(([typeA, roomA], [typeB, roomB]) => {
      const rankA = TYPE_ORDER.indexOf(typeA)
      const rankB = TYPE_ORDER.indexOf(typeB)
      return (
        (rankA === -1 ? TYPE_ORDER.length : rankA) - (rankB === -1 ? TYPE_ORDER.length : rankB) ||
        roomA.name.localeCompare(roomB.name)
      )
    })
    .map(([type, room]) => ({ label: typeLabel(type), path: `/rooms/${room.id}` }))
}

/** Offline fallback: the mock rooms — RoomDetail resolves these too. */
const fallbackAccommodation: AccommodationLink[] = fallbackRooms.map((room) => ({
  label: room.name,
  path: `/rooms/${room.id}`,
}))

export default function Footer() {
  // Cached live links render instantly; the fetch below refreshes them.
  const [accommodation, setAccommodation] = useState<AccommodationLink[]>(
    () => getCached<AccommodationLink[]>("footer:accommodation") ?? fallbackAccommodation,
  )

  useEffect(() => {
    let cancelled = false
    publicRoomsApi
      .getAll()
      .then((data) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return
        const links = buildAccommodationLinks(data)
        setAccommodation(links)
        setCache("footer:accommodation", links)
      })
      .catch(() => {
        /* backend offline — keep whatever links we already have */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <footer className="border-t border-hairline bg-canvas mt-xxl">
      {/* Link columns section */}
      <div className="max-w-container mx-auto w-full px-base py-section">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-lg">
          {/* Brand column */}
          <div>
            <h4 className="font-display text-ink text-lg font-semibold mb-md">Hotel Ava Malate</h4>
            <div className="space-y-sm mb-md">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-secondary mt-0.5 shrink-0" />
                <span className="typo-body-sm text-muted">2184 Madre Ignacia Street, corner Quirino Ave, Malate, Manila</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-secondary shrink-0" />
                <span className="typo-body-sm text-muted">(02) 5310-1731 to 32</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-secondary shrink-0" />
                <span className="typo-body-sm text-muted">+63 926 006 8565</span>
              </div>
            </div>
            <div className="flex items-center gap-sm">
              <a href="https://facebook.com/hotelavaph" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-surface-soft flex items-center justify-center text-muted hover:bg-primary hover:text-on-primary transition-colors" aria-label="Facebook">
                <Globe className="h-4 w-4" />
              </a>
              <a href="https://instagram.com/hotelavaph" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-surface-soft flex items-center justify-center text-muted hover:bg-primary hover:text-on-primary transition-colors" aria-label="Instagram">
                <Globe className="h-4 w-4" />
              </a>
              <a href="https://twitter.com/hotelavaph" target="_blank" rel="noopener noreferrer" className="w-11 h-11 rounded-full bg-surface-soft flex items-center justify-center text-muted hover:bg-primary hover:text-on-primary transition-colors" aria-label="Twitter">
                <Globe className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Accommodation — live room categories from the public API */}
          <div>
            <h4 className="typo-title-sm text-ink mb-md">Accommodation</h4>
            <ul className="space-y-sm">
              {accommodation.map((link) => (
                <li key={link.path}>
                  <Link to={link.path} className="typo-body-sm text-muted hover:text-ink transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {footerLinkGroups.map((group) => (
            <div key={group.title}>
              <h4 className="typo-title-sm text-ink mb-md">{group.title}</h4>
              <ul className="space-y-sm">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.path} className="typo-body-sm text-muted hover:text-ink transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Legal band */}
      <div className="border-t border-hairline-soft">
        <div className="max-w-container mx-auto w-full px-base py-lg flex flex-col sm:flex-row items-center justify-between gap-sm">
          <div className="text-center sm:text-left">
            <p className="typo-caption-sm text-muted-soft">
              &copy; {new Date().getFullYear()} Hotel Ava. All rights reserved.
            </p>
            <p className="typo-caption-sm text-muted-soft/80 mt-0.5">
              Developed by Capstone Development Team &mdash;{" "}
              {devTeam.map((member, index) => (
                <span key={member.name}>
                  {member.name}
                  {index < devTeam.length - 1 ? " \u00B7 " : ""}
                </span>
              ))}
            </p>
          </div>
          <div className="flex items-center gap-md">
            <Link to="/privacy" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">Privacy</Link>
            <Link to="/terms" className="typo-caption-sm text-muted-soft hover:text-ink transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}