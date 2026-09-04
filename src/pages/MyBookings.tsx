import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { CalendarDays, Users, Clock, X, ChevronRight, SlidersHorizontal, ChevronLeft, LayoutGrid, CheckCircle, BadgeCheck, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { userBookingsApi, type UserBookingData } from "@/services/api"
import { useToast } from "@/contexts/ToastContext"
import LoadingDots from "@/components/LoadingDots"
import ConfirmDialog from "@/components/ui/confirm-dialog"

const PRIMARY = "#82285f"
const CANVAS = "#FBF9F8"
const PER_PAGE = 5

const statusStyles: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: "Awaiting Payment", dot: "bg-amber-400", text: "text-amber-600" },
  confirmed: { label: "Confirmed", dot: "bg-emerald-400", text: "text-emerald-600" },
  completed: { label: "Completed", dot: "bg-gray-300", text: "text-muted" },
  cancelled: { label: "Cancelled", dot: "bg-gray-300", text: "text-muted" },
}

type TabFilter = "all" | "pending" | "confirmed" | "completed" | "cancelled"

const tabs: { id: TabFilter; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All", icon: <LayoutGrid className="h-4 w-4" /> },
  { id: "pending", label: "Pending", icon: <Clock className="h-4 w-4" /> },
  { id: "confirmed", label: "Confirmed", icon: <CheckCircle className="h-4 w-4" /> },
  { id: "completed", label: "Completed", icon: <BadgeCheck className="h-4 w-4" /> },
  { id: "cancelled", label: "Cancelled", icon: <XCircle className="h-4 w-4" /> },
]

function formatDateRange(checkIn: string, checkOut: string) {
  const ci = new Date(checkIn)
  const co = new Date(checkOut)
  const opts: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", year: "2-digit" }
  return `${ci.toLocaleDateString("en-US", opts)} – ${co.toLocaleDateString("en-US", opts)}`
}

export default function MyBookings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const [bookings, setBookings] = useState<UserBookingData[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabFilter>("all")
  const [page, setPage] = useState(1)
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })

  useEffect(() => {
    if (searchParams.get("payment") === "cancelled") {
      toast({ title: "Payment cancelled", description: "You can retry payment from My Bookings.", variant: "error" })
      window.history.replaceState({}, "", "/my-bookings")
    }
  }, [])

  useEffect(() => {
    userBookingsApi
      .getMine()
      .then((data) => setBookings(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filteredBookings = activeTab === "all"
    ? bookings
    : bookings.filter((b) => b.status.toLowerCase() === activeTab)

  const totalPages = Math.ceil(filteredBookings.length / PER_PAGE)
  const pagedBookings = filteredBookings.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      await userBookingsApi.cancel(id)
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)))
      toast({ title: "Booking cancelled", description: "Your booking has been cancelled.", variant: "success" })
    } catch {
    } finally {
      setCancelling(null)
    }
  }

  const handlePay = async (id: string) => {
    setPaying(id)
    try {
      const data = await userBookingsApi.retryPay(id)
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch {
    } finally {
      setPaying(null)
    }
  }

  if (loading) {
    return (
      <div className="px-base py-section">
        <div className="max-w-[720px] mx-auto">
          <div className="h-8 bg-gray-100 rounded w-40 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-50 rounded w-28 mb-lg animate-pulse" />
          <div className="space-y-md">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white border border-hairline rounded-[12px] p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="h-5 bg-gray-100 rounded w-32 mb-2 animate-pulse" />
                    <div className="h-3 bg-gray-50 rounded w-20 animate-pulse" />
                  </div>
                  <div className="h-5 bg-gray-100 rounded-full w-24 animate-pulse" />
                </div>
                <div className="flex gap-4">
                  <div className="h-3 bg-gray-50 rounded w-28 animate-pulse" />
                  <div className="h-3 bg-gray-50 rounded w-16 animate-pulse" />
                  <div className="h-3 bg-gray-50 rounded w-16 animate-pulse" />
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
      <div className="max-w-[720px] mx-auto">
        {/* Header */}
        <div className="mb-lg">
          <h1 className="typo-display-lg text-ink">My Bookings</h1>
          <p className="typo-body-sm text-muted mt-1">
            {bookings.length > 0
              ? `${bookings.length} reservation${bookings.length > 1 ? "s" : ""}`
              : "Your booking history will appear here"}
          </p>
        </div>

        {/* Category Tabs */}
        {bookings.length > 0 && (
          <div className="flex items-center gap-0 mb-lg border-b border-hairline">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(1) }}
                className="relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer"
                style={{
                  color: activeTab === tab.id ? PRIMARY : "#7A7A70",
                }}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-[2px]"
                    style={{ backgroundColor: PRIMARY }}
                  />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Empty States */}
        {bookings.length === 0 ? (
          <div className="py-section text-center">
            <h2 className="typo-title-md text-ink mb-xs">No bookings yet</h2>
            <p className="typo-body-sm text-muted mb-lg">
              When you book a room, it will show up here.
            </p>
            <Button
              onClick={() => navigate("/rooms")}
              className="!rounded-[8px] px-6"
              style={{ backgroundColor: PRIMARY, color: CANVAS }}
            >
              Browse Rooms
            </Button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-section text-center">
            <SlidersHorizontal className="h-10 w-10 mx-auto mb-3" style={{ color: "#D5DADF" }} />
            <h2 className="typo-title-md text-ink mb-xs">
              No {activeTab} bookings
            </h2>
            <p className="typo-body-sm text-muted">
              You don&apos;t have any {activeTab} reservations.
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-md">
            {pagedBookings.map((booking) => {
              const status = statusStyles[booking.status.toLowerCase()] || statusStyles.pending
              return (
                <div
                  key={booking.id}
                  className="bg-white border border-hairline rounded-[12px] overflow-hidden hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow duration-200"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Room Image */}
                    <div className="sm:w-36 h-28 sm:h-auto shrink-0 overflow-hidden">
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
                    <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">
                      <div>
                        {/* Top Row: Room + Status */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <h3 className="typo-title-md text-ink truncate">{booking.room_name}</h3>
                            <p className="typo-caption-sm text-muted">{booking.room_type}</p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            <span className={status.text}>{status.label}</span>
                          </span>
                        </div>

                        {/* Details Row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                            {formatDateRange(booking.check_in, booking.check_out)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {booking.nights} {booking.nights === 1 ? "night" : "nights"}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            {booking.guests} {booking.guests === 1 ? "guest" : "guests"}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Row: Price + Actions */}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-hairline">
                        <span className="font-display text-lg font-semibold text-ink">
                          ₱{booking.total_price.toLocaleString()}
                        </span>
                        <div className="flex items-center gap-2">
                          {booking.status.toLowerCase() === "confirmed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCancelDialog({ open: true, id: booking.id })}
                              disabled={cancelling === booking.id}
                              className="text-muted hover:text-ink hover:bg-gray-50 !rounded-[8px] text-xs"
                            >
                              {cancelling === booking.id ? (
                                <span className="flex items-center gap-1">
                                  <LoadingDots size="sm" />
                                  Cancelling...
                                </span>
                              ) : (
                                <>
                                  <X className="h-3.5 w-3.5 mr-1" />
                                  Cancel
                                </>
                              )}
                            </Button>
                          )}
                          {booking.status.toLowerCase() === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handlePay(booking.id)}
                                disabled={paying === booking.id}
                                className="!rounded-[8px] text-xs font-medium"
                                style={{ backgroundColor: PRIMARY, color: CANVAS }}
                              >
                                {paying === booking.id ? (
                                  <LoadingDots size="sm" className="mr-1" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                                )}
                                {paying === booking.id ? "Redirecting..." : "Pay Now"}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCancelDialog({ open: true, id: booking.id })}
                                disabled={cancelling === booking.id}
                                className="text-muted hover:text-ink hover:bg-gray-50 !rounded-[8px] text-xs"
                              >
                                {cancelling === booking.id ? (
                                  <span className="flex items-center gap-1">
                                    <LoadingDots size="sm" />
                                    Cancelling...
                                  </span>
                                ) : (
                                  "Cancel"
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-lg">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] text-sm transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: "#7A7A70" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-9 h-9 flex items-center justify-center rounded-[8px] text-sm font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: page === p ? PRIMARY : "transparent",
                    color: page === p ? CANVAS : "#7A7A70",
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] text-sm transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: "#7A7A70" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={cancelDialog.open}
        onOpenChange={(open) => setCancelDialog({ open, id: cancelDialog.id })}
        title="Cancel Booking"
        description="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Booking"
        variant="danger"
        loading={!!cancelling}
        onConfirm={() => {
          if (cancelDialog.id) handleCancel(cancelDialog.id)
        }}
      />
    </div>
  )
}
