import { useState, useEffect, useCallback } from "react"
import BookingsTable from "@/components/admin/BookingsTable"
import { getBookings } from "@/services/adminService"
import { bookingsApi } from "@/services/api"
import type { Booking } from "@/data/admin"
import { usePolling } from "@/hooks/usePolling"

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
    // Initial list comes from usePolling's immediate tick — don't double-fetch here.
    // Auto-complete runs in background; refetch once after it settles to pick up status changes.
    void bookingsApi.autoComplete()
      .catch(() => {})
      .then(() => fetchBookings())
  }, [fetchBookings])

  // Poll every 20 seconds for live updates
  usePolling(
    () => getBookings(),
    (data) => { setBookings(data); setLoading(false) },
    20000,
  )

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
