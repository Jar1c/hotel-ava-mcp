import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { bookingsApi, ApiError } from "@/services/api"
import { useToast } from "@/contexts/ToastContext"
import type { Booking } from "@/data/admin"
import LoadingDots from "@/components/LoadingDots"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import ReceiptDialog, { type ReceiptData } from "@/components/ReceiptDialog"
import { Mail, Phone, CalendarDays, PhilippinePeso, User, Clock, BedDouble, CreditCard, FileText, Landmark, LogIn, LogOut, Search, X, CheckCircle } from "lucide-react"
import { getStoredAvatar, getGeneratedAvatar, onAvatarError } from "@/lib/avatar"
import { formatPaymentMethod, downpaymentOnline } from "@/lib/payment"
import { deriveArrival, canCheckIn, arrivalTimeLabel, startMomentLabel, checkoutMomentLabel } from "@/lib/arrival"
import { Skeleton, SkeletonRegion, SkeletonTableRow } from "@/components/ui/skeleton"
import { useMinSkeleton } from "@/hooks/useMinSkeleton"
import Pagination from "@/components/admin/Pagination"
import CancelReasonPicker, { composeCancelReason } from "@/components/CancelReasonPicker"

type BookingStatus = "confirmed" | "pending" | "completed" | "cancelled" | "checked-out"
/** What the row shows: a stay that is running reads as In-house, not Confirmed. */
type DisplayStatus = BookingStatus | "in-house"
type RowAction = BookingStatus | "check-in" | "refund-auto" | "refund-manual"

const PAGE_SIZE = 10

interface BookingsTableProps {
  bookings: Booking[]
  showFilters?: boolean
  loading?: boolean
  onStatusChange?: () => void
  /** Deep-link filter from ?status= / ?view= — re-applied when the URL changes. */
  initialFilter?: string
}

const statusConfig: Record<DisplayStatus, { label: string; dotColor: string; textColor: string }> = {
  confirmed: { label: "Confirmed", dotColor: "bg-[#3D6B4F]", textColor: "text-[#3D6B4F]" },
  pending: { label: "Pending", dotColor: "bg-[#B5AC97]", textColor: "text-[#B5AC97]" },
  completed: { label: "Completed", dotColor: "bg-[#b0b3b8]", textColor: "text-[#9ca3af]" },
  cancelled: { label: "Cancelled", dotColor: "bg-[#A4423A]", textColor: "text-[#A4423A]" },
  "checked-out": { label: "Checked Out", dotColor: "bg-[#b0b3b8]", textColor: "text-[#9ca3af]" },
  "in-house": { label: "In-house", dotColor: "bg-[#2f7d6d]", textColor: "text-[#2f7d6d]" },
}

const statusFilters: { label: string; value: DisplayStatus | "all" | "refunded" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "In-house", value: "in-house" },
  { label: "Completed", value: "completed" },
  { label: "Checked Out", value: "checked-out" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
]

/**
 * Derived filters — deep-link targets from the dashboard cards
 * (?view=arrivals|departures|overdue|extending|refunds|unpaid|downpayment).
 * Computed client-side from the already-fetched list; no extra API calls.
 */
const viewFilters = {
  arrivals: "Arrivals today",
  departures: "Departures today",
  overdue: "Overdue check-outs",
  extending: "Extend requests",
  refunds: "Refunds",
  unpaid: "Unpaid",
  downpayment: "Downpayment balances",
} as const

type ViewKey = keyof typeof viewFilters
type FilterValue = DisplayStatus | "all" | ViewKey | "refunded"

function isViewKey(value: FilterValue): value is ViewKey {
  return Object.prototype.hasOwnProperty.call(viewFilters, value)
}

function sanitizeFilter(value?: string | null): FilterValue {
  const known = new Set<string>([
    ...statusFilters.map((f) => f.value),
    ...Object.keys(viewFilters),
  ])
  return value && known.has(value) ? (value as FilterValue) : "all"
}

/** Today as the browser's YYYY-MM-DD (the front desk runs on hotel time). */
function localISODate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** Mirrors the exact-count predicates in _build_dashboard_summary(). */
function matchesView(b: Booking, view: ViewKey, now: Date): boolean {
  const counted = ["confirmed", "checked-out", "completed"].includes(b.status)
  switch (view) {
    case "arrivals":
      return counted && b.checkIn.slice(0, 10) === localISODate(now)
    case "departures":
      return counted && b.checkOut.slice(0, 10) === localISODate(now)
    case "overdue":
      return b.status === "confirmed" && Boolean(b.checked_in_at) && deriveArrival(b, now) === "ended"
    case "extending":
      return (b.payment_method ?? "").startsWith("extend:")
    case "refunds":
      return b.status === "cancelled" && (b.amount_paid ?? 0) > 0 && !b.refunded_at
    case "unpaid":
      return b.status === "pending"
    case "downpayment":
      return (
        ["confirmed", "completed"].includes(b.status) &&
        isDownpayment(b) &&
        bookingBalance(b) > 0
      )
  }
}

type SortKey = "newest" | "oldest" | "soonest" | "latest" | "amountDesc" | "amountAsc" | "guest"

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest booked" },
  { value: "oldest", label: "Oldest booked" },
  { value: "soonest", label: "Stay · soonest first" },
  { value: "latest", label: "Stay · latest first" },
  { value: "amountDesc", label: "Amount · high to low" },
  { value: "amountAsc", label: "Amount · low to high" },
  { value: "guest", label: "Guest name · A to Z" },
]

const sorters: Record<SortKey, (a: Booking, b: Booking) => number> = {
  newest: (a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""),
  oldest: (a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""),
  soonest: (a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""),
  latest: (a, b) => (b.checkIn || "").localeCompare(a.checkIn || ""),
  amountDesc: (a, b) => (b.amount ?? 0) - (a.amount ?? 0),
  amountAsc: (a, b) => (a.amount ?? 0) - (b.amount ?? 0),
  guest: (a, b) => a.guestName.localeCompare(b.guestName),
}

/**
 * The status the table filters and counts by. In-house stays are split out of
 * Confirmed so the front desk can see who is actually in the building; an
 * arrival that is still waiting for its start time stays under Confirmed.
 */
function displayStatus(b: Booking, now?: Date): DisplayStatus {
  return deriveArrival(b, now) === "in_house" ? "in-house" : b.status
}

/** Badge for the row — also surfaces "Arrived" for an early check-in. */
function badgeFor(b: Booking, now?: Date) {
  const state = deriveArrival(b, now)
  if (state === "early") {
    return { label: "Arrived", dotColor: "bg-amber-500", textColor: "text-amber-600" }
  }
  return statusConfig[displayStatus(b, now)]
}

/** One line summarising where the guest is in the arrival flow. */
function arrivalLabel(b: Booking, now: Date) {
  const state = deriveArrival(b, now)
  const start = startMomentLabel(b)
  if (state === "none") return start ? `Not checked in · starts ${start}` : "Not checked in"
  const at = arrivalTimeLabel(b.checked_in_at)
  if (state === "early") return `Arrived ${at} · starts ${start}`
  if (state === "in_house") return `In-house since ${start || at}`
  return at ? `Checked in ${at}` : "Never checked in"
}

function formatBookingDate(dateStr: string) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatPaymentLabel(method: string) {
  return formatPaymentMethod(method, "Not set")
}

/** 'extend:<session>:<hours>:<orig>' -> hours, while a paid extension awaits payment. */
function pendingExtendHours(paymentMethod?: string): number | null {
  if (!paymentMethod?.startsWith("extend:")) return null
  const hours = Number(paymentMethod.split(":")[2])
  return Number.isFinite(hours) && hours > 0 ? hours : null
}

/** Extension row value — pending first, then the applied record. */
function extensionInfo(b: Booking): { value: string; valueClass?: string } | null {
  if (b.status === "cancelled") return null
  const pending = pendingExtendHours(b.payment_method)
  if (pending !== null) {
    return { value: `+${pending}h · awaiting payment`, valueClass: "font-medium text-[#b45309]" }
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

/** ArrivalBooking-shaped view of an admin row — feeds checkoutMomentLabel. */
function stayArrival(b: Booking) {
  return {
    stay_type: b.stay_type,
    check_in: b.checkIn,
    check_out: b.checkOut,
    start_time: b.start_time,
    duration: b.duration,
  }
}

/** Compact row line under the checkout time: applied vs awaiting payment. */
function rowExtension(b: Booking): { label: string; cls: string } | null {
  if (b.status === "cancelled") return null
  const pending = pendingExtendHours(b.payment_method)
  if (pending !== null) return { label: `+${pending}h · awaiting payment`, cls: "text-[#b45309]" }
  const hours = b.extended_hours ?? 0
  if (hours <= 0) return null
  return { label: `+${hours}h extended`, cls: "text-[#82285f]" }
}

function bookingBalance(b: { amount: number; amount_paid?: number }) {
  return Math.max(0, (b.amount ?? 0) - (b.amount_paid ?? 0))
}

function isDownpayment(b: Booking) {
  return b.payment_mode === "downpayment"
}

/**
 * Refund state shown under the status badge — refunded bookings must be
 * distinguishable from refunds still sitting in the queue. The pending
 * branch mirrors the ?view=refunds predicate exactly.
 */
function refundBadge(b: Booking): { label: string; cls: string } | null {
  if (b.refunded_at) return { label: "Refunded", cls: "bg-[#3D6B4F]/10 text-[#3D6B4F]" }
  if (b.status === "cancelled" && (b.amount_paid ?? 0) > 0)
    return { label: "Refund pending", cls: "bg-amber-500/10 text-[#b45309]" }
  return null
}

function paymentNote(b: Booking) {
  if (b.refunded_at) return "Refunded"
  if (b.status === "pending") return isDownpayment(b) ? "Awaiting downpayment" : "Awaiting payment"
  if (b.status === "cancelled") return "Cancelled"
  if (b.status === "confirmed" || b.status === "completed" || b.status === "checked-out") {
    return isDownpayment(b)
      ? bookingBalance(b) > 0
        ? "Downpayment · balance due"
        : "Downpayment · paid in full"
      : "Paid"
  }
  return "—"
}

/** Normalise an admin booking row into the shared receipt shape. */
function receiptFor(b: Booking): ReceiptData {
  const isDay = b.stay_type === "day"
  const nights = Math.max(1, b.nights || 1)
  // The API puts the room *name* in roomNumber and the room *type* in roomType,
  // so lead with the name — the same order the guest receipt uses.
  const roomName = b.roomNumber || b.roomType
  const roomType = b.roomNumber && b.roomType && b.roomNumber !== b.roomType ? b.roomType : undefined
  const down = isDownpayment(b)
  const cancelled = b.status === "cancelled"
  const refunded = Boolean(b.refunded_at)
  // Refunds zero amount_paid — the receipt still shows what was collected,
  // and a cancelled stay never owes a balance at the hotel.
  const amountPaid = down ? (refunded ? downpaymentOnline(b.amount) : Math.max(0, b.amount_paid ?? 0)) : b.amount
  const balance = down && !cancelled && !refunded ? bookingBalance(b) : 0
  return {
    reference: (b.fullId || b.id).slice(0, 8).toUpperCase(),
    fullReference: b.fullId || b.id,
    issuedAt: b.createdAt || null,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestPhone: b.phone,
    roomName,
    roomDetail: roomType,
    checkInLabel: formatBookingDate(b.checkIn),
    checkOutLabel: isDay ? undefined : formatBookingDate(b.checkOut),
    stayLabel:
      isDay && b.duration
        ? `Day use · ${b.duration} hours${b.start_time ? ` from ${b.start_time}` : ""}`
        : `${nights} night${nights === 1 ? "" : "s"}`,
    guests: b.guests,
    total: b.amount,
    // The room rate isn't on this row, so the receipt shows the charge without a rate line.
    gross: null,
    itemLabel: isDay ? `${roomName} · day use` : `${roomName} × ${nights} night${nights === 1 ? "" : "s"}`,
    paymentMethod: formatPaymentLabel(b.payment_method || ""),
    paymentStatus: paymentNote(b),
    paymentMode: down ? "downpayment" : "full",
    amountPaid,
    balanceDue: balance,
    refundedAt: b.refunded_at ?? null,
  }
}

export default function BookingsTable({ bookings, showFilters = true, loading, onStatusChange, initialFilter }: BookingsTableProps) {
  const [filter, setFilter] = useState<FilterValue>(() => sanitizeFilter(initialFilter))
  const [query, setQuery] = useState("")
  const [roomFilter, setRoomFilter] = useState("")
  const [sort, setSort] = useState<SortKey>("newest")
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ bookingId: string; bookingIdShort: string; action: RowAction; label: string; amountPaid: number } | null>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelReasonOther, setCancelReasonOther] = useState("")
  const [cancelReasonError, setCancelReasonError] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  // Arrival is derived from the clock — re-render so "Arrived" flips to
  // "In-house" on its own when the booked time passes.
  const [now, setNow] = useState(() => new Date())
  const { toast } = useToast()

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // A deep-link from the dashboard (?view= / ?status=) re-applies when the URL
  // changes — the filter state alone only sees the first render.
  useEffect(() => {
    setFilter(sanitizeFilter(initialFilter))
  }, [initialFilter])

  // Room names present in the data — drives the room dropdown.
  const rooms = useMemo(
    () => Array.from(new Set(bookings.map((b) => b.roomType).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [bookings],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = bookings
      .filter((b) => {
        if (filter === "all") return true
        if (filter === "refunded") return Boolean(b.refunded_at)
        if (isViewKey(filter)) return matchesView(b, filter, now)
        return displayStatus(b, now) === filter
      })
      .filter((b) => !roomFilter || b.roomType === roomFilter)
      .filter((b) => {
        if (!q) return true
        return [b.guestName, b.guestEmail, b.id, b.fullId, b.roomType, b.roomNumber, b.phone]
          .filter((v): v is string => Boolean(v))
          .some((v) => v.toLowerCase().includes(q))
      })
    return rows.sort(sorters[sort])
  }, [bookings, filter, roomFilter, query, sort, now])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [filter, query, roomFilter, sort])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openBooking = (booking: Booking) => {
    setSelectedBooking(booking)
    setModalOpen(true)
  }

  async function handleStatusChange(bookingId: string, newStatus: RowAction, reason?: string) {
    if (!bookingId) return
    const isRefund = newStatus === "refund-auto" || newStatus === "refund-manual"
    try {
      setActingId(bookingId)
      if (newStatus === "check-in") {
        await bookingsApi.checkIn(bookingId)
      } else if (isRefund) {
        await bookingsApi.refund(bookingId, newStatus === "refund-auto" ? "auto" : "manual")
      } else {
        await bookingsApi.updateStatus(bookingId, newStatus, reason)
      }
      // Refund success announces itself through the backend's in-app
      // notification ("Refund Processed · Tap to view") — a second toast here
      // only duplicated it.
      onStatusChange?.()
    } catch (err) {
      toast({
        title: isRefund
          ? "Couldn't process the refund"
          : newStatus === "check-in"
            ? "Couldn't check this guest in"
            : "Couldn't update this booking",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setActingId(null)
      setConfirmAction(null)
      setModalOpen(false)
    }
  }

  function openConfirm(booking: Booking, action: RowAction, label: string) {
    const bid = booking.fullId || booking.id
    setConfirmAction({
      bookingId: bid,
      bookingIdShort: booking.id,
      action,
      label,
      amountPaid: booking.amount_paid ?? 0,
    })
    setCancelReason("")
    setCancelReasonOther("")
    setCancelReasonError(false)
    setModalOpen(false)
  }

  function getActions(booking: Booking, now: Date) {
    const bid = booking.fullId || booking.id
    const actions: { label: string; action: RowAction; style: string }[] = []
    const state = deriveArrival(booking, now)

    if (booking.status === "pending") {
      actions.push({ label: "Confirm", action: "confirmed", style: "bg-[#3D6B4F] text-white hover:bg-[#2d5a3e]" })
    } else if (booking.status === "confirmed") {
      if (state === "none") {
        // Not at the hotel yet — no cancelling once they show up either.
        // Cancellation itself belongs to the guest (My Bookings).
        if (canCheckIn(booking, now)) {
          actions.push({ label: "Check In", action: "check-in", style: "bg-[#3D6B4F] text-white hover:bg-[#2d5a3e]" })
        }
      } else if (state === "in_house") {
        // In the building: cancellations are blocked server-side from here on.
        actions.push({ label: "Check Out", action: "checked-out", style: "bg-[#82285f] text-white hover:bg-[#6d204f]" })
      }
      // "early" = arrived, waiting for the booked time — nothing to do yet.
      // "ended"  = auto-complete will close it out on the next page load.
    }

    return actions.map((a) => (
      <button
        key={a.action}
        disabled={actingId === bid}
        onClick={(e) => {
          e.stopPropagation()
          openConfirm(booking, a.action, a.label)
        }}
        className={cn(
          "px-2.5 py-1 rounded-[4px] text-[10px] font-semibold transition-all duration-150",
          actingId === bid ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          a.style
        )}
      >
        {actingId === bid ? "…" : a.label}
      </button>
    ))
  }

  // Summary counts
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => displayStatus(b, now) === "confirmed").length,
    "in-house": bookings.filter((b) => displayStatus(b, now) === "in-house").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    "checked-out": bookings.filter((b) => b.status === "checked-out").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    refunded: bookings.filter((b) => Boolean(b.refunded_at)).length,
  }

  // Skeletons stay at least 500ms so a fast refetch can't flash them.
  const showSkeleton = useMinSkeleton(Boolean(loading))
  const selectedRefund = selectedBooking ? refundBadge(selectedBooking) : null

  return (
    <>
      <SkeletonRegion
        loading={showSkeleton}
        wrapperClassName="rounded-[6px] bg-white border border-[#e2e4e8] flex h-[708px] flex-col"
        className="flex min-h-0 flex-1 flex-col"
      >
        {showSkeleton ? (
          <>
            {showFilters && (
              <div className="flex items-center gap-2 border-b border-[#e2e4e8] px-5 py-3 shrink-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-[4px]" />
                ))}
              </div>
            )}
            {showFilters && (
              <div className="flex items-center justify-between gap-3 border-b border-[#e2e4e8] px-5 py-2.5 shrink-0">
                <Skeleton className="h-7 w-64 rounded-[5px]" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-24 rounded-[5px]" />
                  <Skeleton className="h-7 w-36 rounded-[5px]" />
                </div>
              </div>
            )}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <TableHeadRow />
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonTableRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#e2e4e8] px-5 py-3">
              <Skeleton className="h-8 w-56" />
            </div>
          </>
        ) : (
          <>
        {showFilters && (
          <div className="flex items-center justify-between border-b border-[#e2e4e8] px-5 py-3 shrink-0">
            <div className="flex items-center gap-2">
              {statusFilters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-[4px] px-2.5 py-1 text-[10px] font-semibold transition-all duration-200",
                    filter === f.value
                      ? "bg-[#82285f] text-white"
                      : "bg-[#f5f6f8] text-[#6b7280] hover:bg-[#e2e4e8]"
                  )}
                >
                  {f.label}
                  {counts[f.value] > 0 && (
                    <span className={cn(
                      "ml-1 text-[9px]",
                      filter === f.value ? "text-white/70" : "text-[#9ca3af]"
                    )}>
                      {counts[f.value]}
                    </span>
                  )}
                </button>
              ))}
              {isViewKey(filter) && (
                <button
                  type="button"
                  onClick={() => setFilter(filter)}
                  className="rounded-[4px] bg-[#82285f] px-2.5 py-1 text-[10px] font-semibold text-white transition-all duration-200"
                >
                  {viewFilters[filter]}
                </button>
              )}
            </div>
            <div className="text-[11px] text-[#9ca3af]">
              {filtered.length} {filtered.length === 1 ? "booking" : "bookings"}
            </div>
          </div>
        )}

        {/* Search / room filter / sort */}
        {showFilters && (
          <div className="flex items-center justify-between gap-3 border-b border-[#e2e4e8] px-5 py-2.5 shrink-0 flex-wrap">
            <div className="relative w-full max-w-[300px] min-w-[180px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, booking ID, room…" aria-label="Search bookings"
                className="w-full rounded-[5px] border border-[#e2e4e8] bg-white py-1.5 pl-8 pr-7 text-[11px] text-[#1a1d26] placeholder:text-[#9ca3af] focus:border-[#82285f] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  title="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[#9ca3af] transition-colors hover:text-[#6b7280]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                title="Filter by room"
                className="rounded-[5px] border border-[#e2e4e8] bg-white px-2.5 py-1.5 text-[11px] text-[#6b7280] focus:border-[#82285f] focus:outline-none cursor-pointer"
              >
                <option value="">All rooms</option>
                {rooms.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                title="Sort bookings"
                className="rounded-[5px] border border-[#e2e4e8] bg-white px-2.5 py-1.5 text-[11px] text-[#6b7280] focus:border-[#82285f] focus:outline-none cursor-pointer"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead>
              <TableHeadRow />
            </thead>
            <tbody>
              {paged.map((booking) => {
                const status = badgeFor(booking, now)
                const refund = refundBadge(booking)
                const actions = getActions(booking, now)
                return (
                  <tr
                    key={booking.id}
                    onClick={() => openBooking(booking)}
                    className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150 cursor-pointer group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getStoredAvatar(booking.guestAvatar) || getGeneratedAvatar(booking.guestEmail || booking.guestName)}
                          alt={booking.guestName}
                          onError={(e) => onAvatarError(e, booking.guestEmail || booking.guestName)}
                          className="size-8 rounded-full object-cover"
                        />
                        <div>
                          <div className="font-medium text-[#1a1d26] group-hover:text-[#82285f] transition-colors">{booking.guestName}</div>
                          {booking.guestEmail && <div className="text-[11px] text-[#9ca3af]">{booking.guestEmail}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#6b7280] font-mono text-[11px]">#{booking.id}</td>
                    <td className="px-5 py-3 text-[#6b7280] text-[11px]">{formatBookingDate(booking.createdAt || "")}</td>
                    <td className="px-5 py-3 text-[#6b7280] text-[11px]">
                      <div>{booking.checkIn}</div>
                      {booking.stay_type === "day" && booking.start_time && booking.duration ? (
                        <div className="text-[10px] text-[#82285f] font-medium mt-0.5">
                          {booking.start_time} · {booking.duration}h
                        </div>
                      ) : booking.checkOut && booking.checkOut !== booking.checkIn ? (
                        <div className="text-[10px] text-[#9ca3af] mt-0.5">to {booking.checkOut}</div>
                      ) : null}
                      {(() => {
                        const time = checkoutMomentLabel(stayArrival(booking)).split("·").pop()?.trim()
                        return time ? <div className="text-[10px] text-[#6b7280] mt-0.5">→ {time}</div> : null
                      })()}
                      {(() => {
                        const ext = rowExtension(booking)
                        return ext ? (
                          <div className={cn("text-[10px] font-medium mt-0.5", ext.cls)}>{ext.label}</div>
                        ) : null
                      })()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-[4px] bg-[#f5f6f8] flex items-center justify-center text-[9px] font-bold text-[#9ca3af]">
                          {booking.roomType?.charAt(0)}
                        </div>
                        <span className="text-[#1a1d26]">{booking.roomType}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {booking.stay_type === "day" && booking.duration ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#82285f] bg-[#82285f]/5 px-1.5 py-0.5 rounded">
                          Day Use · {booking.duration}h
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#6b7280]">{booking.nights} night{booking.nights !== 1 ? "s" : ""}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-[#1a1d26]">
                      ₱{booking.amount.toLocaleString()}
                      {booking.status !== "cancelled" && isDownpayment(booking) && bookingBalance(booking) > 0 && (
                        <div className="text-[10px] font-medium text-[#b45309] mt-0.5">
                          50% paid · ₱{bookingBalance(booking).toLocaleString()} due
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", status.textColor)}>
                        <span className={cn("size-1.5 rounded-full", status.dotColor)} />
                        {status.label}
                      </span>
                      {refund && (
                        <span className={cn("mt-1 block w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold", refund.cls)}>
                          {refund.label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {actions.length > 0 ? actions : <span className="text-[10px] text-[#9ca3af]">—</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-[#9ca3af]">
                    {query || roomFilter || filter !== "all"
                      ? "No bookings match your search."
                      : "No bookings found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </SkeletonRegion>

      {/* ── Booking Detail Modal ──────────────────────────────── */}
      <Dialog
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open)
          if (!open) setReceiptOpen(false)
        }}
      >
        <DialogContent className="!rounded-[16px] !max-w-[460px] !p-0 overflow-hidden">
          {selectedBooking && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e2e4e8]">
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#82285f]" />
                  Booking Details
                </DialogTitle>
              </DialogHeader>

              <div className="p-6 max-h-[70vh] overflow-y-auto">
                {/* Guest Header */}
                <div className="flex items-center gap-4 mb-6">
                  <img
                    src={getStoredAvatar(selectedBooking.guestAvatar) || getGeneratedAvatar(selectedBooking.guestEmail || selectedBooking.guestName)}
                    alt={selectedBooking.guestName}
                    onError={(e) => onAvatarError(e, selectedBooking.guestEmail || selectedBooking.guestName)}
                    className="size-14 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-display font-semibold text-[#1a1d26] text-lg">{selectedBooking.guestName}</h3>
                    <span className="inline-flex flex-wrap items-center gap-2 mt-0.5">
                      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", badgeFor(selectedBooking, now).textColor)}>
                        <span className={cn("size-1.5 rounded-full", badgeFor(selectedBooking, now).dotColor)} />
                        {badgeFor(selectedBooking, now).label}
                      </span>
                      {selectedRefund && (
                        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", selectedRefund.cls)}>
                          {selectedRefund.label}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Guest Profile */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Guest Profile</h4>
                  <div className="bg-[#f5f6f8] rounded-[10px] p-4 space-y-3">
                    <DetailRow icon={<User className="h-4 w-4" />} label="Name" value={selectedBooking.guestName} />
                    <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedBooking.guestEmail || "Not provided"} />
                    {selectedBooking.phone ? (
                      <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={selectedBooking.phone} />
                    ) : null}
                    {selectedBooking.guestId ? (
                      <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Guest ID" value={selectedBooking.guestId.slice(0, 8) + "…"} />
                    ) : null}
                  </div>
                </div>

                {/* Cancellation reason — why this booking was cancelled */}
                {selectedBooking.status === "cancelled" && selectedBooking.cancellation_reason && (
                  <div className="space-y-3 mb-6">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Cancellation Reason</h4>
                    <div className="rounded-[10px] border border-[#e2e4e8] bg-[#f5f6f8] p-4 text-[13px] text-[#1a1d26]">
                      {selectedBooking.cancellation_reason}
                    </div>
                  </div>
                )}

                {/* Booking Info */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Booking Information</h4>
                  <div className="bg-[#f5f6f8] rounded-[10px] p-4 space-y-3">
                    {selectedBooking.roomImage && (
                      <div className="relative overflow-hidden rounded-[8px] border border-[#e2e4e8] bg-white">
                        <img
                          src={selectedBooking.roomImage}
                          alt={`${selectedBooking.roomType} ${selectedBooking.roomNumber}`}
                          className="h-40 w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = "none" }}
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-3 pb-2.5 pt-8">
                          <p className="text-[13px] font-semibold text-white">
                            {selectedBooking.roomNumber || selectedBooking.roomType}
                          </p>
                          <p className="text-[11px] text-white/80">{selectedBooking.roomType}</p>
                        </div>
                      </div>
                    )}
                    <DetailRow icon={<FileText className="h-4 w-4" />} label="Booking ID" value={`#${selectedBooking.id}`} />
                    <DetailRow icon={<Clock className="h-4 w-4" />} label="Booked On" value={formatBookingDate(selectedBooking.createdAt || "")} />
                    <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Stay" value={
                      selectedBooking.stay_type === "day" && selectedBooking.duration
                        ? `${selectedBooking.checkIn} · ${selectedBooking.start_time || ""} · ${selectedBooking.duration}h`
                        : `${selectedBooking.checkIn} → ${selectedBooking.checkOut}`
                    } />
                    <DetailRow icon={<BedDouble className="h-4 w-4" />} label="Room" value={`${selectedBooking.roomType}${selectedBooking.roomNumber ? ` · ${selectedBooking.roomNumber}` : ""}`} />
                    <DetailRow icon={<User className="h-4 w-4" />} label="Guests" value={`${selectedBooking.guests ?? 1} guest${(selectedBooking.guests ?? 1) !== 1 ? "s" : ""}`} />
                    <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Length" value={
                      selectedBooking.stay_type === "day" && selectedBooking.duration
                        ? `Day use · ${selectedBooking.duration}h`
                        : `${selectedBooking.nights} night${selectedBooking.nights !== 1 ? "s" : ""}`
                    } />
                    <DetailRow icon={<LogIn className="h-4 w-4" />} label="Arrival" value={arrivalLabel(selectedBooking, now)} />
                    <DetailRow
                      icon={<LogOut className="h-4 w-4" />}
                      label="Checkout"
                      value={checkoutMomentLabel(stayArrival(selectedBooking)) || "—"}
                    />
                    {(() => {
                      const ext = extensionInfo(selectedBooking)
                      return ext ? (
                        <DetailRow icon={<Clock className="h-4 w-4" />} label="Extension" value={ext.value} valueClass={ext.valueClass} />
                      ) : null
                    })()}
                    {selectedBooking.specialRequests ? (
                      <DetailRow icon={<FileText className="h-4 w-4" />} label="Requests" value={selectedBooking.specialRequests} />
                    ) : null}
                  </div>
                </div>

                {/* Payment */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Payment</h4>
                  <div className="bg-[#f5f6f8] rounded-[10px] p-4 space-y-3">
                    <DetailRow icon={<CreditCard className="h-4 w-4" />} label="Method" value={formatPaymentLabel(selectedBooking.payment_method || "")} />
                    <DetailRow icon={<PhilippinePeso className="h-4 w-4" />} label="Amount" value={`₱${selectedBooking.amount.toLocaleString()}`} valueClass="font-bold text-[#82285f]" />
                    {isDownpayment(selectedBooking) && !selectedBooking.refunded_at && (
                      <DetailRow
                        icon={<PhilippinePeso className="h-4 w-4" />}
                        label="Paid online (50%)"
                        value={`₱${Math.min(Math.max(0, selectedBooking.amount_paid ?? 0), downpaymentOnline(selectedBooking.amount)).toLocaleString()}`}
                      />
                    )}
                    {isDownpayment(selectedBooking) &&
                      !selectedBooking.refunded_at &&
                      selectedBooking.status !== "cancelled" &&
                      Math.max(0, (selectedBooking.amount_paid ?? 0) - downpaymentOnline(selectedBooking.amount)) > 0 && (
                      <DetailRow
                        icon={<PhilippinePeso className="h-4 w-4" />}
                        label="Settled at the hotel"
                        value={`₱${Math.max(0, (selectedBooking.amount_paid ?? 0) - downpaymentOnline(selectedBooking.amount)).toLocaleString()}`}
                      />
                    )}
                    {isDownpayment(selectedBooking) && selectedBooking.status !== "cancelled" && bookingBalance(selectedBooking) > 0 && (
                      <DetailRow
                        icon={<Landmark className="h-4 w-4" />}
                        label="Balance due at hotel"
                        value={`₱${bookingBalance(selectedBooking).toLocaleString()}`}
                        valueClass="font-bold text-[#b45309]"
                      />
                    )}
                    <DetailRow icon={<Clock className="h-4 w-4" />} label="Status" value={paymentNote(selectedBooking)} />
                    {selectedRefund && (
                      <>
                        <DetailRow
                          icon={selectedBooking.refunded_at ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          label="Refund"
                          value={
                            selectedBooking.refunded_at
                              ? `Sent ${new Date(selectedBooking.refunded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · 7–14 banking days`
                              : "Pending — queued for processing"
                          }
                          valueClass={selectedBooking.refunded_at ? "font-semibold text-[#3D6B4F]" : "font-semibold text-[#b45309]"}
                        />
                        {!selectedBooking.refunded_at && (
                          <div className="space-y-2 pt-0.5">
                            <button
                              type="button"
                              disabled={actingId === (selectedBooking.fullId || selectedBooking.id)}
                              onClick={(e) => {
                                e.stopPropagation()
                                openConfirm(selectedBooking, "refund-auto", "Process refund")
                              }}
                              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#82285f] py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#6d204f] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Process refund online · ₱{(selectedBooking.amount_paid ?? 0).toLocaleString()}
                            </button>
                            <button
                              type="button"
                              disabled={actingId === (selectedBooking.fullId || selectedBooking.id)}
                              onClick={(e) => {
                                e.stopPropagation()
                                openConfirm(selectedBooking, "refund-manual", "Mark as refunded")
                              }}
                              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#e2e4e8] bg-white py-2 text-[12px] font-semibold text-[#6b7280] transition-colors hover:border-[#82285f]/40 hover:text-[#82285f] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Mark as refunded (already returned)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                    {isDownpayment(selectedBooking) && selectedBooking.status !== "cancelled" && bookingBalance(selectedBooking) > 0 && (
                      <button
                        type="button"
                        disabled={actingId === (selectedBooking.fullId || selectedBooking.id)}
                        onClick={async () => {
                          const bid = selectedBooking.fullId || selectedBooking.id
                          setActingId(bid)
                          try {
                            await bookingsApi.settleBalance(bid)
                            toast({
                              title: "Balance settled",
                              description: `${selectedBooking.guestName}'s remaining balance has been recorded as paid.`,
                            })
                            onStatusChange?.()
                            setModalOpen(false)
                          } catch (err) {
                            toast({
                              title: "Couldn't settle the balance",
                              description: err instanceof ApiError ? err.message : "Please try again.",
                              variant: "error",
                            })
                          } finally {
                            setActingId(null)
                          }
                        }}
                        className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#3D6B4F] py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#2d5a3e] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Settle balance · ₱{bookingBalance(selectedBooking).toLocaleString()}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReceiptOpen(true)}
                      className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#e2e4e8] bg-white py-2 text-[12px] font-semibold text-[#82285f] transition-colors hover:border-[#82285f]/40 hover:bg-[#f8f0f5]"
                    >
                      View Receipt
                    </button>
                  </div>
                </div>

                {/* Actions inside modal */}
                {(() => {
                  const actions = getActions(selectedBooking, now)
                  if (actions.length === 0) return null
                  return (
                    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-[#e2e4e8]">
                      {actions}
                    </div>
                  )
                })()}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Official receipt for the open booking ────────────────────── */}
      {selectedBooking && (
        <ReceiptDialog
          open={receiptOpen}
          onClose={() => setReceiptOpen(false)}
          data={receiptFor(selectedBooking)}
        />
      )}

      {/* Confirmation Dialog — matches system Dialog */}
      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null) }}
      >
        <DialogContent className="!rounded-[16px] !max-w-[400px]">
          {confirmAction && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[16px] text-ink">
                  {confirmAction.action === "confirmed" && "Confirm Booking?"}
                  {confirmAction.action === "cancelled" && "Cancel Booking?"}
                  {confirmAction.action === "checked-out" && "Mark as Checked Out?"}
                  {confirmAction.action === "check-in" && "Check In Guest?"}
                  {confirmAction.action === "refund-auto" && "Process Refund?"}
                  {confirmAction.action === "refund-manual" && "Mark as Refunded?"}
                </DialogTitle>
              </DialogHeader>
              <p className={cn("text-[13px] text-muted leading-relaxed", confirmAction.action === "cancelled" ? "mb-4" : "mb-6")}>
                {confirmAction.action === "confirmed" && `Booking #${confirmAction.bookingIdShort} will be confirmed. The guest will be notified.`}
                {confirmAction.action === "cancelled" && `Booking #${confirmAction.bookingIdShort} will be cancelled. This cannot be undone.`}
                {confirmAction.action === "checked-out" && `Booking #${confirmAction.bookingIdShort} will be marked as checked out.`}
                {confirmAction.action === "check-in" && `Booking #${confirmAction.bookingIdShort} will be marked as arrived. The stay starts running at its booked time, and the guest will be notified.`}
                {confirmAction.action === "refund-auto" && `A refund of ₱${confirmAction.amountPaid.toLocaleString()} for booking #${confirmAction.bookingIdShort} will be sent through PayMongo to the guest's original payment method (7–14 banking days). This cannot be undone.`}
                {confirmAction.action === "refund-manual" && `Booking #${confirmAction.bookingIdShort} will be recorded as refunded for ₱${confirmAction.amountPaid.toLocaleString()}. Use this only if the money has already been returned outside the system (PayMongo dashboard, GCash, cash). This cannot be undone.`}
              </p>
              {confirmAction.action === "cancelled" && (
                <div className="mb-6">
                  <p className="mb-2 text-[13px] font-medium text-ink">Reason for cancellation</p>
                  <CancelReasonPicker
                    selected={cancelReason}
                    otherText={cancelReasonOther}
                    error={cancelReasonError}
                    onSelect={(v) => { setCancelReason(v); setCancelReasonError(false) }}
                    onOtherChange={setCancelReasonOther}
                  />
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 rounded-[8px] text-[12px] font-semibold text-muted bg-surface-soft hover:bg-surface-strong transition-colors cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    if (confirmAction.action === "cancelled") {
                      const reason = composeCancelReason(cancelReason, cancelReasonOther)
                      if (!reason) { setCancelReasonError(true); return }
                      handleStatusChange(confirmAction.bookingId, confirmAction.action, reason)
                    } else {
                      handleStatusChange(confirmAction.bookingId, confirmAction.action)
                    }
                  }}
                  className={cn(
                    "px-4 py-2 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer",
                    confirmAction.action === "confirmed" && "bg-[#3D6B4F] text-white hover:bg-[#2d5a3e]",
                    confirmAction.action === "check-in" && "bg-[#3D6B4F] text-white hover:bg-[#2d5a3e]",
                    confirmAction.action === "cancelled" && "bg-destructive text-white hover:bg-destructive-hover",
                    confirmAction.action === "checked-out" && "bg-primary text-white hover:bg-primary-active",
                    (confirmAction.action === "refund-auto" || confirmAction.action === "refund-manual") &&
                      "bg-primary text-white hover:bg-primary-active",
                  )}
                >
                  {actingId === confirmAction.bookingId ? <LoadingDots size="sm" /> : "Yes, Proceed"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Table Head ────────────────────────────────────────────────────── */

function TableHeadRow() {
  return (
    <tr className="border-b border-[#e2e4e8]">
      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Guest</th>
      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Booking ID</th>
      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Booked</th>
      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Stay Date</th>
      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Room</th>
      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Type</th>
      <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Amount</th>
      <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Status</th>
      <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Actions</th>
    </tr>
  )
}

/* ── Detail Row ────────────────────────────────────────────────────── */

function DetailRow({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[#9ca3af] shrink-0">{icon}</span>
        <span className="text-[11px] font-medium text-[#6b7280]">{label}</span>
      </div>
      <span className={cn("text-[12px] text-[#1a1d26] text-right truncate", valueClass)}>{value}</span>
    </div>
  )
}
