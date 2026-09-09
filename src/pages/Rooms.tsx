import { useState, useEffect } from "react"
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
  const [roomsData, setRoomsData] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)

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
            {loading ? "Loading..." : `${roomsData.length} ${roomsData.length === 1 ? "room" : "rooms"} available`}
          </p>
        </div>

        <div className="border-b border-hairline/50 mb-xl" />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
            {Array.from({ length: 8 }).map((_, i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        ) : roomsData.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg"
            variants={cardContainer}
            initial="hidden"
            animate="visible"
            key={roomsData.length}
          >
            {roomsData.map((room, index) => (
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
