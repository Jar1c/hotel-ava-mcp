import { useState, useMemo } from "react"
import { rooms } from "@/data/rooms"
import RoomCard from "@/components/rooms/RoomCard"
import SearchFilters, { type FilterState } from "@/components/rooms/SearchFilters"

export default function Rooms() {
  const [filters, setFilters] = useState<FilterState>({
    checkIn: "",
    checkOut: "",
    guests: 1,
    priceRange: [0, 1000],
    sortBy: "rating"
  })

  const filteredRooms = useMemo(() => {
    let result = [...rooms]

    if (filters.guests > 0) {
      result = result.filter((room) => room.capacity >= filters.guests)
    }

    result = result.filter(
      (room) => room.price >= filters.priceRange[0] && room.price <= filters.priceRange[1]
    )

    switch (filters.sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price)
        break
      case "price-desc":
        result.sort((a, b) => b.price - a.price)
        break
      case "rating":
        result.sort((a, b) => b.rating - a.rating)
        break
    }

    return result
  }, [filters])

  return (
    <div className="px-base py-section">
      <div className="max-w-container mx-auto">
        <div className="mb-lg">
          <h1 className="typo-display-xl text-ink mb-sm">Our Rooms</h1>
          <p className="typo-body-md text-body">
            Discover our selection of premium rooms and suites. Filter by your preferences to find the perfect stay.
          </p>
        </div>

        <SearchFilters onFilterChange={setFilters} />

        <div className="mb-md">
          <p className="typo-caption-sm text-muted">
            {filteredRooms.length} {filteredRooms.length === 1 ? "room" : "rooms"} found
          </p>
        </div>

        {filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-lg">
            {filteredRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        ) : (
          <div className="text-center py-section">
            <p className="typo-body-lg text-muted">No rooms match your filters.</p>
            <p className="typo-body-sm text-muted mt-sm">Try adjusting your search criteria.</p>
          </div>
        )}
      </div>
    </div>
  )
}
