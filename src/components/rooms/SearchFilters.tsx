import { useState, useRef, useCallback, useEffect } from "react"
import { motion } from "motion/react"
import { format } from "date-fns"
import DatePicker from "react-datepicker"
import { Calendar, Search } from "lucide-react"
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
  guests: GuestCount
  budget: number
  budgetMax: number
  sortBy: "price-asc" | "price-desc" | "rating"
}

const BUDGET_MAX = 5000
const BUDGET_STEP = 100

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
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[13px] font-semibold text-ink">{label}</span>
      </div>
      <div ref={trackRef} className="relative h-6 flex items-center cursor-pointer select-none touch-none">
        <div className="absolute w-full h-[3px] rounded-full bg-gray-200" />
        <div className="absolute h-[3px] rounded-full bg-[#82285f]" style={{ width: `${pct}%` }} />
        <div
          onPointerDown={handlePointerDown}
          className="absolute w-5 h-5 rounded-full bg-white border-[2.5px] border-[#82285f] shadow-md cursor-grab active:cursor-grabbing -translate-x-1/2 z-10 hover:scale-110 transition-transform"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-[10px] text-gray-400">₱0</span>
        <span className="text-[10px] text-gray-400">₱5,000</span>
      </div>
    </div>
  )
}

/* ── SearchFilters ────────────────────────────────────────────────────────── */

export default function SearchFilters({ initialFilters, onFilterChange }: SearchFiltersProps) {
  const [draft, setDraft] = useState<FilterState>(initialFilters)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const datePickerRef = useRef<DatePicker>(null)

  const updateDraft = (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const canSearch = draft.checkIn !== "" && draft.checkOut !== ""

  const handleDateChange = (dates: [Date | null, Date | null] | null) => {
    if (!dates) return
    const [start, end] = dates
    if (start) {
      updateDraft("checkIn", format(start, "yyyy-MM-dd"))
    } else {
      updateDraft("checkIn", "")
    }
    if (start && end) {
      updateDraft("checkOut", format(end, "yyyy-MM-dd"))
    } else {
      updateDraft("checkOut", "")
    }
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
          setIsCalendarOpen(false)
        }}
        className="typo-button-sm bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
      >
        Done
      </button>
    </div>
  )

  return (
    <div className="w-full bg-white rounded-[20px] shadow-card-hover border border-hairline/60 mb-lg overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center">
        {/* Check In */}
        <div className="w-1/2 md:flex-1 min-w-0 px-6 py-5 relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2 cursor-pointer">
            Check-In
          </label>
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="w-full flex items-center gap-2.5 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-ink">
              {draft.checkIn ? format(new Date(draft.checkIn), "MM/dd/yy") : "mm/dd/yy"}
            </span>
          </button>

          <div className="absolute left-0 bottom-0 h-0 w-0">
            <DatePicker
              ref={datePickerRef}
              selected={draft.checkIn ? new Date(draft.checkIn) : null}
              onChange={handleDateChange}
              startDate={draft.checkIn ? new Date(draft.checkIn) : null}
              endDate={draft.checkOut ? new Date(draft.checkOut) : null}
              selectsRange
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

        {/* Check Out */}
        <div className="w-1/2 md:flex-1 min-w-0 px-6 py-5 relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2 cursor-pointer">
            Check-Out
          </label>
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="w-full flex items-center gap-2.5 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-ink">
              {draft.checkOut ? format(new Date(draft.checkOut), "MM/dd/yy") : "mm/dd/yy"}
            </span>
          </button>
        </div>

        {/* Guests */}
        <div className="w-1/2 md:flex-1 px-6 py-5 border-t md:border-t-0 md:border-l border-hairline/60">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2">Guests</label>
          <GuestSelector value={draft.guests} onChange={(val) => updateDraft("guests", val)} />
        </div>

        {/* Budget */}
        <div className="w-1/2 md:flex-1 min-w-0 px-6 py-5 border-t md:border-t-0 md:border-l border-hairline/60">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-2">Budget</label>
          <BudgetSlider
            value={draft.budgetMax ?? BUDGET_MAX}
            onChange={(v) => setDraft((prev) => ({ ...prev, budgetMax: v, budget: v < BUDGET_MAX ? v : 0 }))}
          />
        </div>

        {/* Button */}
        <div className="px-6 py-5 md:border-l border-hairline/60 flex items-center justify-center md:min-w-[180px]">
          <motion.div whileHover={canSearch ? { scale: 1.03 } : undefined} whileTap={canSearch ? { scale: 0.97 } : undefined}>
            <button
              onClick={handleSearch}
              disabled={!canSearch}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-7 h-12 rounded-[14px] font-semibold typo-body-sm transition-all ${
                canSearch
                  ? "bg-[#82285f] text-[#FBF9F4] hover:bg-[#6b1f4d] cursor-pointer shadow-sm"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
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
