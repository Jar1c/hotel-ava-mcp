import { useMemo, useState } from "react"
import { ChevronDown, PawPrint, RotateCcw, Star, Tag, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DEFAULT_ROOM_FILTERS,
  countActiveFilters,
  type FilterableRoom,
  type RoomFilterState,
} from "@/lib/roomFilters"

type Props = {
  rooms: FilterableRoom[]
  value: RoomFilterState
  onChange: (next: RoomFilterState) => void
}

const PESO = "\u20B1"
const AMENITY_LIMIT = 7

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="typo-caption text-muted mb-sm">{children}</h3>
}

function CheckRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string
  count?: number
  checked: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-ink hover:text-primary">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="size-4 shrink-0 cursor-pointer rounded border-hairline"
        style={{ accentColor: "#82285f" }}
      />
      <span className="truncate">{label}</span>
      {count !== undefined && <span className="ml-auto text-xs text-muted">{count}</span>}
    </label>
  )
}

/**
 * Sidebar filter panel - every option is derived from the rooms the API
 * returned (types, amenities, price ceiling), so nothing is ever shown that
 * the system cannot actually match. Rendered twice: inline on desktop and
 * inside a sheet on mobile.
 */
export default function RoomFilters({ rooms, value, onChange }: Props) {
  const [showAllAmenities, setShowAllAmenities] = useState(false)

  const roomTypes = useMemo(() => {
    const counts = new Map<string, number>()
    rooms.forEach((r) => counts.set(r.type, (counts.get(r.type) ?? 0) + 1))
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [rooms])

  // Amenities that would not narrow anything down (present in every room)
  // are dropped, so the list only contains useful options.
  const amenities = useMemo(() => {
    const counts = new Map<string, number>()
    rooms.forEach((r) => r.amenities.forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1)))
    return Array.from(counts.entries())
      .filter(([, n]) => n < rooms.length)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  }, [rooms])

  const priceCeiling = useMemo(
    () => Math.max(5000, ...rooms.map((r) => r.price)),
    [rooms],
  )

  const active = countActiveFilters(value)
  const toggleIn = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item]

  const visibleAmenities = showAllAmenities ? amenities : amenities.slice(0, AMENITY_LIMIT)

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <h2 className="typo-display-sm text-ink">Filters</h2>
        {active > 0 && (
          <button
            type="button"
            onClick={() => onChange(DEFAULT_ROOM_FILTERS)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear ({active})
          </button>
        )}
      </div>

      {/* ── Room type ─────────────────────────────────────────────── */}
      {roomTypes.length > 1 && (
        <section className="rounded-[12px] border border-hairline bg-white p-base">
          <SectionTitle>Room type</SectionTitle>
          <div>
            {roomTypes.map(([type, count]) => (
              <CheckRow
                key={type}
                label={type}
                count={count}
                checked={value.types.includes(type)}
                onToggle={() => onChange({ ...value, types: toggleIn(value.types, type) })}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Price ─────────────────────────────────────────────────── */}
      <section className="rounded-[12px] border border-hairline bg-white p-base">
        <SectionTitle>Price per night</SectionTitle>
        <div className="mb-sm flex items-baseline justify-between">
          <span className="text-sm font-semibold text-ink">
            {value.priceMax === null ? `Any` : `${PESO}${value.priceMax.toLocaleString()}`}
          </span>
          <span className="text-xs text-muted">
            up to {PESO}
            {priceCeiling.toLocaleString()}
          </span>
        </div>
        <input
          type="range"
          min={500}
          max={priceCeiling}
          step={100}
          value={value.priceMax ?? priceCeiling}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange({ ...value, priceMax: v >= priceCeiling ? null : v })
          }}
          className="w-full cursor-pointer"
          style={{ accentColor: "#82285f" }}
          aria-label="Maximum price per night"
        />
      </section>

      {/* ── Rating ────────────────────────────────────────────────── */}
      <section className="rounded-[12px] border border-hairline bg-white p-base">
        <SectionTitle>Guest rating</SectionTitle>
        {[
          { label: "Any rating", value: 0 },
          { label: "4.0 & up", value: 4 },
          { label: "4.5 & up", value: 4.5 },
        ].map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-ink hover:text-primary">
            <input
              type="radio"
              name="room-min-rating"
              checked={value.minRating === opt.value}
              onChange={() => onChange({ ...value, minRating: opt.value })}
              className="size-4 shrink-0 cursor-pointer"
              style={{ accentColor: "#82285f" }}
            />
            {opt.value > 0 && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
            <span>{opt.label}</span>
          </label>
        ))}
      </section>

      {/* ── Promotions ────────────────────────────────────────────── */}
      <section className="rounded-[12px] border border-hairline bg-white p-base">
        <SectionTitle>Promotions</SectionTitle>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-ink hover:text-primary">
          <input
            type="checkbox"
            checked={value.dealsOnly}
            onChange={(e) => onChange({ ...value, dealsOnly: e.target.checked })}
            className="size-4 shrink-0 cursor-pointer rounded border-hairline"
            style={{ accentColor: "#82285f" }}
          />
          <Tag className="h-4 w-4 text-primary" />
          <span>Rooms with an active promo</span>
        </label>
      </section>

      {/* ── Amenities ─────────────────────────────────────────────── */}
      {amenities.length > 0 && (
        <section className="rounded-[12px] border border-hairline bg-white p-base">
          <SectionTitle>Amenities</SectionTitle>
          <div>
            {visibleAmenities.map((a) => (
              <CheckRow
                key={a.name}
                label={a.name}
                count={a.count}
                checked={value.amenities.includes(a.name)}
                onToggle={() =>
                  onChange({ ...value, amenities: toggleIn(value.amenities, a.name) })
                }
              />
            ))}
          </div>
          {amenities.length > AMENITY_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllAmenities((v) => !v)}
              className="mt-xs flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", showAllAmenities && "rotate-180")}
              />
              {showAllAmenities ? "Show less" : `Show ${amenities.length - AMENITY_LIMIT} more`}
            </button>
          )}
        </section>
      )}

      {/* ── Guest needs ───────────────────────────────────────────── */}
      <section className="rounded-[12px] border border-hairline bg-white p-base">
        <SectionTitle>Guest needs</SectionTitle>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-ink hover:text-primary">
          <input
            type="checkbox"
            checked={value.petFriendly}
            onChange={(e) => onChange({ ...value, petFriendly: e.target.checked })}
            className="size-4 shrink-0 cursor-pointer rounded border-hairline"
            style={{ accentColor: "#82285f" }}
          />
          <PawPrint className="h-4 w-4 text-primary" />
          <span>Pet friendly</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1.5 text-sm text-ink hover:text-primary">
          <input
            type="checkbox"
            checked={value.familyFriendly}
            onChange={(e) => onChange({ ...value, familyFriendly: e.target.checked })}
            className="size-4 shrink-0 cursor-pointer rounded border-hairline"
            style={{ accentColor: "#82285f" }}
          />
          <Users className="h-4 w-4 text-primary" />
          <span>Allows children</span>
        </label>
      </section>
    </div>
  )
}
