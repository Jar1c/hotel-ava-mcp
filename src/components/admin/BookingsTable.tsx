import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { bookingsApi } from "@/services/api"
import type { Booking } from "@/data/admin"
import LoadingDots from "@/components/LoadingDots"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mail, Phone, CalendarDays, PhilippinePeso, User, Clock, BedDouble, CreditCard, FileText } from "lucide-react"
import { getDiceBearUrl } from "@/lib/dicebear"
import Pagination from "@/components/admin/Pagination"

type BookingStatus = "confirmed" | "pending" | "completed" | "cancelled" | "checked-out"

const PAGE_SIZE = 10

interface BookingsTableProps {
  bookings: Booking[]
  showFilters?: boolean
  loading?: boolean
  onStatusChange?: () => void
}

const statusConfig: Record<BookingStatus, { label: string; dotColor: string; textColor: string }> = {
  confirmed: { label: "Confirmed", dotColor: "bg-[#3D6B4F]", textColor: "text-[#3D6B4F]" },
  pending: { label: "Pending", dotColor: "bg-[#B5AC97]", textColor: "text-[#B5AC97]" },
  completed: { label: "Completed", dotColor: "bg-[#b0b3b8]", textColor: "text-[#9ca3af]" },
  cancelled: { label: "Cancelled", dotColor: "bg-[#A4423A]", textColor: "text-[#A4423A]" },
  "checked-out": { label: "Checked Out", dotColor: "bg-[#b0b3b8]", textColor: "text-[#9ca3af]" },
}

const statusFilters: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Checked Out", value: "checked-out" },
  { label: "Cancelled", value: "cancelled" },
]

function formatBookingDate(dateStr: string) {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatPaymentLabel(method: string) {
  if (!method) return "Not set"
  const m = method.toLowerCase()
  if (m === "gcash") return "GCash"
  if (m === "paymaya") return "PayMaya"
  if (m === "card") return "Credit / Debit Card"
  return method
}

function paymentNote(status: BookingStatus) {
  if (status === "pending") return "Awaiting payment"
  if (status === "confirmed") return "Paid"
  if (status === "completed" || status === "checked-out") return "Paid"
  if (status === "cancelled") return "Cancelled"
  return "—"
}

export default function BookingsTable({ bookings, showFilters = true, loading, onStatusChange }: BookingsTableProps) {
  const [filter, setFilter] = useState<BookingStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [actingId, setActingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ bookingId: string; bookingIdShort: string; action: BookingStatus; label: string } | null>(null)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [filter])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openBooking = (booking: Booking) => {
    setSelectedBooking(booking)
    setModalOpen(true)
  }

  async function handleStatusChange(bookingId: string, newStatus: BookingStatus) {
    if (!bookingId) return
    setActingId(bookingId)
    try {
      await bookingsApi.updateStatus(bookingId, newStatus)
      onStatusChange?.()
    } catch {
      // silently fail
    } finally {
      setActingId(null)
      setConfirmAction(null)
      setModalOpen(false)
    }
  }

  function openConfirm(booking: Booking, action: BookingStatus, label: string) {
    const bid = booking.fullId || booking.id
    setConfirmAction({ bookingId: bid, bookingIdShort: booking.id, action, label })
    setModalOpen(false)
  }

  function getActions(booking: Booking) {
    const bid = booking.fullId || booking.id
    const actions: { label: string; status: BookingStatus; style: string }[] = []

    if (booking.status === "pending") {
      actions.push({ label: "Confirm", status: "confirmed", style: "bg-[#3D6B4F] text-white hover:bg-[#2d5a3e]" })
      actions.push({ label: "Cancel", status: "cancelled", style: "bg-white text-[#A4423A] border border-[#A4423A]/30 hover:bg-[#A4423A]/5" })
    } else if (booking.status === "confirmed") {
      actions.push({ label: "Check Out", status: "checked-out", style: "bg-[#82285f] text-white hover:bg-[#6d204f]" })
      actions.push({ label: "Cancel", status: "cancelled", style: "bg-white text-[#A4423A] border border-[#A4423A]/30 hover:bg-[#A4423A]/5" })
    }

    return actions.map((a) => (
      <button
        key={a.status}
        disabled={actingId === bid}
        onClick={(e) => {
          e.stopPropagation()
          openConfirm(booking, a.status, a.label)
        }}
        className={cn(
          "px-2.5 py-1 rounded-[4px] text-[10px] font-semibold transition-all duration-150",
          actingId === bid ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
          a.style
        )}
      >
        {actingId === bid ? "..." : a.label}
      </button>
    ))
  }

  // Summary counts
  const counts = {
    all: bookings.length,
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    "checked-out": bookings.filter((b) => b.status === "checked-out").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
  }

  if (loading) {
    return (
      <div className="rounded-[6px] bg-white border border-[#e2e4e8] animate-pulse">
        <div className="flex items-center gap-2 border-b border-[#e2e4e8] px-5 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-16 bg-[#f0f1f3] rounded-[4px]" />
          ))}
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#f0f1f3] rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-[6px] bg-white border border-[#e2e4e8] flex h-[708px] flex-col">
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
            </div>
            <div className="text-[11px] text-[#9ca3af]">
              {filtered.length} {filtered.length === 1 ? "booking" : "bookings"}
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead>
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
            </thead>
            <tbody>
              {paged.map((booking) => {
                const status = statusConfig[booking.status]
                const actions = getActions(booking)
                return (
                  <tr
                    key={booking.id}
                    onClick={() => openBooking(booking)}
                    className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150 cursor-pointer group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={booking.guestAvatar || getDiceBearUrl("adventurer", booking.guestEmail || booking.guestName, 32)}
                          alt={booking.guestName}
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
                    <td className="px-5 py-3 text-right font-semibold text-[#1a1d26]">₱{booking.amount.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", status.textColor)}>
                        <span className={cn("size-1.5 rounded-full", status.dotColor)} />
                        {status.label}
                      </span>
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
                    No bookings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* ── Booking Detail Modal ──────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
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
                    src={selectedBooking.guestAvatar || getDiceBearUrl("adventurer", selectedBooking.guestEmail || selectedBooking.guestName, 56)}
                    alt={selectedBooking.guestName}
                    className="size-14 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-display font-semibold text-[#1a1d26] text-lg">{selectedBooking.guestName}</h3>
                    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium mt-0.5", statusConfig[selectedBooking.status].textColor)}>
                      <span className={cn("size-1.5 rounded-full", statusConfig[selectedBooking.status].dotColor)} />
                      {statusConfig[selectedBooking.status].label}
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
                      <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Guest ID" value={selectedBooking.guestId.slice(0, 8) + "..."} />
                    ) : null}
                  </div>
                </div>

                {/* Booking Info */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Booking Information</h4>
                  <div className="bg-[#f5f6f8] rounded-[10px] p-4 space-y-3">
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
                    <DetailRow icon={<Clock className="h-4 w-4" />} label="Status" value={paymentNote(selectedBooking.status)} />
                  </div>
                </div>

                {/* Actions inside modal */}
                {(() => {
                  const actions = getActions(selectedBooking)
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
                </DialogTitle>
              </DialogHeader>
              <p className="text-[13px] text-muted mb-6 leading-relaxed">
                {confirmAction.action === "confirmed" && `Booking #${confirmAction.bookingIdShort} will be confirmed. The guest will be notified.`}
                {confirmAction.action === "cancelled" && `Booking #${confirmAction.bookingIdShort} will be cancelled. This cannot be undone.`}
                {confirmAction.action === "checked-out" && `Booking #${confirmAction.bookingIdShort} will be marked as checked out.`}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 rounded-[8px] text-[12px] font-semibold text-muted bg-surface-soft hover:bg-surface-strong transition-colors cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  onClick={() => handleStatusChange(confirmAction.bookingId, confirmAction.action)}
                  className={cn(
                    "px-4 py-2 rounded-[8px] text-[12px] font-semibold transition-colors cursor-pointer",
                    confirmAction.action === "confirmed" && "bg-[#3D6B4F] text-white hover:bg-[#2d5a3e]",
                    confirmAction.action === "cancelled" && "bg-destructive text-white hover:bg-destructive-hover",
                    confirmAction.action === "checked-out" && "bg-primary text-white hover:bg-primary-active",
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
