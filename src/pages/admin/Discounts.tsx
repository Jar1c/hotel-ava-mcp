import { useState, useEffect } from "react"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import DiscountOffersComponent from "@/components/admin/DiscountOffers"
import type { DiscountRoom } from "@/lib/discountEngine"

export default function Discounts() {
  const [rooms, setRooms] = useState<DiscountRoom[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    publicRoomsApi.getAll()
      .then((data) => {
        setRooms(data.map((r: PublicRoomData) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          price: r.price,
        })))
      })
      .catch(() => setRooms([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-lg font-bold text-[#1a1d26]">Discount Management</h1>
        <p className="text-[12px] text-[#7A7A70] mt-0.5">AI-powered holiday & event discount suggestions</p>
      </div>
      <DiscountOffersComponent offers={[]} rooms={rooms} loading={loading} />
    </div>
  )
}
