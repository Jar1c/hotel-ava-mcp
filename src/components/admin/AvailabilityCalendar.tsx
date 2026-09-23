import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight, CalendarDays, Clock, CreditCard, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { getBookings } from "@/services/adminService"
import type { Booking } from "@/data/admin"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePolling } from "@/hooks/usePolling"

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const roomRates: Record<string, number> = {
  "Standard Room": 2400,
  "Standard": 2400,
  "Deluxe Room": 2800,
  "Deluxe": 2800,
  "Executive Deluxe": 3200,
  "Regular Suite": 3800,
  "Suite": 3800,
  "Superior Suite": 4800,
}

const statusStyles: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  confirmed: { label: "Confirmed", dot: "bg-emerald-400", text: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  pending: { label: "Pending", dot: "bg-amber-400", text: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  completed: { label: "Completed", dot: "bg-gray-300", text: "text-muted", bg: "bg-gray-50 border-gray-200" },
  "checked-out": { label: "Checked Out", dot: "bg-gray-300", text: "text-muted", bg: "bg-gray-50 border-gray-200" },
  cancelled: { label: "Cancelled", dot: "bg-gray-300", text: "text-muted", bg: "bg-gray-50 border-gray-200 line-through" },
}

const roomTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  "Standard Room": { bg: "bg-[#7A7A70]/10", text: "text-[#7A7A70]", border: "border-[#7A7A70]/30" },
  "Standard": { bg: "bg-[#7A7A70]/10", text: "text-[#7A7A70]", border: "border-[#7A7A70]/30" },
  "Deluxe Room": { bg: "bg-[#455d58]/10", text: "text-[#455d58]", border: "border-[#455d58]/30" },
  "Deluxe": { bg: "bg-[#455d58]/10", text: "text-[#455d58]", border: "border-[#455d58]/30" },
  "Executive Deluxe": { bg: "bg-[#455d58]/10", text: "text-[#455d58]", border: "border-[#455d58]/30" },
  "Regular Suite": { bg: "bg-[#82285f]/10", text: "text-[#82285f]", border: "border-[#82285f]/30" },
  "Suite": { bg: "bg-[#82285f]/10", text: "text-[#82285f]", border: "border-[#82285f]/30" },
  "Superior Suite": { bg: "bg-[#D4A853]/10", text: "text-[#9a7b2f]", border: "border-[#D4A853]/30" },
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startOffset = firstDay.getDay()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

export default function AvailabilityCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [bookings, setBookings] = useState<Booking[]>([])
  const [calLoading, setCalLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Poll bookings every 20 seconds for live updates
  usePolling(
    () => getBookings(),
    (data) => { setBookings(data); setCalLoading(false) },
    20000,
  )

  const days = useMemo(() => getMonthDays(year, month), [year, month])

  // Map date → bookings that overlap that day
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>()
    for (const b of bookings) {
      if (b.status === "cancelled") continue
      const start = new Date(b.checkIn)
      const end = new Date(b.checkOut)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = formatDate(d.getFullYear(), d.getMonth(), d.getDate())
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(b)
      }
    }
    return map
  }, [bookings])

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month, 1))

  const weeks: (number | null)[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))

  const openBooking = (booking: Booking) => {
    setSelectedBooking(booking)
    setModalOpen(true)
  }

  const statusInfo = selectedBooking ? (statusStyles[selectedBooking.status] || statusStyles.pending) : statusStyles.pending
  const roomColor = selectedBooking ? (roomTypeColors[selectedBooking.roomType] || { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" }) : { bg: "bg-gray-50", text: "text-gray-600", border: "border-gray-200" }

  return (
    <>
      <div className="rounded-[6px] bg-white border border-[#e2e4e8]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e4e8]">
          <button
            onClick={prevMonth}
            className="flex items-center justify-center size-8 rounded-[5px] text-[#6b7280] hover:bg-[#f5f6f8] transition-colors cursor-pointer"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h2 className="text-sm font-semibold text-[#1a1d26]">{monthLabel}</h2>
          <button
            onClick={nextMonth}
            className="flex items-center justify-center size-8 rounded-[5px] text-[#6b7280] hover:bg-[#f5f6f8] transition-colors cursor-pointer"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* Day of week */}
        <div className="grid grid-cols-7 border-b border-[#e2e4e8]">
          {DAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider text-center">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calLoading && bookings.length === 0
            ? Array.from({ length: 35 }).map((_, i) => (
                <div key={`sk-${i}`} className="min-h-[100px] p-1.5 border-b border-r border-[#f0f1f3] last:border-r-0">
                  <div className="size-6 rounded-[4px] bg-[#f5f6f8] animate-pulse mb-1" />
                  <div className="h-3 w-12 rounded bg-[#f5f6f8] animate-pulse mb-0.5" />
                  <div className="h-3 w-10 rounded bg-[#f5f6f8] animate-pulse" />
                </div>
              ))
            : weeks.flat().map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} className="min-h-[100px] p-1.5 border-b border-r border-[#f0f1f3] last:border-r-0" />

            const dateStr = formatDate(year, month, day)
            const dayBookings = bookingsByDate.get(dateStr) || []
            const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
            const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

            return (
              <div
                key={dateStr}
                className={cn(
                  "min-h-[100px] p-1.5 border-b border-r border-[#f0f1f3] last:border-r-0 transition-colors duration-150",
                  isToday && "bg-[#82285f]/5",
                  isPast && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "inline-flex items-center justify-center size-6 rounded-[4px] text-[11px] font-medium mb-1",
                    isToday ? "bg-[#82285f] text-white font-bold" : "text-[#1a1d26]"
                  )}
                >
                  {day}
                </span>
                <div className="flex flex-col gap-0.5">
                  {dayBookings.slice(0, 3).map((b) => {
                    const colors = roomTypeColors[b.roomType] || { bg: "bg-gray-100", text: "text-gray-600", border: "border-gray-200" }
                    return (
                      <button
                        key={b.id}
                        onClick={() => openBooking(b)}
                        className={cn(
                          "text-left w-full rounded-[3px] px-1.5 py-0.5 border text-[9px] font-medium truncate cursor-pointer hover:opacity-80 transition-opacity",
                          colors.bg, colors.text, colors.border
                        )}
                        title={`${b.guestName} — ${b.roomType}`}
                      >
                        {b.guestName}
                      </button>
                    )
                  })}
                  {dayBookings.length > 3 && (
                    <span className="text-[9px] text-[#9ca3af] font-medium px-1">
                      +{dayBookings.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-3 border-t border-[#e2e4e8] flex-wrap">
          <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mr-1">Legend:</span>
          {Object.entries(roomTypeColors).map(([name, colors]) => (
            <div key={name} className="flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-[2px]", colors.bg.replace("/10", "").replace("bg-", "bg-"))} />
              <span className="text-[10px] text-[#6b7280]">{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Booking Detail Modal ─────────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="!rounded-[16px] !max-w-[480px] !p-0 overflow-hidden">
          {selectedBooking && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-hairline">
                <DialogTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" style={{ color: "#82285f" }} />
                    Booking Details
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span className={cn("w-2 h-2 rounded-full", statusInfo.dot)} />
                    <span className={statusInfo.text}>{statusInfo.label}</span>
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="overflow-y-auto max-h-[65vh] p-6">
                {/* Guest + Room */}
                <div className="mb-6">
                  <h3 className="font-display font-semibold text-ink text-lg">{selectedBooking.guestName}</h3>
                  <p className="text-sm text-muted">{selectedBooking.guestEmail}</p>
                  <span className={cn("inline-block mt-2 text-[11px] font-medium px-2.5 py-1 rounded-full border", roomColor.bg, roomColor.text, roomColor.border)}>
                    {selectedBooking.roomType} · {selectedBooking.roomNumber}
                  </span>
                </div>

                {/* Booking Info */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Booking Information</h4>
                  <div className="bg-gray-50 rounded-[10px] p-4 space-y-3">
                    <DetailRow
                      icon={<FileText className="h-4 w-4" />}
                      label="Booking ID"
                      value={`#${(selectedBooking.fullId || selectedBooking.id).slice(0, 8).toUpperCase()}`}
                    />
                    <DetailRow
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Check-in"
                      value={formatDateLabel(selectedBooking.checkIn)}
                    />
                    <DetailRow
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Check-out"
                      value={formatDateLabel(selectedBooking.checkOut)}
                    />
                    <DetailRow
                      icon={<Clock className="h-4 w-4" />}
                      label="Duration"
                      value={
                        selectedBooking.stay_type === "day" && selectedBooking.duration
                          ? `${selectedBooking.duration} hours${selectedBooking.start_time ? ` at ${selectedBooking.start_time}` : ""}`
                          : `${selectedBooking.nights} ${selectedBooking.nights === 1 ? "night" : "nights"}`
                      }
                    />
                  </div>
                </div>

                {/* Payment Details — Full Inline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Payment Details</h4>
                  <div className="bg-gray-50 rounded-[10px] p-4 space-y-3">
                    <DetailRow
                      icon={<CreditCard className="h-4 w-4" />}
                      label="Payment Method"
                      value={
                        selectedBooking.payment_method
                          ? selectedBooking.payment_method.charAt(0).toUpperCase() + selectedBooking.payment_method.slice(1)
                          : selectedBooking.status === "confirmed" ? "GCash" : selectedBooking.status === "cancelled" ? "Refunded" : "Pending"
                      }
                    />
                    <DetailRow
                      icon={<FileText className="h-4 w-4" />}
                      label="Room Rate"
                      value={
                        selectedBooking.stay_type === "day" && selectedBooking.duration
                          ? `₱${(roomRates[selectedBooking.roomType] ? Math.round(roomRates[selectedBooking.roomType] / 8 * selectedBooking.duration) : selectedBooking.amount).toLocaleString()} (day use)`
                          : selectedBooking.nights > 0
                            ? `₱${(roomRates[selectedBooking.roomType] ? Math.round(selectedBooking.amount / selectedBooking.nights) : Math.round(selectedBooking.amount / selectedBooking.nights)).toLocaleString()} × ${selectedBooking.nights} ${selectedBooking.nights === 1 ? "night" : "nights"}`
                            : `₱${selectedBooking.amount.toLocaleString()} total`
                      }
                    />
                    {selectedBooking.createdAt && (
                      <DetailRow
                        icon={<CalendarDays className="h-4 w-4" />}
                        label="Booked On"
                        value={new Date(selectedBooking.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      />
                    )}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                      <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <CreditCard className="h-4 w-4" />
                        Total Amount
                      </span>
                      <span className="text-xl font-display font-bold text-[#82285f]">
                        ₱{selectedBooking.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Detail Row ────────────────────────────────────────────────────── */

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
