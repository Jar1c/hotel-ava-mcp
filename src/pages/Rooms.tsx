import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "react-router"
import { motion } from "motion/react"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import { type Room } from "@/data/rooms"
import { isRoomAvailable, calculateNights } from "@/lib/dates"
import { setCache } from "@/lib/cache"
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
    guests: Number(searchParams.get("guests")) || 1,
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
    publicRoomsApi.getAll()
      .then((data) => {
        setRoomsData(data.map(mapApiRoom))
        setCache("public_rooms", data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredRooms = useMemo(() => {
    let result = [...roomsData]

    if (filters.guests > 0) {
      result = result.filter((room) => room.capacity >= filters.guests)
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
          style={{ maxWidth: "800px" }}
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
            {!loading && filters.guests > 0 && (
              <span className="typo-caption-sm text-muted">
                · {filters.guests} {filters.guests === 1 ? "guest" : "guests"}
              </span>
            )}
            {!loading && filters.budget > 0 && (
              <span className="typo-caption-sm text-muted">
                · up to &#x20B1;{filters.budget.toLocaleString()}
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
                <RoomCard room={room} />
              </motion.div>
            ))}
          </motion.div>
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
