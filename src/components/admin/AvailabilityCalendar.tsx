import { useState, useMemo, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getBookings } from "@/services/adminService"
import type { Booking } from "@/data/admin"

const roomTypeColors: Record<string, string> = {
  "Standard Room": "bg-[#7A7A70]",
  "Deluxe Room": "bg-[#455d58]",
  "Executive Deluxe": "bg-[#455d58]",
  "Regular Suite": "bg-[#82285f]",
  "Superior Suite": "bg-[#D4A853]",
}

const roomTypeNames = ["Standard Room", "Deluxe Room", "Executive Deluxe", "Regular Suite", "Superior Suite"]

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

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

export default function AvailabilityCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [bookings, setBookings] = useState<Booking[]>([])

  useEffect(() => {
    getBookings().then(setBookings)
  }, [])

  const days = useMemo(() => getMonthDays(year, month), [year, month])

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const b of bookings) {
      const start = new Date(b.checkIn)
      const end = new Date(b.checkOut)
      for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
        const key = formatDate(d.getFullYear(), d.getMonth(), d.getDate())
        if (!map.has(key)) map.set(key, [])
        const arr = map.get(key)!
        if (!arr.includes(b.roomType)) arr.push(b.roomType)
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

  return (
    <div className="rounded-[6px] bg-white border border-[#e2e4e8]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e4e8]">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center size-8 rounded-[5px] text-[#6b7280] hover:bg-[#f5f6f8] transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <h2 className="text-sm font-semibold text-[#1a1d26]">{monthLabel}</h2>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center size-8 rounded-[5px] text-[#6b7280] hover:bg-[#f5f6f8] transition-colors"
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
        {weeks.flat().map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="min-h-[90px] p-1.5 border-b border-r border-[#f0f1f3] last:border-r-0" />

          const dateStr = formatDate(year, month, day)
          const dayBookings = bookingsByDate.get(dateStr) || []
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate())

          return (
            <div
              key={dateStr}
              className={cn(
                "min-h-[90px] p-1.5 border-b border-r border-[#f0f1f3] last:border-r-0 transition-colors duration-150",
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
                {roomTypeNames.map((rt) => {
                  if (!dayBookings.includes(rt)) return null
                  return (
                    <span
                      key={rt}
                      className={cn("inline-block h-1.5 w-full rounded-[2px]", roomTypeColors[rt] || "bg-[#9ca3af]")}
                      title={rt}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-[#e2e4e8]">
        <span className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mr-1">Legend:</span>
        {Object.entries(roomTypeColors).map(([name, color]) => (
          <div key={name} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-[2px]", color)} />
            <span className="text-[10px] text-[#6b7280]">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
