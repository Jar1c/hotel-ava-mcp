import { useState, useEffect, useCallback } from "react"
import { QrCode } from "lucide-react"
import BookingsTable from "@/components/admin/BookingsTable"
import VerifyQrDialog from "@/components/admin/VerifyQrDialog"
import { Button } from "@/components/ui/button"
import { getBookings } from "@/services/adminService"
import { bookingsApi, ApiError } from "@/services/api"
import type { Booking } from "@/data/admin"
import { usePolling } from "@/hooks/usePolling"
import { useNotifications } from "@/contexts/NotificationContext"

export default function Bookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const { unreadBookingCount, markBookingNotificationsRead } = useNotifications()

  const fetchBookings = useCallback((force = false) => {
    setLoading(true)
    setError(null)
    setExpired(false)
    getBookings({ force })
      .then((data) => {
        setBookings(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        // Never fall back to demo rows — say what actually went wrong.
        const isExpired = err instanceof ApiError && err.status === 401
        setExpired(isExpired)
        setError(
          isExpired
            ? "Your session has expired."
            : err instanceof Error && err.message
              ? err.message
              : "Please try again.",
        )
        setLoading(false)
      })
  }, [])

  // A status change must bypass the 60s SWR cache — otherwise the table
  // immediately re-renders the pre-action rows and the change looks ignored.
  const refetchAfterChange = useCallback(() => {
    fetchBookings(true)
  }, [fetchBookings])

  useEffect(() => {
    // Initial list comes from usePolling's immediate tick — don't double-fetch here.
    // Auto-complete runs in background; refetch once after it settles to pick up status changes.
    void bookingsApi.autoComplete()
      .catch(() => {})
      .then(() => fetchBookings())
  }, [fetchBookings])

  // You're looking at the bookings list, so the red "new bookings" badge on the
  // sidebar is already seen — clear it instead of leaving a mystery count.
  useEffect(() => {
    if (unreadBookingCount > 0) void markBookingNotificationsRead()
  }, [unreadBookingCount, markBookingNotificationsRead])

  // Poll every 20 seconds for live updates
  usePolling(
    () => getBookings(),
    (data) => {
      setBookings(data)
      setLoading(false)
      // A successful poll means the API is back — clear any error banner.
      setError(null)
      setExpired(false)
    },
    20000,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Bookings</h1>
          <p className="text-sm text-muted">Manage all guest reservations.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setVerifyOpen(true)}
          className="!rounded-[8px] gap-2"
        >
          <QrCode className="h-4 w-4" />
          Verify QR
        </Button>
      </div>

      {error && !loading ? (
        <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-rose-800">Couldn't load bookings</p>
          <p className="mt-1 text-sm text-rose-700">{error}</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fetchBookings(true)}
              className="!rounded-[8px]"
            >
              Try again
            </Button>
            {expired && (
              <Button
                type="button"
                onClick={() => window.location.assign("/login")}
                className="!rounded-[8px]"
              >
                Sign in again
              </Button>
            )}
          </div>
        </div>
      ) : (
        <BookingsTable bookings={bookings} loading={loading} onStatusChange={refetchAfterChange} />
      )}

      <VerifyQrDialog open={verifyOpen} onOpenChange={setVerifyOpen} />
    </div>
  )
}
