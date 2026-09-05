import { useState } from "react"
import { cn } from "@/lib/utils"
import { bookingsApi } from "@/services/api"
import type { Booking } from "@/data/admin"
import LoadingDots from "@/components/LoadingDots"

type BookingStatus = "confirmed" | "pending" | "completed" | "cancelled" | "checked-out"

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

export default function BookingsTable({ bookings, showFilters = true, loading, onStatusChange }: BookingsTableProps) {
  const [filter, setFilter] = useState<BookingStatus | "all">("all")
  const [actingId, setActingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ bookingId: string; bookingIdShort: string; action: BookingStatus; label: string } | null>(null)

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter)

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
    }
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
        onClick={() => setConfirmAction({ bookingId: bid, bookingIdShort: booking.id, action: a.status, label: a.label })}
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
      <div className="rounded-[6px] bg-white border border-[#e2e4e8]">
        {showFilters && (
          <div className="flex items-center justify-between border-b border-[#e2e4e8] px-5 py-3">
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

        <div className="overflow-x-auto">
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
              {filtered.map((booking) => {
                const status = statusConfig[booking.status]
                const actions = getActions(booking)
                return (
                  <tr
                    key={booking.id}
                    className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150"
                  >
                    <td className="px-5 py-3">
                      <div>
                        <div className="font-medium text-[#1a1d26]">{booking.guestName}</div>
                        {booking.guestEmail && <div className="text-[11px] text-[#9ca3af]">{booking.guestEmail}</div>}
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
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[12px] shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-[15px] font-bold text-[#1a1d26] mb-2">
              {confirmAction.action === "confirmed" && "Confirm Booking?"}
              {confirmAction.action === "cancelled" && "Cancel Booking?"}
              {confirmAction.action === "checked-out" && "Mark as Checked Out?"}
            </h3>
            <p className="text-[13px] text-[#6b7280] mb-5">
              {confirmAction.action === "confirmed" && `Booking #${confirmAction.bookingIdShort} will be confirmed. The guest will be notified.`}
              {confirmAction.action === "cancelled" && `Booking #${confirmAction.bookingIdShort} will be cancelled. This cannot be undone.`}
              {confirmAction.action === "checked-out" && `Booking #${confirmAction.bookingIdShort} will be marked as checked out.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-[6px] text-[12px] font-semibold text-[#6b7280] bg-[#f5f6f8] hover:bg-[#e2e4e8] transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => handleStatusChange(confirmAction.bookingId, confirmAction.action)}
                className={cn(
                  "px-4 py-2 rounded-[6px] text-[12px] font-semibold transition-colors",
                  confirmAction.action === "confirmed" && "bg-[#3D6B4F] text-white hover:bg-[#2d5a3e]",
                  confirmAction.action === "cancelled" && "bg-[#A4423A] text-white hover:bg-[#8a372f]",
                  confirmAction.action === "checked-out" && "bg-[#82285f] text-white hover:bg-[#6d204f]",
                )}
              >
                {actingId === confirmAction.bookingId ? <LoadingDots size="sm" /> : "Yes, Proceed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
