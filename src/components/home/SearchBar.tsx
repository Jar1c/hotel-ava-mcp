import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useNavigate } from "react-router"
import { motion } from "motion/react"
import DatePicker from "react-datepicker"
import { format, isToday } from "date-fns"
import { Calendar, ChevronDown, Clock, Search } from "lucide-react"
import GuestSelector, { type GuestCount } from "@/components/ui/guest-selector"

export type StayType = "overnight" | "day"

const ALL_TIME_SLOTS = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM"
]

const BUDGET_MAX = 5000
const BUDGET_STEP = 100

function parseTime(time: string): number {
  const [timePart, period] = time.split(" ")
  let [hours] = timePart.split(":").map(Number)
  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0
  return hours
}

/* ── Single Budget Slider ─────────────────────────────────────────────────── */

function BudgetSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const isAny = value >= BUDGET_MAX

  const toPercent = (v: number) => (v / BUDGET_MAX) * 100
  const pct = toPercent(isAny ? BUDGET_MAX : value)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const raw = Math.round((pct * BUDGET_MAX) / BUDGET_STEP) * BUDGET_STEP
      onChange(Math.max(0, Math.min(BUDGET_MAX, raw)))
    }

    const onUp = () => setDragging(false)

    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
    return () => {
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
    }
  }, [dragging, onChange])

  const label = isAny ? "Any" : `₱${value.toLocaleString()}`

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[13px] font-semibold text-ink truncate">{label}</span>
        <span className="text-[10px] text-muted shrink-0">₱0 – ₱5,000</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-5 flex items-center cursor-pointer select-none touch-none"
      >
        {/* Background */}
        <div className="absolute w-full h-[3px] rounded-full bg-hairline" />

        {/* Active fill */}
        <div
          className="absolute h-[3px] rounded-full bg-primary transition-none"
          style={{ width: `${pct}%` }}
        />

        {/* Thumb */}
        <div
          onPointerDown={handlePointerDown}
          className="absolute w-5 h-5 rounded-full bg-white border-[2.5px] border-primary shadow-md cursor-grab active:cursor-grabbing -translate-x-1/2 z-10 hover:scale-110 transition-transform"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ── SearchBar ────────────────────────────────────────────────────────────── */

export default function SearchBar() {
  const navigate = useNavigate()
  const [stayType, setStayType] = useState<StayType>("overnight")
  const [checkIn, setCheckIn] = useState<Date | null>(null)
  const [checkOut, setCheckOut] = useState<Date | null>(null)
  const [dayUseTime, setDayUseTime] = useState<string>("")
  const [guests, setGuests] = useState<GuestCount>({ adults: 0, children: 0, pets: 0 })
  const [budget, setBudget] = useState<number>(BUDGET_MAX)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const timeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!timeOpen) return
    const onDown = (e: MouseEvent) => {
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) setTimeOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [timeOpen])

  const isDayUse = stayType === "day"
  const hasGuests = guests.adults > 0
  const canSearch = checkIn && hasGuests && (isDayUse ? dayUseTime : checkOut)

  const availableTimeSlots = useMemo(() => {
    if (!checkIn || !isToday(checkIn)) return ALL_TIME_SLOTS
    const now = new Date()
    const currentHour = now.getHours()
    return ALL_TIME_SLOTS.filter((time) => parseTime(time) > currentHour)
  }, [checkIn, isDayUse])

  const handleStayTypeChange = (type: StayType) => {
    setStayType(type)
    if (type === "day") {
      setCheckOut(null)
      return
    }
    // Overnight: check-out is locked to check-in + 1 day
    setCheckOut(checkIn ? new Date(checkIn.getTime() + 24 * 60 * 60 * 1000) : null)
  }

  const handleCheckInChange = (date: Date | null) => {
    setCheckIn(date)
    setDayUseTime("")
    if (isDayUse) {
      setCheckOut(date)
      return
    }
    // Overnight stays are locked to 24 hours — check-out is always check-in + 1 day
    setCheckOut(date ? new Date(date.getTime() + 24 * 60 * 60 * 1000) : null)
  }

  const handleSearch = () => {
    if (!canSearch) return
    const searchParams = new URLSearchParams()
    searchParams.set("stayType", stayType)
    if (checkIn) searchParams.set("checkIn", format(checkIn, "yyyy-MM-dd"))
    if (isDayUse) {
      if (checkIn) searchParams.set("checkOut", format(checkIn, "yyyy-MM-dd"))
      searchParams.set("startTime", dayUseTime)
    } else {
      if (checkOut) searchParams.set("checkOut", format(checkOut, "yyyy-MM-dd"))
    }
    searchParams.set("adults", String(guests.adults))
    searchParams.set("children", String(guests.children))
    if (guests.pets > 0) searchParams.set("pets", String(guests.pets))
    if (budget < BUDGET_MAX) searchParams.set("budgetMax", String(budget))
    navigate({
      pathname: "/rooms",
      search: searchParams.toString(),
    })
  }

  const handleReset = () => {
    setCheckIn(null)
    setCheckOut(null)
    setDayUseTime("")
    setBudget(BUDGET_MAX)
  }

  const calendarFooter = (
    <div className="mt-3 border-t border-hairline-soft pt-3">
      {!isDayUse && checkIn && checkOut && (
        <p className="px-2 mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
          <Clock className="h-3 w-3 shrink-0" />
          Auto check-out {format(checkOut, "MMM d, yyyy")} · 24 hours
        </p>
      )}
      <div className="flex items-center justify-between px-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            handleReset()
          }}
          className="typo-body-sm text-muted hover:text-ink transition-colors cursor-pointer"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            setCheckInOpen(false)
          }}
          className="typo-button-sm bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  )

  return (
    <div className="w-full bg-white rounded-[20px] shadow-card-hover border border-hairline/60">
      {/* Stay Type Toggle */}
      <div className="flex border-b border-hairline/60">
        <button
          type="button"
          onClick={() => handleStayTypeChange("overnight")}
          className={`relative flex-1 py-3.5 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            stayType === "overnight" ? "text-primary" : "text-muted hover:text-ink"
          }`}
        >
          Overnight Stay
          {stayType === "overnight" && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-primary rounded-t-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleStayTypeChange("day")}
          className={`relative flex-1 py-3.5 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            stayType === "day" ? "text-primary" : "text-muted hover:text-ink"
          }`}
        >
          Day Use
          {stayType === "day" && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-primary rounded-t-full" />
          )}
        </button>
      </div>

      {/* Fields Row */}
      <div className="flex flex-col md:flex-row md:items-stretch">
        {/* Stay dates — for overnight stays check-out is locked to check-in + 24h */}
        <div className="flex-1 min-w-0 px-3 py-3.5 border-b border-hairline/60 md:border-b-0 relative">
          <span className="text-[11px] font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">
            {isDayUse ? "Date" : "Stay Dates"}
          </span>
          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="w-full rounded-[10px] border border-hairline bg-white px-3 py-2.5 text-left hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-muted shrink-0" />
              <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink truncate">
                {isDayUse ? "Date" : "Check In – Check Out"}
              </span>
              <ChevronDown className="h-4 w-4 text-muted shrink-0" />
            </span>
            <span className="block mt-0.5 text-[12px] text-muted truncate">
              {checkIn
                ? isDayUse
                  ? format(checkIn, "MMM d, yyyy")
                  : `${format(checkIn, "MMM d")} – ${checkOut ? format(checkOut, "MMM d") : ""}`
                : isDayUse
                  ? "Select date"
                  : "Select dates"}
            </span>
          </button>

          <div className="absolute left-0 bottom-0 h-0 w-0">
            <DatePicker
              selected={checkIn}
              onChange={handleCheckInChange}
              monthsShown={1}
              minDate={new Date()}
              open={checkInOpen}
              onCalendarOpen={() => setCheckInOpen(true)}
              onClickOutside={() => setCheckInOpen(false)}
              popperPlacement="bottom-start"
              popperProps={{ strategy: "fixed" }}
              calendarClassName="ava-dual-calendar border border-hairline rounded-[12px] shadow-dropdown"
              customInput={<span className="inline-block w-0 h-0 overflow-hidden" />}
            >
              {calendarFooter}
            </DatePicker>
          </div>
        </div>

        {/* Time — day use only */}
        {isDayUse && (
          <div ref={timeRef} className="flex-1 min-w-0 px-3 py-3.5 border-b border-hairline/60 md:border-b-0 relative">
            <span className="text-[11px] font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">
              Time
            </span>
            <button
              type="button"
              onClick={() => setTimeOpen((v) => !v)}
              className="w-full rounded-[10px] border border-hairline bg-white px-3 py-2.5 text-left hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-muted shrink-0" />
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink truncate">Time</span>
                <ChevronDown
                  className={`h-4 w-4 text-muted shrink-0 transition-transform ${timeOpen ? "rotate-180" : ""}`}
                />
              </span>
              <span className={`block mt-0.5 text-[12px] truncate ${dayUseTime ? "text-ink" : "text-muted"}`}>
                {dayUseTime || "Select time"}
              </span>
            </button>

            {timeOpen && (
              <div className="absolute left-4 right-4 top-full mt-2 z-50 max-h-56 overflow-y-auto rounded-[12px] border border-hairline bg-white p-1.5 shadow-dropdown">
                {availableTimeSlots.length === 0 && (
                  <p className="px-3 py-2.5 text-[13px] text-muted">No slots left today</p>
                )}
                {availableTimeSlots.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      setDayUseTime(time)
                      setTimeOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-[8px] text-[13px] transition-colors cursor-pointer ${
                      dayUseTime === time
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-ink hover:bg-surface-soft"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Guests */}
        <div className="flex-1 min-w-0 px-3 py-3.5 border-b border-hairline/60 md:border-b-0">
          <GuestSelector label="Guests" value={guests} onChange={setGuests} maxPets={2} allowPets />
        </div>

        {/* Budget */}
        <div className="flex-1 min-w-0 px-3 py-3.5 border-b border-hairline/60 md:border-b-0">
          <span className="text-[11px] font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">
            Budget
          </span>
          <div className="rounded-[10px] border border-hairline bg-white px-3 py-2.5">
            <BudgetSlider value={budget} onChange={setBudget} />
          </div>
        </div>

        {/* Button */}
        <div className="px-3 py-3.5 flex items-center">
          <motion.button
            onClick={handleSearch}
            disabled={!canSearch}
            whileHover={canSearch ? { scale: 1.03 } : undefined}
            whileTap={canSearch ? { scale: 0.97 } : undefined}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 h-11 rounded-full uppercase tracking-wider text-[12px] font-bold transition-all ${
              canSearch
                ? "bg-ink text-on-primary hover:bg-primary cursor-pointer shadow-sm"
                : "bg-ink text-on-primary opacity-40 cursor-not-allowed"
            }`}
          >
            <Search className="h-4 w-4" />
            Check Availability
          </motion.button>
        </div>
      </div>
    </div>
  )
}
