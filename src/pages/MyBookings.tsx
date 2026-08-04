import { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { CalendarDays, Users, Clock, X, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { userBookingsApi, type UserBookingData } from "@/services/api"

const statusConfig: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: "Awaiting Payment", dot: "bg-amber-500", text: "text-amber-600" },
  confirmed: { label: "Confirmed", dot: "bg-emerald-500", text: "text-emerald-600" },
  completed: { label: "Completed", dot: "bg-gray-400", text: "text-muted" },
  cancelled: { label: "Cancelled", dot: "bg-gray-300", text: "text-muted" },
}

function formatDateRange(checkIn: string, checkOut: string) {
  const ci = new Date(checkIn)
  const co = new Date(checkOut)
  const sameMonth = ci.getMonth() === co.getMonth() && ci.getFullYear() === co.getFullYear()
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  if (sameMonth) {
    return `${ci.toLocaleDateString("en-US", opts)} – ${co.toLocaleDateString("en-US", { day: "numeric" })}, ${co.getFullYear()}`
  }
  return `${ci.toLocaleDateString("en-US", opts)} – ${co.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`
}

export default function MyBookings() {
  const navigate = useNavigate()
  const [bookings, setBookings] = useState<UserBookingData[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)

  useEffect(() => {
    userBookingsApi
      .getMine()
      .then((data) => setBookings(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this booking? This action cannot be undone.")) return
    setCancelling(id)
    try {
      await userBookingsApi.cancel(id)
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)))
    } catch {
    } finally {
      setCancelling(null)
    }
  }

  if (loading) {
    return (
      <div className="px-base py-section">
        <div className="max-w-[800px] mx-auto">
          <div className="h-8 bg-gray-100 rounded w-40 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-50 rounded w-28 mb-lg animate-pulse" />
          <div className="space-y-sm">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-hairline rounded-[12px] overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-40 h-32 sm:h-auto bg-gray-100 animate-pulse" />
                  <div className="flex-1 p-md">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="h-5 bg-gray-100 rounded w-28 mb-2 animate-pulse" />
                        <div className="h-3 bg-gray-50 rounded w-16 animate-pulse" />
                      </div>
                      <div className="h-5 bg-gray-100 rounded-full w-24 animate-pulse" />
                    </div>
                    <div className="flex gap-4 mt-4">
                      <div className="h-3 bg-gray-50 rounded w-28 animate-pulse" />
                      <div className="h-3 bg-gray-50 rounded w-16 animate-pulse" />
                      <div className="h-3 bg-gray-50 rounded w-16 animate-pulse" />
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-hairline">
                      <div className="h-5 bg-gray-100 rounded w-20 animate-pulse" />
                      <div className="h-8 bg-gray-100 rounded-[8px] w-20 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-base py-section">
      <div className="max-w-[800px] mx-auto">
        <div className="flex items-center justify-between mb-lg">
          <div>
            <h1 className="typo-display-lg text-ink">My Bookings</h1>
            <p className="typo-body-sm text-muted mt-1">
              {bookings.length > 0
                ? `${bookings.length} reservation${bookings.length > 1 ? "s" : ""}`
                : "Your booking history will appear here"}
            </p>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="py-section text-center">
            <h2 className="typo-title-md text-ink mb-xs">No bookings yet</h2>
            <p className="typo-body-sm text-muted mb-lg">
              When you book a room, it will show up here.
            </p>
            <Button
              onClick={() => navigate("/rooms")}
              className="!rounded-[8px] px-6"
              style={{ backgroundColor: "#82285f", color: "#FBF9F4" }}
            >
              Browse Rooms
            </Button>
          </div>
        ) : (
          <div className="space-y-sm">
            {bookings.map((booking) => {
              const status = statusConfig[booking.status] || statusConfig.pending
              return (
                <div
                  key={booking.id}
                  className="bg-white border border-hairline rounded-[12px]"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <div className="sm:w-40 h-32 sm:h-auto shrink-0 overflow-hidden rounded-t-[12px] sm:rounded-l-[12px] sm:rounded-tr-none">
                      <img
                        src={
                          booking.room_image ||
                          "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=300&fit=crop"
                        }
                        alt={booking.room_name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-md flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-sm mb-1">
                          <div className="min-w-0">
                            <h3 className="typo-title-md text-ink truncate">{booking.room_name}</h3>
                            <p className="typo-caption-sm text-muted">{booking.room_type}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ${status.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
                          <div className="flex items-center gap-1.5 text-[13px] text-muted">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            <span>{formatDateRange(booking.check_in, booking.check_out)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px] text-muted">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{booking.nights} {booking.nights === 1 ? "night" : "nights"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px] text-muted">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            <span>{booking.guests} {booking.guests === 1 ? "guest" : "guests"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
                        <span className="typo-title-sm text-ink">₱{booking.total_price.toLocaleString()}</span>
                        <div className="flex items-center gap-2">
                          {booking.status === "confirmed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(booking.id)}
                              disabled={cancelling === booking.id}
                              className="text-muted hover:text-ink hover:bg-gray-50 !rounded-[8px] text-xs"
                            >
                              <X className="h-3.5 w-3.5 mr-1" />
                              {cancelling === booking.id ? "Cancelling..." : "Cancel"}
                            </Button>
                          )}
                          {booking.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={() => navigate(`/booking/${booking.room_id}`)}
                              className="!rounded-[8px] text-xs"
                              style={{ backgroundColor: "#82285f", color: "#FBF9F4" }}
                            >
                              Pay Now
                              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
