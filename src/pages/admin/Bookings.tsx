import { useState, useEffect, useCallback } from "react"
import BookingsTable from "@/components/admin/BookingsTable"
import { getBookings } from "@/services/adminService"
import { bookingsApi } from "@/services/api"
import type { Booking } from "@/data/admin"

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const fetchBookings = useCallback(() => {
    setLoading(true)
    getBookings().then((data) => {
      setBookings(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    // Auto-complete expired bookings first, then fetch
    bookingsApi.autoComplete().catch(() => {}).finally(() => {
      fetchBookings()
    })
  }, [fetchBookings])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Bookings</h1>
        <p className="text-sm text-muted">Manage all guest reservations.</p>
      </div>

      <BookingsTable bookings={bookings} loading={loading} onStatusChange={fetchBookings} />
    </div>
  )
}
