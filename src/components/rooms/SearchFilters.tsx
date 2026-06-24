import { useState } from "react"
import { Calendar, Users, DollarSign, ChevronDown } from "lucide-react"

interface SearchFiltersProps {
  onFilterChange: (filters: FilterState) => void
}

export interface FilterState {
  checkIn: string
  checkOut: string
  guests: number
  priceRange: [number, number]
  sortBy: "price-asc" | "price-desc" | "rating"
}

export default function SearchFilters({ onFilterChange }: SearchFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    checkIn: "",
    checkOut: "",
    guests: 1,
    priceRange: [0, 1000],
    sortBy: "rating"
  })

  const updateFilter = (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  return (
    <div className="bg-canvas border border-hairline rounded-lg p-lg mb-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-md">
        <div>
          <label className="typo-caption text-muted block mb-xs">Check-in</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="date"
              value={filters.checkIn}
              onChange={(e) => updateFilter("checkIn", e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="typo-caption text-muted block mb-xs">Check-out</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="date"
              value={filters.checkOut}
              onChange={(e) => updateFilter("checkOut", e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        <div>
          <label className="typo-caption text-muted block mb-xs">Guests</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <select
              value={filters.guests}
              onChange={(e) => updateFilter("guests", Number(e.target.value))}
              className="w-full pl-10 pr-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "Guest" : "Guests"}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          </div>
        </div>

        <div>
          <label className="typo-caption text-muted block mb-xs">
            Max Price: ${filters.priceRange[1]}
          </label>
          <div className="relative pt-2">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="range"
              min={0}
              max={1000}
              step={50}
              value={filters.priceRange[1]}
              onChange={(e) => updateFilter("priceRange", [0, Number(e.target.value)])}
              className="w-full accent-primary"
            />
          </div>
        </div>

        <div>
          <label className="typo-caption text-muted block mb-xs">Sort By</label>
          <div className="relative">
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilter("sortBy", e.target.value as FilterState["sortBy"])}
              className="w-full px-3 py-2 rounded-sm border border-hairline bg-canvas typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none"
            >
              <option value="rating">Rating</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  )
}
