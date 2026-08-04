import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Booking } from "@/data/admin"

type BookingStatus = "confirmed" | "pending" | "completed" | "cancelled" | "checked-out"

interface BookingsTableProps {
  bookings: Booking[]
  showFilters?: boolean
  loading?: boolean
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
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Checked Out", value: "checked-out" },
  { label: "Cancelled", value: "cancelled" },
]

export default function BookingsTable({ bookings, showFilters = true, loading }: BookingsTableProps) {
  const [filter, setFilter] = useState<BookingStatus | "all">("all")

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter)

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
    <div className="rounded-[6px] bg-white border border-[#e2e4e8]">
      {showFilters && (
        <div className="flex items-center gap-2 border-b border-[#e2e4e8] px-5 py-3">
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
            </button>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e2e4e8]">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Guest Name</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Booking ID</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Room</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Nights</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((booking) => {
              const status = statusConfig[booking.status]
              return (
                <tr
                  key={booking.id}
                  className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150"
                >
                  <td className="px-5 py-3 font-medium text-[#1a1d26]">{booking.guestName}</td>
                  <td className="px-5 py-3 text-[#6b7280]">#{booking.id}</td>
                  <td className="px-5 py-3 text-[#6b7280]">{booking.checkIn}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-[4px] bg-[#f5f6f8] flex items-center justify-center text-[9px] font-bold text-[#9ca3af]">
                        {booking.roomType.charAt(0)}
                      </div>
                      <span className="text-[#1a1d26]">{booking.roomType}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#6b7280]">{booking.nights}</td>
                  <td className="px-5 py-3 text-right font-semibold text-[#1a1d26]">₱{booking.amount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", status.textColor)}>
                      <span className={cn("size-1.5 rounded-full", status.dotColor)} />
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-[#9ca3af]">
                  No bookings found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
