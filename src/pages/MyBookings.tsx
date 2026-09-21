import { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { CalendarDays, Users, Clock, X, ChevronRight, SlidersHorizontal, ChevronLeft, LayoutGrid, CheckCircle, BadgeCheck, XCircle, Receipt, CreditCard, MapPin, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { userBookingsApi, type UserBookingData } from "@/services/api"
import { bookingsApi } from "@/services/api"
import { useToast } from "@/contexts/ToastContext"
import LoadingDots from "@/components/LoadingDots"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePolling } from "@/hooks/usePolling"

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

function formatDateRange(checkIn: string, checkOut: string, stayType?: string) {
  const ci = new Date(checkIn)
  const opts: Intl.DateTimeFormatOptions = { month: "2-digit", day: "2-digit", year: "2-digit" }
  if (stayType === "day") {
    return ci.toLocaleDateString("en-US", opts)
  }
  const co = new Date(checkOut)
  return `${ci.toLocaleDateString("en-US", opts)} – ${co.toLocaleDateString("en-US", opts)}`
}

type BookingDetail = UserBookingData & { full_name: string; email: string; phone: string; special_requests: string }

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

  // Detail sheet state
  const [detailBooking, setDetailBooking] = useState<BookingDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get("payment") === "cancelled") {
      toast({ title: "Payment cancelled", description: "You can retry payment from My Bookings.", variant: "error" })
      window.history.replaceState({}, "", "/my-bookings")
    }
  }, [])

  // Poll bookings every 15 seconds for live updates
  usePolling(
    () => userBookingsApi.getMine(),
    (data) => { setBookings(data); setLoading(false) },
    15000,
  )

  useEffect(() => {
    // Fire auto-complete in background (non-blocking)
    bookingsApi.autoComplete().catch(() => {})
  }, [])

  const filteredBookings = activeTab === "all"
    ? bookings
    : bookings.filter((b) => b.status.toLowerCase() === activeTab)

  const totalPages = Math.ceil(filteredBookings.length / PER_PAGE)
  const pagedBookings = filteredBookings.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const handleCardClick = useCallback(async (booking: UserBookingData) => {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const detail = await userBookingsApi.getOne(booking.id)
      setDetailBooking(detail)
    } catch {
      // Fallback: show what we have
      setDetailBooking(booking as BookingDetail)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const handleCancel = async (id: string) => {
    setCancelling(id)
    try {
      await userBookingsApi.cancel(id)
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)))
      // Update detail if open
      setDetailBooking((prev) => (prev?.id === id ? { ...prev, status: "cancelled" } : prev))
      toast({ title: "Booking cancelled", description: "Your booking has been cancelled.", variant: "success" })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel booking"
      toast({ title: "Cancel failed", description: msg, variant: "error" })
    } finally {
      setCancelling(null)
      setCancelDialog({ open: false, id: null })
    }
  }

  const handlePay = async (id: string) => {
    setPaying(id)
    try {
      const data = await userBookingsApi.retryPay(id)
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create payment session"
      toast({ title: "Payment failed", description: msg, variant: "error" })
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
          <div className="flex items-center gap-0 mb-lg border-b border-hairline overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(1) }}
                className="relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap"
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
                  onClick={() => handleCardClick(booking)}
                  className="bg-white border border-hairline rounded-[12px] overflow-hidden hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow duration-200 cursor-pointer group"
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
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                            {formatDateRange(booking.check_in, booking.check_out, booking.stay_type)}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {booking.stay_type === "day" && booking.duration
                              ? `${booking.duration}h${booking.start_time ? ` (${booking.start_time})` : ""}`
                              : `${booking.nights} ${booking.nights === 1 ? "night" : "nights"}`
                            }
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
                              onClick={(e) => { e.stopPropagation(); setCancelDialog({ open: true, id: booking.id }) }}
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
                                onClick={(e) => { e.stopPropagation(); handlePay(booking.id) }}
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
                                onClick={(e) => { e.stopPropagation(); setCancelDialog({ open: true, id: booking.id }) }}
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
                className="w-11 h-11 flex items-center justify-center rounded-[8px] text-sm transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: "#7A7A70" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className="w-11 h-11 flex items-center justify-center rounded-[8px] text-sm font-medium transition-colors cursor-pointer"
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
                className="w-11 h-11 flex items-center justify-center rounded-[8px] text-sm transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100"
                style={{ color: "#7A7A70" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
          </>
        )}
      </div>

      {/* ── Booking Detail Dialog ────────────────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="!rounded-[16px] !max-w-[520px] !p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-hairline">
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" style={{ color: PRIMARY }} />
              Booking Details
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
                  <div className="h-4 bg-gray-50 rounded w-full" />
                </div>
              ))}
            </div>
          ) : detailBooking ? (
            <div className="overflow-y-auto max-h-[70vh] p-6">
              {/* Room Image + Name */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-20 h-20 rounded-[10px] overflow-hidden shrink-0">
                  <img
                    src={detailBooking.room_image || "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=300&fit=crop"}
                    alt={detailBooking.room_name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-ink text-lg truncate">{detailBooking.room_name}</h3>
                  <p className="text-sm text-muted">{detailBooking.room_type}</p>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${(statusStyles[detailBooking.status.toLowerCase()] || statusStyles.pending).dot}`} />
                    <span className={(statusStyles[detailBooking.status.toLowerCase()] || statusStyles.pending).text}>
                      {(statusStyles[detailBooking.status.toLowerCase()] || statusStyles.pending).label}
                    </span>
                  </span>
                </div>
              </div>

              {/* Booking Information */}
              <div className="space-y-3 mb-6">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Booking Information</h4>
                <div className="bg-gray-50 rounded-[10px] p-4 space-y-3">
                  <DetailRow icon={<FileText className="h-4 w-4" />} label="Booking ID" value={`#${detailBooking.id.slice(0, 8).toUpperCase()}`} />
                  <DetailRow
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="Dates"
                    value={formatDateRange(detailBooking.check_in, detailBooking.check_out, detailBooking.stay_type)}
                  />
                  <DetailRow
                    icon={<Clock className="h-4 w-4" />}
                    label="Duration"
                    value={
                      detailBooking.stay_type === "day" && detailBooking.duration
                        ? `${detailBooking.duration} hours${detailBooking.start_time ? ` at ${detailBooking.start_time}` : ""}`
                        : `${detailBooking.nights} ${detailBooking.nights === 1 ? "night" : "nights"}`
                    }
                  />
                  <DetailRow
                    icon={<Users className="h-4 w-4" />}
                    label="Guests"
                    value={`${detailBooking.guests} ${detailBooking.guests === 1 ? "guest" : "guests"}`}
                  />
                </div>
              </div>

              {/* Guest Info (if available) */}
              {(detailBooking.full_name || detailBooking.email) && (
                <div className="space-y-3 mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Guest Information</h4>
                  <div className="bg-gray-50 rounded-[10px] p-4 space-y-3">
                    {detailBooking.full_name && (
                      <DetailRow icon={<Users className="h-4 w-4" />} label="Name" value={detailBooking.full_name} />
                    )}
                    {detailBooking.email && (
                      <DetailRow icon={<MapPin className="h-4 w-4" />} label="Email" value={detailBooking.email} />
                    )}
                    {detailBooking.phone && (
                      <DetailRow icon={<MapPin className="h-4 w-4" />} label="Phone" value={detailBooking.phone} />
                    )}
                  </div>
                </div>
              )}

              {/* Payment Details */}
              <div className="space-y-3 mb-6">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Payment Details</h4>
                <div className="bg-gray-50 rounded-[10px] p-4 space-y-3">
                  <DetailRow
                    icon={<CreditCard className="h-4 w-4" />}
                    label="Payment Method"
                    value={detailBooking.payment_method ? detailBooking.payment_method.charAt(0).toUpperCase() + detailBooking.payment_method.slice(1) : "N/A"}
                  />
                  <DetailRow
                    icon={<Receipt className="h-4 w-4" />}
                    label="Booking Date"
                    value={new Date(detailBooking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  />
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-ink">Total Amount</span>
                    <span className="text-lg font-display font-bold" style={{ color: PRIMARY }}>
                      ₱{detailBooking.total_price.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Special Requests */}
              {detailBooking.special_requests && (
                <div className="space-y-3 mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Special Requests</h4>
                  <div className="bg-gray-50 rounded-[10px] p-4">
                    <p className="text-sm text-ink">{detailBooking.special_requests}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t border-hairline flex gap-3">
                {detailBooking.status.toLowerCase() === "pending" && (
                  <Button
                    onClick={() => { handlePay(detailBooking.id) }}
                    disabled={paying === detailBooking.id}
                    className="flex-1 !rounded-[8px]"
                    style={{ backgroundColor: PRIMARY, color: CANVAS }}
                  >
                    {paying === detailBooking.id ? <LoadingDots size="sm" className="mr-2" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                    {paying === detailBooking.id ? "Redirecting..." : "Pay Now"}
                  </Button>
                )}
                {(detailBooking.status.toLowerCase() === "confirmed" || detailBooking.status.toLowerCase() === "pending") && (
                  <Button
                    variant="outline"
                    onClick={() => { setDetailOpen(false); setCancelDialog({ open: true, id: detailBooking.id }) }}
                    disabled={cancelling === detailBooking.id}
                    className="flex-1 !rounded-[8px]"
                  >
                    Cancel Booking
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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

/* ── Detail Row Component ──────────────────────────────────────────────── */

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-muted">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-ink text-right">{value}</span>
    </div>
  )
}
