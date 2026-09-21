import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useNavigate } from "react-router"
import { motion } from "motion/react"
import DatePicker from "react-datepicker"
import { format, isToday } from "date-fns"
import { Calendar, Clock } from "lucide-react"
import GuestSelector, { type GuestCount } from "@/components/ui/guest-selector"

export type StayType = "overnight" | "day"

const ALL_TIME_SLOTS = [
  "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
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
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-6 flex items-center cursor-pointer select-none touch-none"
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

      {/* Min / Max labels */}
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-muted">₱0</span>
        <span className="text-[10px] text-muted">₱5,000</span>
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
  const [guests, setGuests] = useState<GuestCount>({ adults: 0, children: 0 })
  const [budget, setBudget] = useState<number>(BUDGET_MAX)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkOutOpen, setCheckOutOpen] = useState(false)

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
    }
  }

  const handleCheckInChange = (date: Date | null) => {
    setCheckIn(date)
    setDayUseTime("")
    if (isDayUse) {
      setCheckOut(date)
      setCheckInOpen(false)
    } else if (date) {
      // Auto-open check-out picker after selecting check-in
      setCheckInOpen(false)
      setTimeout(() => setCheckOutOpen(true), 100)
    } else if (date === null) {
      setCheckOut(null)
    }
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

  return (
    <div className="w-full bg-white rounded-[20px] shadow-card-hover border border-hairline/60">
      {/* Stay Type Toggle */}
      <div className="flex border-b border-hairline/60">
        <button
          type="button"
          onClick={() => handleStayTypeChange("overnight")}
          className={`flex-1 py-3.5 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            stayType === "overnight"
              ? "text-primary border-b-[3px] border-primary"
              : "text-muted hover:text-ink"
          }`}
        >
          Overnight Stay
        </button>
        <button
          type="button"
          onClick={() => handleStayTypeChange("day")}
          className={`flex-1 py-3.5 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            stayType === "day"
              ? "text-primary border-b-[3px] border-primary"
              : "text-muted hover:text-ink"
          }`}
        >
          Day Use
        </button>
      </div>

      {/* Fields Row */}
      <div className="flex flex-col md:flex-row md:items-stretch">
        {/* Check-In */}
        <div className="flex-1 min-w-0 px-6 py-5 border-b md:border-b-0 md:border-r border-hairline/60 relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2 cursor-pointer">
            {isDayUse ? "Select Date" : "Check-In"}
          </label>
          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="w-full flex items-center gap-2.5 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-muted">
              {checkIn ? format(checkIn, "MMM dd, yyyy") : "Select date"}
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
              <div className="flex items-center justify-between px-2 pt-3 border-t border-hairline-soft mt-3">
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
                    if (!isDayUse) {
                      setTimeout(() => setCheckOutOpen(true), 100)
                    }
                  }}
                  className="typo-button-sm bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </DatePicker>
          </div>
        </div>

        {/* Check-Out — overnight only */}
        {!isDayUse && (
          <div className="flex-1 min-w-0 px-6 py-5 border-b md:border-b-0 md:border-r border-hairline/60 relative">
            <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2 cursor-pointer">
              Check-Out
            </label>
            <button
              type="button"
              onClick={() => setCheckOutOpen(true)}
              className="w-full flex items-center gap-2.5 text-left bg-transparent border-none p-0 cursor-pointer"
            >
              <Calendar className="h-4 w-4 text-muted shrink-0" />
              <span className="typo-body-sm text-muted">
                {checkOut ? format(checkOut, "MMM dd, yyyy") : "Select date"}
              </span>
            </button>

            <div className="absolute left-0 bottom-0 h-0 w-0">
              <DatePicker
                selected={checkOut}
                onChange={(date: Date | null) => setCheckOut(date)}
                monthsShown={1}
                minDate={checkIn ? new Date(checkIn.getTime() + 86400000) : new Date()}
                open={checkOutOpen}
                onCalendarOpen={() => setCheckOutOpen(true)}
                onClickOutside={() => setCheckOutOpen(false)}
                popperPlacement="bottom-start"
                popperProps={{ strategy: "fixed" }}
                calendarClassName="ava-dual-calendar border border-hairline rounded-[12px] shadow-dropdown"
                customInput={<span className="inline-block w-0 h-0 overflow-hidden" />}
              >
                <div className="flex items-center justify-end px-2 pt-3 border-t border-hairline-soft mt-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      setCheckOutOpen(false)
                    }}
                    className="typo-button-sm bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </DatePicker>
            </div>
          </div>
        )}

        {/* Time — day use only */}
        {isDayUse && (
          <div className="flex-1 min-w-0 px-6 py-5 border-b md:border-b-0 md:border-r border-hairline/60">
            <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2">
              Time
            </label>
            <div className="flex items-center gap-2.5">
              <Clock className="h-4 w-4 text-muted shrink-0" />
              <select
                value={dayUseTime}
                onChange={(e) => setDayUseTime(e.target.value)}
                className="w-full bg-transparent border-none typo-body-sm text-ink focus:outline-none cursor-pointer font-medium"
              >
                <option value="" disabled>Select time</option>
                {availableTimeSlots.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Guests */}
        <div className="flex-1 min-w-0 px-6 py-5 border-b md:border-b-0 md:border-r border-hairline/60">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2">
            Guests
          </label>
          <GuestSelector value={guests} onChange={setGuests} />
        </div>

        {/* Budget */}
        <div className="flex-1 min-w-0 px-6 py-5 border-b md:border-b-0 md:border-r border-hairline/60">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2">
            Budget
          </label>
          <BudgetSlider value={budget} onChange={setBudget} />
        </div>

        {/* Button */}
        <div className="px-6 py-5 flex items-center justify-center md:min-w-[180px]">
          <motion.button
            onClick={handleSearch}
            disabled={!canSearch}
            whileHover={canSearch ? { scale: 1.03 } : undefined}
            whileTap={canSearch ? { scale: 0.97 } : undefined}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-8 h-12 rounded-[14px] font-semibold typo-body-sm transition-all ${
              canSearch
                ? "bg-primary text-on-primary hover:bg-primary-active cursor-pointer shadow-sm"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Check Availability
          </motion.button>
        </div>
      </div>
    </div>
  )
}
