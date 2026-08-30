import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router"
import { motion } from "motion/react"
import { Sparkles } from "lucide-react"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import { type Room } from "@/data/rooms"
import { isRoomAvailable, calculateNights } from "@/lib/dates"
import { setCache, getCached } from "@/lib/cache"
import RoomCard from "@/components/rooms/RoomCard"
import SearchFilters, { type FilterState } from "@/components/rooms/SearchFilters"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.15 },
  }),
}

const cardContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

const cardItem = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function getInitialFilters(searchParams: URLSearchParams): FilterState {
  return {
    checkIn: searchParams.get("checkIn") || "",
    checkOut: searchParams.get("checkOut") || "",
    guests: {
      adults: Number(searchParams.get("adults")) || 2,
      children: Number(searchParams.get("children")) || 0,
    },
    stays: searchParams.get("stays") || "24 Hours",
    budget: Number(searchParams.get("budget")) || 0,
    sortBy: "rating"
  }
}

function mapApiRoom(r: PublicRoomData): Room {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    price: r.price,
    capacity: r.capacity,
    amenities: r.amenities,
    images: r.images,
  }
}

function scoreRoom(room: Room, filters: FilterState): number {
  let score = 100

  // Budget scoring: penalty for each peso over budget
  if (filters.budget > 0) {
    if (room.price <= filters.budget) {
      // Under budget = bonus (closer to budget is better)
      score += (filters.budget - room.price) / filters.budget * 10
    } else {
      // Over budget = penalty (but not zero — still a suggestion)
      const overBy = room.price - filters.budget
      score -= (overBy / filters.budget) * 30
    }
  }

  // Guests scoring: penalty for capacity mismatch
  const totalGuests = filters.guests.adults + filters.guests.children
  if (totalGuests > 0) {
    if (room.capacity >= totalGuests) {
      // Exact fit or larger = small bonus
      score += (room.capacity - totalGuests) * 2
    } else {
      // Can't fit = big penalty
      score -= (totalGuests - room.capacity) * 25
    }
  }

  // Availability scoring
  if (filters.checkIn && filters.checkOut) {
    if (isRoomAvailable(room, filters.checkIn, filters.checkOut)) {
      score += 15 // Available = big bonus
    } else {
      score -= 50 // Not available = big penalty
    }
  }

  return Math.max(0, score)
}

function RoomCardSkeleton() {
  return (
    <div className="bg-canvas rounded-lg overflow-hidden flex flex-col h-full animate-pulse">
      <div className="aspect-[16/9] bg-gray-200" />
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="flex gap-1 mt-auto">
          <div className="h-5 bg-gray-200 rounded-full w-16" />
          <div className="h-5 bg-gray-200 rounded-full w-20" />
        </div>
        <div className="h-4 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  )
}

export default function Rooms() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<FilterState>(() => getInitialFilters(searchParams))
  const [roomsData, setRoomsData] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Show cached data instantly
    const cached = getCached<PublicRoomData[]>("public_rooms")
    if (cached) {
      setRoomsData(cached.map(mapApiRoom))
      setLoading(false)
    }

    // 2. Fetch fresh data in background
    publicRoomsApi.getAll()
      .then((data) => {
        setRoomsData(data.map(mapApiRoom))
        setCache("public_rooms", data)
      })
      .catch(() => {
        if (!cached) setRoomsData([])
      })
      .finally(() => setLoading(false))
  }, [])

  // Exact match rooms
  const filteredRooms = useMemo(() => {
    let result = [...roomsData]

    if (filters.guests.adults + filters.guests.children > 0) {
      const totalGuests = filters.guests.adults + filters.guests.children
      result = result.filter((room) => room.capacity >= totalGuests)
    }

    if (filters.budget > 0) {
      result = result.filter((room) => room.price <= filters.budget)
    }

    if (filters.checkIn && filters.checkOut) {
      result = result.filter((room) => isRoomAvailable(room, filters.checkIn, filters.checkOut))
    }

    switch (filters.sortBy) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price)
        break
      case "price-desc":
        result.sort((a, b) => b.price - a.price)
        break
      case "rating":
        result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        break
    }

    return result
  }, [filters, roomsData])

  // AI-like recommendations: relaxed filters
  const recommendations = useMemo(() => {
    // Only show recommendations when no exact match
    if (filteredRooms.length > 0) return []

    let candidates = [...roomsData]

    // Remove rooms that already appear in exact match (shouldn't happen, but safety)
    const exactIds = new Set(filteredRooms.map((r) => r.id))
    candidates = candidates.filter((r) => !exactIds.has(r.id))

    // Score each room based on how close it is to preferences
    const scored = candidates
      .map((room) => ({ room, score: scoreRoom(room, filters) }))
      .filter(({ score }) => score > 20) // Only suggest rooms with decent score
      .sort((a, b) => b.score - a.score)
      .slice(0, 4) // Top 4 suggestions

    return scored.map(({ room }) => room)
  }, [filteredRooms, roomsData, filters])

  return (
    <div className="px-base py-section">
      <div className="max-w-container mx-auto">
        <motion.div
          className="mb-lg"
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <h1 className="typo-display-xl text-ink mb-sm">Rooms & Suites</h1>
          <p className="typo-body-md text-body">
            Discover our selection of rooms and suites at Hotel Ava Malate. Filter by your preferences to find the perfect stay.
          </p>
        </motion.div>

        <motion.div
          custom={1}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] as const }}
          className="mx-auto"
          style={{ maxWidth: "950px" }}
        >
          <SearchFilters initialFilters={filters} onFilterChange={setFilters} />
        </motion.div>

        <div className="mb-md">
          <div className="flex flex-wrap items-center gap-sm">
            <p className="typo-caption-sm text-muted">
              {loading ? "Loading..." : `${filteredRooms.length} ${filteredRooms.length === 1 ? "room" : "rooms"} found`}
            </p>
            {!loading && filters.checkIn && filters.checkOut && (
              <span className="typo-caption-sm text-muted">
                for {calculateNights(filters.checkIn, filters.checkOut)} {calculateNights(filters.checkIn, filters.checkOut) === 1 ? "night" : "nights"}
              </span>
            )}
            {!loading && (filters.guests.adults + filters.guests.children) > 0 && (
              <span className="typo-caption-sm text-muted">
                · {filters.guests.adults + filters.guests.children} {(filters.guests.adults + filters.guests.children) === 1 ? "guest" : "guests"}
              </span>
            )}
            {!loading && filters.budget > 0 && (
              <span className="typo-caption-sm text-muted">
                · up to &#x20B1;{filters.budget.toLocaleString()}
              </span>
            )}
            {!loading && filters.stays && (
              <span className="typo-caption-sm text-muted">
                · {filters.stays}
              </span>
            )}
            {!loading && (filters.guests.adults + filters.guests.children > 0) && (
              <span className="typo-caption-sm text-muted">
                · {filters.guests.adults} {filters.guests.adults === 1 ? "adult" : "adults"}{filters.guests.children > 0 ? `, ${filters.guests.children} ${filters.guests.children === 1 ? "child" : "children"}` : ""}
              </span>
            )}
          </div>
        </div>

        <div className="border-b border-hairline/50 mb-xl" />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
            {Array.from({ length: 8 }).map((_, i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredRooms.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg"
            variants={cardContainer}
            initial="hidden"
            animate="visible"
            key={filteredRooms.length}
          >
            {filteredRooms.map((room, index) => (
              <motion.div key={room.id} variants={cardItem} custom={index}>
                <RoomCard room={room} filters={filters} />
              </motion.div>
            ))}
          </motion.div>
        ) : recommendations.length > 0 ? (
          <>
            {/* AI Suggestion Header */}
            <motion.div
              className="mb-lg p-4 rounded-[12px] border border-hairline bg-white"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 shrink-0" />
                <div>
                  <h3 className="typo-title-md text-ink mb-1">
                    {filters.budget > 0 && (filters.guests.adults + filters.guests.children) > 1
                      ? "No exact match found"
                      : "No rooms found for your criteria"}
                  </h3>
                  <p className="typo-body-sm text-muted">
                    We couldn&apos;t find rooms matching your exact preferences, but here are some options you might like. They&apos;re close to what you&apos;re looking for.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Recommendation Grid */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg"
              variants={cardContainer}
              initial="hidden"
              animate="visible"
            >
              {recommendations.map((room, index) => (
                <motion.div key={room.id} variants={cardItem} custom={index}>
                  <RoomCard room={room} filters={filters} />
                </motion.div>
              ))}
            </motion.div>
          </>
        ) : (
          <motion.div
            className="text-center py-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <p className="typo-body-lg text-muted">No rooms available right now.</p>
            <p className="typo-body-sm text-muted mt-sm">Please check back later.</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
