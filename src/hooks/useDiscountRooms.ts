import { useState, useEffect } from "react"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import type { DiscountRoom } from "@/lib/discountEngine"
import { getCached, setCache } from "@/lib/cache"

function mapToDiscountRoom(r: PublicRoomData): DiscountRoom {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    price: r.price,
  }
}

export function useDiscountRooms() {
  const [rooms, setRooms] = useState<DiscountRoom[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const cached = getCached<PublicRoomData[]>("public_rooms")
    if (cached) {
      setRooms(cached.map(mapToDiscountRoom))
      setLoading(false)
    }

    publicRoomsApi
      .getAll()
      .then((data) => {
        setRooms(data.map(mapToDiscountRoom))
        setCache("public_rooms", data)
      })
      .catch(() => {
        if (!cached) setRooms([])
      })
      .finally(() => setLoading(false))
  }, [])

  return { rooms, loading }
}
