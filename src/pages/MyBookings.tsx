import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { ChevronRight, SlidersHorizontal, ChevronLeft, CheckCircle, CreditCard, Star, Mail, Phone, User, RotateCcw } from "lucide-react"
import BookingQr from "@/components/BookingQr"
import { Button } from "@/components/ui/button"
import { userBookingsApi, ApiError, type UserBookingData } from "@/services/api"
import { bookingsApi, authApi } from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { useNotifications } from "@/contexts/NotificationContext"
import LoadingDots from "@/components/LoadingDots"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import ReviewModal from "@/components/ReviewModal"
import ReceiptDialog, { type ReceiptData } from "@/components/ReceiptDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePolling } from "@/hooks/usePolling"
import { formatPaymentMethod } from "@/lib/payment"
import { deriveArrival, canCancel, startMomentLabel, arrivalTimeLabel, checkoutMomentLabel } from "@/lib/arrival"
import CancelReasonPicker, { composeCancelReason } from "@/components/CancelReasonPicker"
import { Skeleton, SkeletonLine } from "@/components/ui/skeleton"
import { useMinSkeleton } from "@/hooks/useMinSkeleton"
import { cn } from "@/lib/utils"

const PRIMARY = "#82285f"
const CANVAS = "#FBF9F8"
const PER_PAGE = 8

const statusStyles: Record<string, { label: string; dot: string; text: string; badgeCls: string }> = {
  pending: { label: "Awaiting Payment", dot: "bg-amber-400", text: "text-amber-600", badgeCls: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmed", dot: "bg-emerald-400", text: "text-emerald-600", badgeCls: "bg-emerald-50 text-emerald-700" },
  // Derived from the clock, not stored — see lib/arrival.ts
  arrived: { label: "Arrived", dot: "bg-amber-500", text: "text-amber-600", badgeCls: "bg-amber-50 text-amber-700" },
  "in-house": { label: "In-house", dot: "bg-[#3D6B4F]", text: "text-[#3D6B4F]", badgeCls: "bg-primary/10 text-primary" },
  completed: { label: "Completed", dot: "bg-gray-300", text: "text-muted", badgeCls: "bg-gray-100 text-muted" },
  "checked-out": { label: "Checked Out", dot: "bg-gray-300", text: "text-muted", badgeCls: "bg-gray-100 text-muted" },
  cancelled: { label: "Cancelled", dot: "bg-gray-300", text: "text-muted", badgeCls: "bg-red-50 text-[#b91c1c]" },
}

/** Badge for a booking, including the arrival states the server derives. */
function statusFor(b: UserBookingData) {
  const state = deriveArrival(b)
  if (state === "early") return statusStyles.arrived
  if (state === "in_house") return statusStyles["in-house"]
  return statusStyles[b.status.toLowerCase()] || statusStyles.pending
}

type TabFilter = "all" | "pending" | "confirmed" | "in-house" | "completed" | "cancelled"

const tabs: { id: TabFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "in-house", label: "In-house" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
]

/** Shared by the tab filters and the tab count pills so they can never drift apart. */
function matchesTab(b: UserBookingData, tab: TabFilter): boolean {
  if (tab === "all") return true
  const status = b.status.toLowerCase()
  // "In-house" is derived from the clock, not stored — see lib/arrival.ts
  if (tab === "in-house") return deriveArrival(b) === "in_house"
  // Checked-out stays are finished too — group them under the Completed tab
  if (tab === "completed") return status === "completed" || status === "checked-out"
  // Confirmed excludes anyone who is already in the room
  if (tab === "confirmed") return status === "confirmed" && deriveArrival(b) !== "in_house"
  return status === tab
}

/** Anchor for ordering — day use has only one date. */
function stayEndMs(b: UserBookingData): number {
  const t = new Date(b.stay_type === "day" ? b.check_in : b.check_out).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Upcoming stays first (soonest check-in first), then past/cancelled by most recent. */
function orderBookings(list: UserBookingData[]): UserBookingData[] {
  const now = Date.now()
  const isUpcoming = (b: UserBookingData) =>
    (b.status === "pending" || b.status === "confirmed") && stayEndMs(b) >= now
  return [
    ...list
      .filter(isUpcoming)
      .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime()),
    ...list.filter((b) => !isUpcoming(b)).sort((a, b) => stayEndMs(b) - stayEndMs(a)),
  ]
}

/** Cancelled-card refund line. The backend zeroes amount_paid once a refund is issued. */
function refundLine(b: UserBookingData): { text: string; cls: string } | null {
  if (b.status.toLowerCase() !== "cancelled") return null
  const paid = Math.max(0, b.amount_paid ?? 0)
  if (b.refunded_at) {
    // amount_paid is zeroed on refund — fall back to what was collected.
    const amount = paid > 0 ? paid : b.payment_mode === "downpayment" ? Math.round((b.total_price ?? 0) / 2) : b.total_price ?? 0
    return { text: `Refunded ₱${amount.toLocaleString()}`, cls: "text-[#3D6B4F]" }
  }
  if (paid > 0) return { text: "No refund", cls: "text-muted" }
  return null
}

/** "2 adults · 3 children · 1 pet" — falls back to the total for pre-migration bookings. */
function guestBreakdown(b: UserBookingData): string {
  const parts: string[] = []
  if (b.adults != null) parts.push(`${b.adults} adult${b.adults === 1 ? "" : "s"}`)
  if (b.children) parts.push(`${b.children} ${b.children === 1 ? "child" : "children"}`)
  if (b.pets) parts.push(`${b.pets} pet${b.pets === 1 ? "" : "s"}`)
  if (parts.length > 0) return parts.join(" · ")
  return `${b.guests} ${b.guests === 1 ? "guest" : "guests"}`
}

function formatDateRange(checkIn: string, checkOut: string, stayType?: string) {
  const ci = new Date(checkIn)
  const day: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const dayYear: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }
  if (stayType === "day") {
    return ci.toLocaleDateString("en-US", dayYear)
  }
  const co = new Date(checkOut)
  // One format everywhere: "Oct 4 – Oct 5, 2026" (year once when it matches).
  return ci.getFullYear() === co.getFullYear()
    ? `${ci.toLocaleDateString("en-US", day)} – ${co.toLocaleDateString("en-US", dayYear)}`
    : `${ci.toLocaleDateString("en-US", dayYear)} – ${co.toLocaleDateString("en-US", dayYear)}`
}

type BookingDetail = UserBookingData & { full_name: string; email: string; phone: string; special_requests: string }

/** Normalise a guest booking into the shared receipt shape. */
function receiptFor(b: BookingDetail): ReceiptData {
  const isDay = b.stay_type === "day"
  const rate = b.room_price ?? 0
  const nights = Math.max(1, b.nights || 1)
  const dayPrice = isDay && b.duration ? Math.round((rate * b.duration) / 24) : 0
  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"
  const down = b.payment_mode === "downpayment"
  const amountPaid = Math.max(0, b.amount_paid ?? 0)
  const balanceDue = Math.max(0, (b.total_price ?? 0) - amountPaid)

  return {
    reference: b.id.slice(0, 8).toUpperCase(),
    fullReference: b.id,
    issuedAt: b.created_at,
    guestName: b.full_name || "Guest",
    guestEmail: b.email,
    guestPhone: b.phone,
    roomName: b.room_name,
    roomDetail: b.room_type,
    checkInLabel: fmtDate(b.check_in),
    checkOutLabel: isDay ? undefined : fmtDate(b.check_out),
    stayLabel:
      isDay && b.duration
        ? `Day use · ${b.duration} hours${b.start_time ? ` from ${b.start_time}` : ""}`
        : `${nights} night${nights === 1 ? "" : "s"}`,
    guests: b.guests,
    total: b.total_price,
    gross: rate > 0 ? (isDay ? dayPrice : rate * nights) : null,
    itemLabel: isDay
      ? `${b.room_name} · day use`
      : `${b.room_name} × ${nights} night${nights === 1 ? "" : "s"}`,
    paymentMethod: formatPaymentMethod(b.payment_method, "N/A"),
    paymentMode: down ? "downpayment" : "full",
    amountPaid,
    balanceDue,
    refundedAt: b.refunded_at,
    paymentStatus:
      b.refunded_at
        ? "Refunded"
        : b.status === "pending"
        ? down
          ? "Downpayment pending"
          : "Unpaid"
        : b.status === "cancelled"
          ? "Cancelled"
          : down
            ? balanceDue > 0
              ? "Partially paid"
              : "Paid in full"
            : "Paid",
  }
}

type SuggestedRoom = { id: string; name: string; type: string; price: number; image: string }

function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

/** 'Oct 4, 2026 · 2:00 PM' — check-in line matching checkoutMomentLabel's shape. */
function checkInMomentLabel(b: { check_in: string; stay_type?: string | null; start_time?: string | null }): string {
  const d = new Date(b.check_in)
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
  const year = d.getUTCFullYear()
  // Day use without a picked time has no meaningful clock to show.
  if (b.stay_type === "day" && !b.start_time) return `${day}, ${year}`
  const start = startMomentLabel(b)
  const time = start ? start.split(", ").slice(1).join(", ") : ""
  return time ? `${day}, ${year} · ${time}` : `${day}, ${year}`
}

export default function MyBookings() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { logout } = useAuth()
  const { unreadBookingCount, markBookingNotificationsRead } = useNotifications()
  const [bookings, setBookings] = useState<UserBookingData[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [paying, setPaying] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabFilter>("all")
  const [page, setPage] = useState(1)
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [cancelReason, setCancelReason] = useState("")
  const [cancelReasonOther, setCancelReasonOther] = useState("")
  const [cancelReasonError, setCancelReasonError] = useState(false)
  const resetCancelReason = () => {
    setCancelReason("")
    setCancelReasonOther("")
    setCancelReasonError(false)
  }

  // Review state — the stay is over, we're asking the guest what they thought
  const [reviewTarget, setReviewTarget] = useState<UserBookingData | null>(null)

  // Detail sheet state
  const [detailBooking, setDetailBooking] = useState<BookingDetail | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  // Official receipt for the booking currently open in the detail dialog
  const [receiptOpen, setReceiptOpen] = useState(false)

  // Extend stay state
  const [extendDialog, setExtendDialog] = useState<{ id: string | null; hours: number }>({ id: null, hours: 1 })
  const [extending, setExtending] = useState<string | null>(null)
  const [conflictDialog, setConflictDialog] = useState<{ open: boolean; error: string; next?: string; rooms: SuggestedRoom[] }>({ open: false, error: "", rooms: [] })

  const [loadError, setLoadError] = useState(false)
  const loadedRef = useRef(false)

  // Skeletons show at least 500ms; the destination then fades in.
  const showSkeleton = useMinSkeleton(loading)
  const showDetailSkeleton = useMinSkeleton(detailLoading)

  useEffect(() => {
    if (searchParams.get("payment") === "cancelled") {
      toast({ title: "Payment cancelled", description: "You can retry payment from My Bookings.", variant: "error" })
      window.history.replaceState({}, "", "/my-bookings")
    }
  }, [])

  // Returned from PayMongo after paying for an extension
  useEffect(() => {
    const extendPaid = searchParams.get("extend_paid")
    if (!extendPaid) return
    ;(async () => {
      try {
        const res = await userBookingsApi.extendConfirm(extendPaid)
        if (res.status === "extended") {
          const h = res.hours ?? 1
          toast({ title: "Stay extended", description: `Your stay was extended by ${h} hour${h === 1 ? "" : "s"}.`, variant: "success" })
          const fresh = await userBookingsApi.getMine()
          setBookings(fresh)
        } else if (res.status === "pending_payment") {
          toast({ title: "Extension pending", description: "We haven't confirmed your extension payment yet — this page will update shortly.", variant: "error" })
        } else {
          toast({ title: "No extension found", description: "There was no pending extension for this booking.", variant: "error" })
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const body = err.body as { error?: string; next_booking_start?: string; suggested_rooms?: SuggestedRoom[] }
          setConflictDialog({
            open: true,
            error: body.error || "Extending would conflict with another booking.",
            next: body.next_booking_start,
            rooms: body.suggested_rooms || [],
          })
        } else {
          toast({ title: "Extension failed", description: err instanceof Error ? err.message : "Could not confirm the extension.", variant: "error" })
        }
      } finally {
        window.history.replaceState({}, "", "/my-bookings")
      }
    })()
  }, [])

  // Poll bookings every 15 seconds for live updates
  usePolling(
    () => userBookingsApi.getMine(),
    (data) => {
      setBookings(data)
      loadedRef.current = true
      setLoadError(false)
      setLoading(false)
    },
    15000,
  )

  // Failsafe: the poller swallows fetch errors, so if the first request keeps
  // failing the page would sit on skeletons forever. Show the error state.
  useEffect(() => {
    const id = setTimeout(() => {
      if (!loadedRef.current) {
        setLoadError(true)
        setLoading(false)
      }
    }, 8000)
    return () => clearTimeout(id)
  }, [])

  const retryBookings = async () => {
    setLoadError(false)
    setLoading(true)
    try {
      const data = await userBookingsApi.getMine()
      setBookings(data)
      loadedRef.current = true
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Fire auto-complete in background (non-blocking)
    bookingsApi.autoComplete().catch(() => {})
    // Self-scoped deletion purge check — only ever THIS account; when the
    // 30-day grace is over the backend purges it and we sign out locally.
    authApi
      .deletionCheck()
      .then((r) => {
        if (r?.deleted) {
          toast({
            title: "Account deleted",
            description: "This account has been permanently deleted.",
            variant: "default",
          })
          void logout()
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // You're looking at the bookings list, so the red badge on "My Bookings" is
  // already seen — clear it instead of leaving a mystery count.
  useEffect(() => {
    if (unreadBookingCount > 0) void markBookingNotificationsRead()
  }, [unreadBookingCount, markBookingNotificationsRead])

  const orderedBookings = orderBookings(bookings)

  const filteredBookings = activeTab === "all"
    ? orderedBookings
    : orderedBookings.filter((b) => matchesTab(b, activeTab))

  // Per-tab counts — same predicates as the filters above.
  const tabCounts = tabs.map((t) => ({ ...t, count: bookings.filter((b) => matchesTab(b, t.id)).length }))

  // Finished stays that still owe us a rating — only ones you actually
  // checked in to. A booking that merely lapsed (no-show) is not reviewable.
  const isReviewable = (b: UserBookingData) =>
    (b.status === "completed" || b.status === "checked-out") && !!b.checked_in_at && !b.reviewed
  const pendingReviews = bookings.filter(isReviewable)

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

  const handleCancel = async (id: string, reason?: string) => {
    setCancelling(id)
    try {
      const res = await userBookingsApi.cancel(id, reason)
      setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled", cancellation_reason: reason ?? b.cancellation_reason ?? null } : b)))
      // Update detail if open
      setDetailBooking((prev) => (prev?.id === id ? { ...prev, status: "cancelled", cancellation_reason: reason ?? prev.cancellation_reason ?? null } : prev))
      toast({
        title: "Booking cancelled",
        description: res.refunded
          ? `₱${(res.refund_amount ?? 0).toLocaleString()} is on its way back to your original payment method — 7–14 banking days.`
          : "Your booking has been cancelled.",
        variant: "success",
      })
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

  const handleExtend = async () => {
    const id = extendDialog.id
    if (!id) return
    setExtending(id)
    try {
      const data = await userBookingsApi.extend(id, extendDialog.hours)
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { error?: string; next_booking_start?: string; suggested_rooms?: SuggestedRoom[] }
        setConflictDialog({
          open: true,
          error: body.error || "Extending would conflict with another booking.",
          next: body.next_booking_start,
          rooms: body.suggested_rooms || [],
        })
        setExtendDialog({ id: null, hours: 1 })
        setDetailOpen(false)
      } else {
        const msg = err instanceof Error ? err.message : "Failed to start extension"
        toast({ title: "Extension failed", description: msg, variant: "error" })
      }
    } finally {
      setExtending(null)
    }
  }

  return (
    <div className="px-base py-section" aria-busy={showSkeleton}>
      <div
        aria-live="polite"
        className={cn("max-w-[720px] mx-auto", !showSkeleton && "content-fade")}
      >
        {showSkeleton ? (
          <MyBookingsSkeleton />
        ) : loadError && bookings.length === 0 ? (
          <MyBookingsError onRetry={retryBookings} />
        ) : (
        <>
        {/* Header */}
        <div className="mb-lg">
          <h1 className="typo-display-lg text-ink">My Bookings</h1>
          <p className="typo-body-sm text-muted mt-1">
            {bookings.length > 0
              ? `${bookings.length} reservation${bookings.length > 1 ? "s" : ""}`
              : "Your booking history will appear here"}
          </p>
        </div>

        {/* Review prompt — completed stays still waiting for a rating */}
        {pendingReviews.length > 0 && (
          <div className="mb-lg flex items-start gap-3 rounded-[12px] border border-hairline bg-white p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#82285f]/10">
              <Star className="size-4 fill-star-rating text-star-rating" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="typo-title-sm text-ink">How was your stay?</p>
              <p className="typo-caption-sm text-muted mt-0.5">
                {pendingReviews.length === 1
                  ? "You have 1 completed stay waiting for a review."
                  : `You have ${pendingReviews.length} completed stays waiting for a review.`}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setReviewTarget(pendingReviews[0])}
              className="!rounded-[8px] text-xs font-semibold shrink-0"
              style={{ backgroundColor: PRIMARY, color: CANVAS }}
            >
              <Star className="h-3.5 w-3.5 mr-1" />
              Review now
            </Button>
          </div>
        )}

        {/* Category Tabs */}
        {bookings.length > 0 && (
          <div className="flex items-center gap-0 mb-lg border-b border-hairline overflow-x-auto no-scrollbar">
            {tabCounts.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setPage(1) }}
                className="relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  color: activeTab === tab.id ? PRIMARY : "#7A7A70",
                }}
              >
                {tab.label}
                <span
                  className={cn(
                    "text-[11px] font-medium leading-none",
                    tab.count === 0 ? "text-muted-soft" : "text-muted",
                  )}
                >
                  {tab.count}
                </span>
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
              const status = statusFor(booking)
              const rawStatus = booking.status.toLowerCase()
              const dimmed = rawStatus === "cancelled" || rawStatus === "completed" || rawStatus === "checked-out"
              const refund = refundLine(booking)
              const isFinished = rawStatus === "completed" || rawStatus === "checked-out"
              return (
                <div
                  key={booking.id}
                  onClick={() => handleCardClick(booking)}
                  className="bg-white border border-hairline rounded-[12px] overflow-hidden hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] hover:border-primary/25 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Room Image */}
                    <div className="w-full aspect-[16/9] sm:w-36 sm:h-auto sm:aspect-auto shrink-0 overflow-hidden">
                      <img
                        src={
                          booking.room_image ||
                          "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=300&fit=crop"
                        }
                        alt={booking.room_name}
                        className={cn(
                          "w-full h-full object-cover group-hover:scale-105 transition-transform duration-200",
                          dimmed && "opacity-70",
                        )}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between min-w-0">
                      <div className={cn(dimmed && "opacity-70")}>
                        {/* Top Row: Room + Status */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <h3 className="typo-title-md text-ink truncate">{booking.room_name}</h3>
                            <p className="typo-caption-sm text-muted">{booking.room_type}</p>
                          </div>
                          <span className={cn("inline-flex items-center shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none", status.badgeCls)}>
                            {status.label}
                          </span>
                        </div>

                        {/* Details Row */}
                        <p className="text-[13px] text-muted">
                          {[
                            formatDateRange(booking.check_in, booking.check_out, booking.stay_type),
                            booking.stay_type === "day" && booking.duration
                              ? `${booking.duration}h${booking.start_time ? ` (${booking.start_time})` : ""}`
                              : `${booking.nights} ${booking.nights === 1 ? "night" : "nights"}`,
                            `${booking.guests} ${booking.guests === 1 ? "guest" : "guests"}`,
                          ].join(" · ")}
                        </p>
                        {/* Stay end + extension — glanceable without opening the detail */}
                        {(() => {
                          const outTime = checkoutMomentLabel(booking).split("·").pop()?.trim()
                          const ext = extensionInfo(booking)
                          return outTime || ext ? (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px]">
                              {outTime && <span className="text-muted">→ out {outTime}</span>}
                              {ext && (
                                <span className={cn("font-medium", ext.valueClass ?? "text-primary")}>{ext.value}</span>
                              )}
                            </div>
                          ) : null
                        })()}
                        {rawStatus === "cancelled" && booking.cancellation_reason && (
                          <p className="mt-1 text-[12px] text-muted">
                            <span className="font-medium text-ink/70">Reason:</span>{" "}
                            {booking.cancellation_reason}
                          </p>
                        )}
                      </div>

                      {/* Bottom Row: Price + refund status + Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                        <div className={cn("min-w-0", dimmed && "opacity-70")}>
                          <span className="tabular-nums font-display text-lg font-semibold text-ink">
                            ₱{booking.total_price.toLocaleString()}
                          </span>
                          {refund && (
                            <p className={cn("text-xs font-medium mt-0.5", refund.cls)}>{refund.text}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {/* In-house: extend straight from the card — no detail
                              modal round-trip. Same gate as the detail action. */}
                          {rawStatus === "confirmed" &&
                            deriveArrival(booking) === "in_house" &&
                            booking.end_time &&
                            new Date(booking.end_time).getTime() > Date.now() &&
                            (booking.extended_hours ?? 0) <= 0 && (
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); setExtendDialog({ id: booking.id, hours: 1 }) }}
                                className="!rounded-[8px] text-xs font-semibold"
                                style={{ backgroundColor: PRIMARY, color: CANVAS }}
                              >
                                Extend
                              </Button>
                            )}
                          {rawStatus === "confirmed" && canCancel(booking) && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); resetCancelReason(); setCancelDialog({ open: true, id: booking.id }) }}
                              disabled={cancelling === booking.id}
                              className="text-xs text-muted hover:text-ink underline-offset-2 hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
                            >
                              {cancelling === booking.id ? (
                                <span className="flex items-center gap-1">
                                  <LoadingDots size="sm" />
                                  Cancelling...
                                </span>
                              ) : (
                                "Cancel"
                              )}
                            </button>
                          )}
                          {rawStatus === "pending" && (
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
                                {paying === booking.id ? "Redirecting…" : "Pay Now"}
                              </Button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); resetCancelReason(); setCancelDialog({ open: true, id: booking.id }) }}
                                disabled={cancelling === booking.id}
                                className="text-xs text-muted hover:text-ink underline-offset-2 hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline"
                              >
                                {cancelling === booking.id ? (
                                  <span className="flex items-center gap-1">
                                    <LoadingDots size="sm" />
                                    Cancelling...
                                  </span>
                                ) : (
                                  "Cancel"
                                )}
                              </button>
                            </>
                          )}
                          {isFinished && (
                            <>
                              {/* No-shows never checked in — nothing to rate. */}
                              {!!booking.checked_in_at && (
                                booking.reviewed ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
                                    <Star className="h-3.5 w-3.5 fill-star-rating text-star-rating" />
                                    You rated {booking.rating ?? "—"} / 5
                                  </span>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); setReviewTarget(booking) }}
                                    className="!rounded-[8px] text-xs font-semibold"
                                    style={{ backgroundColor: PRIMARY, color: CANVAS }}
                                  >
                                    <Star className="h-3.5 w-3.5 mr-1" />
                                    Write a review
                                  </Button>
                                )
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); navigate(`/rooms/${booking.room_id}`) }}
                                className="!rounded-[8px] text-xs font-medium"
                              >
                                Book again
                              </Button>
                            </>
                          )}
                          {rawStatus === "cancelled" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); navigate(`/rooms/${booking.room_id}`) }}
                              className="!rounded-[8px] text-xs font-medium"
                            >
                              Book again
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
        </>
        )}
      </div>

      {/* ── Booking Detail Dialog ────────────────────────────────────── */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setReceiptOpen(false)
        }}
      >
        <DialogContent className="!rounded-[16px] !max-w-[520px] !p-0 overflow-hidden">
          <DialogTitle className="sr-only">Booking Details</DialogTitle>

          <div aria-busy={showDetailSkeleton}>
          <div aria-live="polite" className={showDetailSkeleton ? undefined : "content-fade"}>
          {showDetailSkeleton ? (
            <div className="p-6 space-y-4" aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <SkeletonLine className="h-3 w-24 mb-2" />
                  <SkeletonLine className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : detailBooking ? (
            <div className="max-h-[85dvh] overflow-y-auto p-6">
              {/* Header: room photo, name, type, status */}
              <div className="mb-5 flex items-start gap-4 pr-8">
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
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-xs font-medium mt-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusFor(detailBooking).dot}`} />
                    <span className={statusFor(detailBooking).text}>
                      {statusFor(detailBooking).label}
                    </span>
                  </span>
                </div>
              </div>

              {/* Check-in QR — only while the stay is live. Cancelled/finished
                  bookings keep their details, but the QR image and its code
                  are no longer shown. */}
              {(() => {
                const status = detailBooking.status.toLowerCase()
                const finished =
                  status === "cancelled" || status === "completed" || status === "checked-out"
                if (finished) {
                  return (
                    <p className="mb-5 rounded-[10px] bg-gray-50 px-4 py-3 text-[13px] text-muted">
                      {status === "cancelled"
                        ? "This booking was cancelled — the check-in QR is no longer available."
                        : "This stay has ended — the check-in QR is no longer available."}
                    </p>
                  )
                }
                const qrActive = status === "confirmed"
                return (
                  <BookingQr
                    bookingId={detailBooking.id}
                    className="mb-5"
                    inactiveMessage={qrActive ? undefined : "Your QR becomes active once payment is confirmed."}
                    validFrom={qrActive && deriveArrival(detailBooking) === "none" && startMomentLabel(detailBooking) ? `Valid from ${startMomentLabel(detailBooking)}` : undefined}
                    checkInLabel={checkInMomentLabel(detailBooking) || undefined}
                    checkOutLabel={checkoutMomentLabel(detailBooking) || undefined}
                  />
                )
              })()}

              {/* Arrival status — mirrors what the front desk sees after your QR scan */}
              {detailBooking.status.toLowerCase() === "confirmed" && detailBooking.checked_in_at && (() => {
                const state = deriveArrival(detailBooking)
                const start = startMomentLabel(detailBooking)
                const at = arrivalTimeLabel(detailBooking.checked_in_at)
                const text =
                  state === "early" ? `Checked in ${at} · stay starts ${start}`
                  : state === "in_house" ? `In-house${start ? ` · stay started ${start}` : ""}`
                  : `Checked in${at ? ` ${at}` : ""}`
                const tone =
                  state === "in_house" ? "text-[#3D6B4F]"
                  : state === "early" ? "text-amber-600"
                  : "text-muted"
                return (
                  <div className="mb-5 flex items-center gap-2 rounded-[10px] bg-gray-50 px-4 py-3">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", state === "in_house" ? "bg-[#3D6B4F]" : state === "early" ? "bg-amber-500" : "bg-gray-300")} />
                    <span className={cn("text-sm font-medium", tone)}>{text}</span>
                  </div>
                )
              })()}

              {/* Booking Information — Booking ID and dates live in the QR card */}
              <div className="space-y-3 mb-5">
                <h4 className="text-sm font-semibold text-ink">Booking Information</h4>
                <div className="bg-gray-50 rounded-[10px] p-4 space-y-2.5">
                  <DetailRow
                    label="Duration"
                    value={
                      detailBooking.stay_type === "day" && detailBooking.duration
                        ? `${detailBooking.duration} hours${detailBooking.start_time ? ` at ${detailBooking.start_time}` : ""}`
                        : `${detailBooking.nights} ${detailBooking.nights === 1 ? "night" : "nights"}`
                    }
                  />
                  <DetailRow
                    label="Guests"
                    value={guestBreakdown(detailBooking)}
                  />
                  <DetailRow
                    label="Checkout"
                    value={checkoutMomentLabel(detailBooking) || "—"}
                  />
                  {(() => {
                    const ext = extensionInfo(detailBooking)
                    return ext ? (
                      <DetailRow label="Extension" value={ext.value} valueClass={ext.valueClass} />
                    ) : null
                  })()}
                </div>
              </div>

              {/* Guest Info (if available) */}
              {(detailBooking.full_name || detailBooking.email) && (
                <div className="space-y-3 mb-5">
                  <h4 className="text-sm font-semibold text-ink">Guest Information</h4>
                  <div className="bg-gray-50 rounded-[10px] p-4 space-y-2.5">
                    {detailBooking.full_name && (
                      <DetailRow icon={<User className="h-4 w-4 text-muted" />} label="Name" value={detailBooking.full_name} />
                    )}
                    {detailBooking.email && (
                      <DetailRow icon={<Mail className="h-4 w-4 text-muted" />} label="Email" value={detailBooking.email} />
                    )}
                    {detailBooking.phone && (
                      <DetailRow icon={<Phone className="h-4 w-4 text-muted" />} label="Phone" value={detailBooking.phone} />
                    )}
                  </div>
                </div>
              )}

              {/* Reason for cancellation — why this booking was cancelled */}
              {detailBooking.status.toLowerCase() === "cancelled" && detailBooking.cancellation_reason && (
                <div className="mb-5">
                  <h4 className="text-sm font-semibold text-ink mb-2">Reason for cancellation</h4>
                  <div className="rounded-[10px] border border-hairline bg-gray-50 p-4 text-sm text-muted">
                    {detailBooking.cancellation_reason}
                  </div>
                </div>
              )}

              {/* Payment Details */}
              <div className="space-y-3 mb-5">
                <h4 className="text-sm font-semibold text-ink">Payment Details</h4>
                <div className="bg-gray-50 rounded-[10px] p-4 space-y-2.5">
                  <DetailRow label="Payment Method" value={formatPaymentMethod(detailBooking.payment_method, "N/A")} />
                  <DetailRow
                    label="Booking Date"
                    value={new Date(detailBooking.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  />
                  <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-gray-200">
                    <span className="text-sm font-semibold text-ink">Total Amount</span>
                    <span className="flex items-center justify-end gap-2">
                      <span className="tabular-nums text-lg font-display font-bold" style={{ color: PRIMARY }}>
                        ₱{detailBooking.total_price.toLocaleString()}
                      </span>
                      {(() => {
                        const balance = Math.max(0, (detailBooking.total_price ?? 0) - (detailBooking.amount_paid ?? 0))
                        const badge = detailBooking.refunded_at
                          ? null
                          : detailBooking.status.toLowerCase() === "pending"
                            ? { text: "Unpaid", cls: "bg-amber-50 text-amber-700 border-amber-200" }
                            : detailBooking.payment_mode === "downpayment" && balance > 0
                              ? { text: "Partially paid", cls: "bg-amber-50 text-amber-700 border-amber-200" }
                              : { text: "Paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                        return badge ? (
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}>{badge.text}</span>
                        ) : null
                      })()}
                    </span>
                  </div>
                  {detailBooking.payment_mode === "downpayment" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">Paid online (50%)</span>
                      <span className="tabular-nums text-sm font-semibold text-ink">
                        ₱{Math.max(0, detailBooking.amount_paid ?? 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {detailBooking.payment_mode === "downpayment" &&
                    Math.max(0, (detailBooking.total_price ?? 0) - (detailBooking.amount_paid ?? 0)) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">Balance due at the hotel</span>
                      <span className="tabular-nums text-sm font-semibold text-ink">
                        ₱{Math.max(0, detailBooking.total_price - (detailBooking.amount_paid ?? 0)).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setReceiptOpen(true)}
                    className="mt-3 w-full !rounded-[8px] gap-2"
                  >
                    View Receipt
                  </Button>
                </div>
              </div>

              {/* Refund notice — the money went back after a cancellation */}
              {detailBooking.refunded_at && (
                <div className="mb-5 flex items-start gap-2 rounded-[10px] border border-[#3D6B4F]/30 bg-[#3D6B4F]/5 px-4 py-3">
                  <CheckCircle className="mt-0.5 size-4 shrink-0 text-[#3D6B4F]" />
                  <span className="text-sm font-medium text-[#3D6B4F]">
                    Refunded to your original payment method on{" "}
                    {new Date(detailBooking.refunded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    . Please allow 7–14 banking days.
                  </span>
                </div>
              )}

              {/* Special Requests */}
              {detailBooking.special_requests && (
                <div className="space-y-3 mb-5">
                  <h4 className="text-sm font-semibold text-ink">Special Requests</h4>
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
                    {paying === detailBooking.id ? "Redirecting…" : "Pay Now"}
                  </Button>
                )}
                {/* Extend only makes sense once the guest is actually in the room —
                    never for a booking that hasn't started yet. */}
                {detailBooking.status.toLowerCase() === "confirmed" &&
                  deriveArrival(detailBooking) === "in_house" &&
                  detailBooking.end_time &&
                  new Date(detailBooking.end_time).getTime() > Date.now() &&
                  (detailBooking.extended_hours ?? 0) <= 0 && (
                    <Button
                      variant="outline"
                      onClick={() => { setDetailOpen(false); setExtendDialog({ id: detailBooking.id, hours: 1 }) }}
                      className="flex-1 !rounded-[8px]"
                      style={{ borderColor: PRIMARY, color: PRIMARY }}
                    >
                      Extend Stay
                    </Button>
                  )}
              </div>

              {/* Cancel — quiet red text link, only while cancellation is allowed */}
              {(detailBooking.status.toLowerCase() === "confirmed" || detailBooking.status.toLowerCase() === "pending") &&
                canCancel(detailBooking) && (
                  <div className="pt-3 text-center">
                    <button
                      type="button"
                      onClick={() => { resetCancelReason(); setDetailOpen(false); setCancelDialog({ open: true, id: detailBooking.id }) }}
                      disabled={cancelling === detailBooking.id}
                      className="cursor-pointer text-sm font-medium text-[#dc2626] transition-colors hover:text-[#b91c1c] hover:underline disabled:opacity-50"
                    >
                      {cancelling === detailBooking.id ? "Cancelling…" : "Cancel this booking"}
                    </button>
                  </div>
                )}
            </div>
          ) : null}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Official receipt for the open booking ────────────────────── */}
      {detailBooking && (
        <ReceiptDialog
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          data={receiptFor(detailBooking)}
        />
      )}

      {/* Extend stay: pick hours → PayMongo checkout */}
      <Dialog open={!!extendDialog.id} onOpenChange={(open) => { if (!open) setExtendDialog({ id: null, hours: 1 }) }}>
        <DialogContent className="!rounded-[16px] !max-w-[440px] !p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-hairline">
            <DialogTitle>Extend Your Stay</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-5">
            {(() => {
              const bk = detailBooking?.id === extendDialog.id ? detailBooking : bookings.find((b) => b.id === extendDialog.id)
              const price = Math.max(1, Math.round(((bk?.room_price ?? 0) * extendDialog.hours) / 24))
              const endIso = bk?.end_time ?? null
              const newEnd = endIso ? new Date(new Date(endIso).getTime() + extendDialog.hours * 3600000) : null
              return (
                <>
                  <p className="text-sm text-muted">
                    Add hours to {bk?.room_name || "your room"}
                    {endIso ? ` — stay currently ends ${formatTimeLabel(endIso)}.` : "."}
                  </p>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">How many hours?</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setExtendDialog((p) => ({ ...p, hours: h }))}
                          className={`py-2 rounded-[8px] text-sm font-medium border transition ${
                            extendDialog.hours === h ? "text-white border-transparent" : "bg-white text-ink border-hairline hover:border-gray-300"
                          }`}
                          style={extendDialog.hours === h ? { backgroundColor: PRIMARY } : undefined}
                        >
                          +{h}h
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-[10px] p-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted">New end time</span>
                      <span className="font-medium text-ink">{newEnd ? formatTimeLabel(newEnd.toISOString()) : "—"}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                      <span className="font-semibold text-ink">Extension fee</span>
                      <span className="text-lg font-display font-bold" style={{ color: PRIMARY }}>
                        ₱{price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleExtend}
                    disabled={extending === extendDialog.id}
                    className="w-full !rounded-[8px]"
                    style={{ backgroundColor: PRIMARY, color: CANVAS }}
                  >
                    {extending === extendDialog.id ? (
                      <LoadingDots size="sm" className="mr-2" />
                    ) : (
                      <CreditCard className="h-4 w-4 mr-2" />
                    )}
                    {extending === extendDialog.id ? "Redirecting…" : "Continue to Payment"}
                  </Button>
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Extension blocked: next booking too close → suggest other rooms */}
      <Dialog open={conflictDialog.open} onOpenChange={(open) => setConflictDialog((p) => ({ ...p, open }))}>
        <DialogContent className="!rounded-[16px] !max-w-[460px] !p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-hairline">
            <DialogTitle>Can't Extend This Stay</DialogTitle>
          </DialogHeader>
          <div className="p-6 space-y-4">
            <p className="text-sm text-muted">{conflictDialog.error}</p>
            {conflictDialog.next && (
              <p className="text-sm text-ink">
                The next booking for this room starts{" "}
                <span className="font-medium">
                  {new Date(conflictDialog.next).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </span>
                .
              </p>
            )}
            {conflictDialog.rooms.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Rooms available instead</p>
                {conflictDialog.rooms.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-[10px] p-3">
                    <img
                      src={r.image || "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=300&fit=crop"}
                      alt={r.name}
                      className="w-12 h-12 rounded-[8px] object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{r.name}</p>
                      <p className="text-xs text-muted">
                        {r.type} · ₱{Number(r.price || 0).toLocaleString()}/night
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="!rounded-[8px] shrink-0"
                      onClick={() => { setConflictDialog({ open: false, error: "", rooms: [] }); navigate(`/rooms/${r.id}`) }}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="w-full !rounded-[8px]"
              onClick={() => setConflictDialog({ open: false, error: "", rooms: [] })}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={cancelDialog.open}
        onOpenChange={(open) => setCancelDialog({ open, id: cancelDialog.id })}
        title="Cancel Booking?"
        description={
          <div className="text-left">
            <p className="mb-2 font-medium text-ink">Cancellation policy</p>
            <ul className="mb-3 space-y-1">
              <li className="text-[13px]">
                <span className="font-medium text-ink">24h+ before check-in</span> — full refund, 7–14 banking days.
              </li>
              <li className="text-[13px]">
                <span className="font-medium text-ink">Within 24h or no-show</span> — no refund.
              </li>
              <li className="text-[13px]">
                <span className="font-medium text-ink">Already checked in</span> — contact the front desk.
              </li>
            </ul>
            <p className="mb-3 text-[13px] text-muted">This action cannot be undone.</p>
            <div className="border-t border-hairline pt-3">
              <p className="mb-2 text-[13px] font-medium text-ink">Reason for cancellation</p>
              <CancelReasonPicker
                selected={cancelReason}
                otherText={cancelReasonOther}
                error={cancelReasonError}
                onSelect={(v) => { setCancelReason(v); setCancelReasonError(false) }}
                onOtherChange={setCancelReasonOther}
              />
            </div>
          </div>
        }
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Booking"
        variant="danger"
        loading={!!cancelling}
        onConfirm={() => {
          if (!cancelDialog.id) return
          const reason = composeCancelReason(cancelReason, cancelReasonOther)
          if (!reason) { setCancelReasonError(true); return }
          handleCancel(cancelDialog.id, reason)
        }}
      />

      {/* Review modal — from the banner or a booking's "Rate & Review" button */}
      <ReviewModal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        bookingId={reviewTarget?.id ?? ""}
        roomName={reviewTarget?.room_name ?? ""}
        roomImage={reviewTarget?.room_image}
        stayLabel={
          reviewTarget
            ? formatDateRange(reviewTarget.check_in, reviewTarget.check_out, reviewTarget.stay_type)
            : undefined
        }
        onSaved={(rating) => {
          const id = reviewTarget?.id
          if (!id) return
          setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, reviewed: true, rating } : b)))
          setDetailBooking((prev) => (prev?.id === id ? { ...prev, reviewed: true, rating } : prev))
        }}
      />
    </div>
  )
}

/* ── Loading & Error States ─────────────────────────────────────────────── */

/** Suggested list skeleton — matches the card chrome of the real booking list. */
function MyBookingsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-lg">
        <SkeletonLine className="h-8 w-40" />
        <SkeletonLine className="mt-2 h-4 w-28" />
      </div>
      <div className="space-y-md">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-hairline rounded-[12px] p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 space-y-2">
                <SkeletonLine className="h-5 w-32" />
                <SkeletonLine className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="flex gap-4">
              <SkeletonLine className="h-3 w-28" />
              <SkeletonLine className="h-3 w-16" />
              <SkeletonLine className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function MyBookingsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-section text-center">
      <h2 className="typo-title-md text-ink mb-xs">Couldn't load your bookings</h2>
      <p className="typo-body-sm text-muted mb-lg">
        Something went wrong while fetching your reservations. Please try again.
      </p>
      <Button
        onClick={onRetry}
        className="!rounded-[8px] px-6"
        style={{ backgroundColor: PRIMARY, color: CANVAS }}
      >
        <RotateCcw className="h-4 w-4 mr-1.5" />
        Try again
      </Button>
    </div>
  )
}

/* ── Detail Row Component ──────────────────────────────────────────────── */

/** '+2h · Oct 6, 2026 2:14 PM' — or '+1h · awaiting payment' while PayMongo confirms. */
function extensionInfo(b: UserBookingData): { value: string; valueClass?: string } | null {
  if (b.status.toLowerCase() === "cancelled") return null
  const pending = b.payment_method?.startsWith("extend:") ? Number(b.payment_method.split(":")[2]) : null
  if (pending !== null && Number.isFinite(pending) && pending > 0) {
    return { value: `+${pending}h · awaiting payment`, valueClass: "font-medium text-amber-700" }
  }
  const hours = b.extended_hours ?? 0
  if (hours <= 0) return null
  const at = b.extended_at
    ? new Date(b.extended_at).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : ""
  return { value: at ? `+${hours}h · ${at}` : `+${hours}h` }
}

function DetailRow({ icon, label, value, valueClass }: { icon?: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-ink/70">
        {icon}
        {label}
      </span>
      <span className={cn("text-sm font-medium text-right", valueClass ?? "text-ink")}>{value}</span>
    </div>
  )
}
