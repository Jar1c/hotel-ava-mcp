import { useState, useRef } from "react"
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
  sortBy: "price-asc" | "price-desc" | "rating"
}

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
    <div className="w-full bg-white rounded-[16px] shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_6px_0_rgba(0,0,0,0.04),0_4px_8px_0_rgba(0,0,0,0.1)] border border-[#D5DADF] mb-lg">
      <div className="flex flex-col md:flex-row md:items-center">
        {/* Check In */}
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-4 relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5 cursor-pointer">
            Check-In
          </label>
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-ink">{draft.checkIn ? format(new Date(draft.checkIn), "MM/dd/yy") : "mm/dd/yy"}</span>
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
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-4 relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5 cursor-pointer">
            Check-Out
          </label>
          <button
            type="button"
            onClick={() => setIsCalendarOpen(true)}
            className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-ink">
              {draft.checkOut ? format(new Date(draft.checkOut), "MM/dd/yy") : "mm/dd/yy"}
            </span>
          </button>
        </div>

        {/* Guests */}
        <div className="w-1/2 md:flex-1 px-5 py-4">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Guests</label>
          <GuestSelector value={draft.guests} onChange={(val) => updateDraft("guests", val)} />
        </div>

        {/* Budget */}
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-4">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Budget</label>
          <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-ink pointer-events-none">&#x20B1;</span>
            <input
              type="number"
              value={draft.budget || ""}
              onChange={(e) => updateDraft("budget", e.target.value ? Number(e.target.value) : 0)}
              placeholder="Any"
              min="0"
              className="w-full bg-transparent border-none typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none pl-4 font-semibold"
            />
          </div>
        </div>

        {/* Check Availability Button */}
        <div className="px-5 py-4 md:pr-3 md:py-3 w-full md:w-auto">
          <motion.div whileHover={canSearch ? { scale: 1.03 } : undefined} whileTap={canSearch ? { scale: 0.97 } : undefined}>
            <button
              onClick={handleSearch}
              disabled={!canSearch}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 h-12 rounded-[12px] transition-colors ${
                canSearch
                  ? "bg-[#82285f] text-[#FBF9F4] hover:bg-[#6b1f4d] cursor-pointer"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              <Search className="h-4 w-4" />
              <span className="typo-body-sm font-semibold whitespace-nowrap">Check Availability</span>
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
