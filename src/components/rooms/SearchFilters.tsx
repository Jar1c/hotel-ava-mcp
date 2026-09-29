import { useState, useRef, useCallback, useEffect } from "react"
import { motion } from "motion/react"
import { format } from "date-fns"
import DatePicker from "react-datepicker"
import { Calendar, ChevronDown, Clock, Search } from "lucide-react"
import GuestSelector, { type GuestCount } from "@/components/ui/guest-selector"
import type { StayType } from "@/components/home/SearchBar"

interface SearchFiltersProps {
  initialFilters: FilterState
  onFilterChange: (filters: FilterState) => void
}

export interface FilterState {
  stayType: StayType
  checkIn: string
  checkOut: string
  startTime: string
  guests: GuestCount
  budget: number
  budgetMax: number
  sortBy: "price-asc" | "price-desc" | "rating"
}

const BUDGET_MAX = 5000
const BUDGET_STEP = 100

const TIME_SLOTS = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM"
]

/* ── Single Budget Slider ─────────────────────────────────────────────────── */

function BudgetSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const isAny = value >= BUDGET_MAX

  const pct = (isAny ? BUDGET_MAX : value) / BUDGET_MAX * 100

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const raw = Math.round((p * BUDGET_MAX) / BUDGET_STEP) * BUDGET_STEP
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
      <div ref={trackRef} className="relative h-5 flex items-center cursor-pointer select-none touch-none">
        <div className="absolute w-full h-[3px] rounded-full bg-hairline" />
        <div className="absolute h-[3px] rounded-full bg-primary" style={{ width: `${pct}%` }} />
        <div
          onPointerDown={handlePointerDown}
          className="absolute w-5 h-5 rounded-full bg-white border-[2.5px] border-primary shadow-md cursor-grab active:cursor-grabbing -translate-x-1/2 z-10 hover:scale-110 transition-transform"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/* ── SearchFilters ────────────────────────────────────────────────────────── */

export default function SearchFilters({ initialFilters, onFilterChange }: SearchFiltersProps) {
  const [draft, setDraft] = useState<FilterState>(initialFilters)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [timeOpen, setTimeOpen] = useState(false)
  const datePickerRef = useRef<DatePicker>(null)
  const timeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!timeOpen) return
    const onDown = (e: MouseEvent) => {
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) setTimeOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [timeOpen])

  const updateDraft = (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const canSearch = draft.checkIn !== "" && (draft.stayType === "day" ? draft.startTime !== "" : draft.checkOut !== "")

  const handleStayTypeChange = (type: StayType) => {
    if (type === draft.stayType) return
    setDraft((prev) => {
      if (!prev.checkIn) return { ...prev, stayType: type }
      const ci = new Date(prev.checkIn)
      return {
        ...prev,
        stayType: type,
        checkOut: format(type === "day" ? ci : new Date(ci.getTime() + 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      }
    })
  }

  const handleDateChange = (date: Date | null) => {
    if (!date) {
      updateDraft("checkIn", "")
      updateDraft("checkOut", "")
      return
    }
    updateDraft("checkIn", format(date, "yyyy-MM-dd"))
    // Overnight stays are locked to 24 hours — check-out is always check-in + 1 day.
    // Day use stays within a single day.
    const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000)
    updateDraft("checkOut", format(draft.stayType === "day" ? date : nextDay, "yyyy-MM-dd"))
  }

  const handleSearch = () => {
    if (!canSearch) return
    onFilterChange(draft)
  }

  const handleReset = () => {
    updateDraft("checkIn", "")
    updateDraft("checkOut", "")
  }

  const calendarFooter = (
    <div className="mt-3 border-t border-hairline-soft pt-3">
      {draft.checkIn && draft.checkOut && (
        <p className="px-2 mb-2.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
          <Clock className="h-3 w-3 shrink-0" />
          {draft.stayType === "day"
            ? `Day use ${format(new Date(draft.checkIn), "MMM d, yyyy")}`
            : `Auto check-out ${format(new Date(draft.checkOut), "MMM d, yyyy")} · 24 hours`}
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
            setIsCalendarOpen(false)
          }}
          className="typo-button-sm bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  )

  return (
    <div className="w-full bg-white rounded-[20px] shadow-card-hover border border-hairline/60 mb-lg">
      {/* Stay Type Toggle */}
      <div className="flex border-b border-hairline/60">
        <button
          type="button"
          onClick={() => handleStayTypeChange("overnight")}
          className={`relative flex-1 py-3.5 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            draft.stayType === "overnight" ? "text-primary" : "text-muted hover:text-ink"
          }`}
        >
          Overnight Stay
          {draft.stayType === "overnight" && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-primary rounded-t-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => handleStayTypeChange("day")}
          className={`relative flex-1 py-3.5 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            draft.stayType === "day" ? "text-primary" : "text-muted hover:text-ink"
          }`}
        >
          Day Use
          {draft.stayType === "day" && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-primary rounded-t-full" />
          )}
        </button>
      </div>

      {/* Fields Row */}
      <div className="flex flex-col md:flex-row md:items-stretch">
        {/* Stay dates — check-out is locked to check-in + 24h for overnight stays */}
        <div className="w-full md:flex-1 min-w-0 px-3 py-3.5 border-b border-hairline/60 md:border-b-0 relative">
          <span className="text-[11px] font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">
            Stay Dates
          </span>
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="w-full rounded-[10px] border border-hairline bg-white px-3 py-2.5 text-left hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-muted shrink-0" />
              <span className="min-w-0 flex-1 text-[13px] font-semibold text-ink truncate">
                {draft.stayType === "day" ? "Date" : "Check In – Check Out"}
              </span>
              <ChevronDown className="h-4 w-4 text-muted shrink-0" />
            </span>
            <span className="block mt-0.5 text-[12px] text-muted truncate">
              {draft.checkIn
                ? draft.stayType === "day"
                  ? format(new Date(draft.checkIn), "MMM d, yyyy")
                  : `${format(new Date(draft.checkIn), "MMM d")} – ${
                      draft.checkOut ? format(new Date(draft.checkOut), "MMM d") : ""
                    }`
                : draft.stayType === "day"
                  ? "Select date"
                  : "Select dates"}
            </span>
          </button>

          <div className="absolute left-0 bottom-0 h-0 w-0">
            <DatePicker
              ref={datePickerRef}
              selected={draft.checkIn ? new Date(draft.checkIn) : null}
              onChange={handleDateChange}
              monthsShown={2}
              minDate={new Date()}
              open={isCalendarOpen}
              onCalendarOpen={() => setIsCalendarOpen(true)}
              onClickOutside={() => setIsCalendarOpen(false)}
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
        {draft.stayType === "day" && (
          <div ref={timeRef} className="w-full sm:w-1/2 md:flex-1 min-w-0 px-3 py-3.5 border-b border-hairline/60 sm:border-b-0 relative">
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
              <span className={`block mt-0.5 text-[12px] truncate ${draft.startTime ? "text-ink" : "text-muted"}`}>
                {draft.startTime || "Select time"}
              </span>
            </button>

            {timeOpen && (
              <div className="absolute left-4 right-4 top-full mt-2 z-50 max-h-56 overflow-y-auto rounded-[12px] border border-hairline bg-white p-1.5 shadow-dropdown">
                {TIME_SLOTS.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => {
                      updateDraft("startTime", time)
                      setTimeOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-[8px] text-[13px] transition-colors cursor-pointer ${
                      draft.startTime === time
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
        <div className="w-full sm:w-1/2 md:flex-1 px-3 py-3.5 border-b border-hairline/60 sm:border-b-0">
          <GuestSelector
            label="Guests"
            value={draft.guests}
            onChange={(val) => updateDraft("guests", val)}
            maxPets={2}
            allowPets
          />
        </div>

        {/* Budget */}
        <div className="w-full sm:w-1/2 md:flex-1 min-w-0 px-3 py-3.5 border-b border-hairline/60 sm:border-b-0">
          <span className="text-[11px] font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">
            Budget
          </span>
          <div className="rounded-[10px] border border-hairline bg-white px-3 py-2.5">
            <BudgetSlider
              value={draft.budgetMax ?? BUDGET_MAX}
              onChange={(v) => setDraft((prev) => ({ ...prev, budgetMax: v, budget: v < BUDGET_MAX ? v : 0 }))}
            />
          </div>
        </div>

        {/* Button */}
        <div className="px-3 py-3.5 flex items-center">
          <motion.div whileHover={canSearch ? { scale: 1.03 } : undefined} whileTap={canSearch ? { scale: 0.97 } : undefined} className="w-full">
            <button
              onClick={handleSearch}
              disabled={!canSearch}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-4 h-11 rounded-full uppercase tracking-wider text-[12px] font-bold transition-all ${
                canSearch
                  ? "bg-ink text-on-primary hover:bg-primary cursor-pointer shadow-sm"
                  : "bg-ink text-on-primary opacity-40 cursor-not-allowed"
              }`}
            >
              <Search className="h-4 w-4" />
              Check Availability
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
