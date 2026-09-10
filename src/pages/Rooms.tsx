import { useState, useEffect } from "react"
import { useSearchParams } from "react-router"
import { motion } from "motion/react"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import { type Room } from "@/data/rooms"
import { setCache, getCached } from "@/lib/cache"
import RoomCard from "@/components/rooms/RoomCard"

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

function mapApiRoom(r: PublicRoomData): Room {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    price: r.price,
    capacity: r.capacity,
    max_adults: r.max_adults,
    max_children: r.max_children,
    allows_children: r.allows_children,
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
  const [roomsData, setRoomsData] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({})

  const filters = {
    stayType: searchParams.get("stayType") || undefined,
    checkIn: searchParams.get("checkIn") || undefined,
    checkOut: searchParams.get("checkOut") || undefined,
    startTime: searchParams.get("startTime") || undefined,
    duration: searchParams.get("duration") || undefined,
    adults: Number(searchParams.get("adults")) || undefined,
    children: Number(searchParams.get("children")) || undefined,
  }

  const hasDateFilter = filters.checkIn && (
    filters.stayType === "overnight" ? filters.checkOut : filters.startTime
  )

  useEffect(() => {
    const cached = getCached<PublicRoomData[]>("public_rooms")
    if (cached) {
      setRoomsData(cached.map(mapApiRoom))
      setLoading(false)
    }

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

  // Check availability for all rooms when date filters are present
  useEffect(() => {
    if (!hasDateFilter || roomsData.length === 0) {
      setAvailabilityMap({})
      return
    }

    const checkAll = async () => {
      const results: Record<string, boolean> = {}
      await Promise.all(
        roomsData.map(async (room) => {
          try {
            const res = await publicRoomsApi.checkAvailability({
              room_id: room.id,
              check_in: new Date(filters.checkIn!).toISOString().split("T")[0],
              check_out: filters.stayType === "overnight" && filters.checkOut
                ? new Date(filters.checkOut).toISOString().split("T")[0]
                : undefined,
              stay_type: filters.stayType || "overnight",
              start_time: filters.stayType === "day" ? filters.startTime : undefined,
              duration: filters.stayType === "day" && filters.duration ? Number(filters.duration) : undefined,
            })
            results[room.id] = res.available
          } catch {
            results[room.id] = true // Show room if check fails
          }
        })
      )
      setAvailabilityMap(results)
    }

    checkAll()
  }, [roomsData, hasDateFilter, filters.checkIn, filters.checkOut, filters.stayType, filters.startTime, filters.duration])

  // Filter rooms by availability
  const filteredRooms = hasDateFilter
    ? roomsData.filter((room) => availabilityMap[room.id] !== false)
    : roomsData

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
            Discover our selection of rooms and suites at Hotel Ava Malate.
          </p>
        </motion.div>

        <div className="mb-md">
          <p className="typo-caption-sm text-muted">
            {loading ? "Loading..." : hasDateFilter
              ? `${filteredRooms.length} ${filteredRooms.length === 1 ? "room" : "rooms"} available for selected dates`
              : `${roomsData.length} ${roomsData.length === 1 ? "room" : "rooms"} available`}
          </p>
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
        ) : (
          <motion.div
            className="text-center py-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }}
          >
            <p className="typo-body-lg text-muted">
              {hasDateFilter ? "No rooms available for the selected dates." : "No rooms available right now."}
            </p>
            <p className="typo-body-sm text-muted mt-sm">Please check back later or try different dates.</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
