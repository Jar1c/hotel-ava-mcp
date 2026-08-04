import { useState, useEffect } from "react"
import { Users } from "lucide-react"
import GuestsTable from "@/components/admin/GuestsTable"
import { getGuests } from "@/services/adminService"
import type { Guest } from "@/data/admin"

export default function Guests() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGuests().then((data) => {
      setGuests(data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Guests</h1>
          <p className="text-sm text-muted">Manage guest profiles and stay history.</p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted bg-white border border-[#e2e4e8] rounded-[5px] px-3 py-1.5">
          <Users className="size-4" />
          {guests.length} guests
        </div>
      </div>

      <GuestsTable guests={guests} loading={loading} />
    </div>
  )
}
