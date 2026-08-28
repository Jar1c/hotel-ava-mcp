import { useState } from "react"
import { motion } from "motion/react"
import { format } from "date-fns"
import DatePicker from "react-datepicker"
import { Calendar, ChevronDown, Search } from "lucide-react"

interface SearchFiltersProps {
  initialFilters: FilterState
  onFilterChange: (filters: FilterState) => void
}

export interface FilterState {
  checkIn: string
  checkOut: string
  guests: number
  budget: number
  sortBy: "price-asc" | "price-desc" | "rating"
}

export default function SearchFilters({ initialFilters, onFilterChange }: SearchFiltersProps) {
  const [draft, setDraft] = useState<FilterState>(initialFilters)

  const updateDraft = (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const canSearch = draft.checkIn !== "" && draft.checkOut !== ""

  const handleSearch = () => {
    if (!canSearch) return
    onFilterChange(draft)
  }

  const handleCheckInChange = (date: Date | null) => {
    if (date) {
      updateDraft("checkIn", format(date, "yyyy-MM-dd"))
    } else {
      updateDraft("checkIn", "")
    }
  }

  const handleCheckOutChange = (date: Date | null) => {
    if (date) {
      updateDraft("checkOut", format(date, "yyyy-MM-dd"))
    } else {
      updateDraft("checkOut", "")
    }
  }

  return (
    <div className="w-full bg-white rounded-[16px] shadow-[0_0_0_1px_rgba(0,0,0,0.02),0_2px_6px_0_rgba(0,0,0,0.04),0_4px_8px_0_rgba(0,0,0,0.1)] border border-[#D5DADF] mb-lg">
      <div className="flex flex-col md:flex-row md:items-center">
        {/* Check In */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Check-In</label>
          <DatePicker
            selected={draft.checkIn ? new Date(draft.checkIn) : null}
            onChange={handleCheckInChange}
            selectsStart
            startDate={draft.checkIn ? new Date(draft.checkIn) : null}
            endDate={draft.checkOut ? new Date(draft.checkOut) : null}
            minDate={new Date()}
            customInput={
              <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                <Calendar className="h-4 w-4 text-muted shrink-0" />
                <span className="typo-body-sm text-ink truncate">{draft.checkIn ? format(new Date(draft.checkIn), "dd/MM/yyyy") : "dd/mm/yyyy"}</span>
              </button>
            }
          />
        </div>

        {/* Check Out */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Check-Out</label>
          <DatePicker
            selected={draft.checkOut ? new Date(draft.checkOut) : null}
            onChange={handleCheckOutChange}
            selectsEnd
            startDate={draft.checkIn ? new Date(draft.checkIn) : null}
            endDate={draft.checkOut ? new Date(draft.checkOut) : null}
            minDate={draft.checkIn ? new Date(draft.checkIn) : new Date()}
            customInput={
              <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                <Calendar className="h-4 w-4 text-muted shrink-0" />
                <span className="typo-body-sm text-ink truncate">{draft.checkOut ? format(new Date(draft.checkOut), "dd/MM/yyyy") : "dd/mm/yyyy"}</span>
              </button>
            }
          />
        </div>

        {/* Guests */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Guests</label>
          <div className="relative">
            <select
              value={draft.guests}
              onChange={(e) => updateDraft("guests", Number(e.target.value))}
              className="w-full bg-transparent border-none typo-body-sm text-ink focus:outline-none appearance-none cursor-pointer pr-4 font-semibold"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "Guest" : "Guests"}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Budget */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Budget</label>
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
        <div className="px-base py-3 md:pr-1.5 md:py-1.5 w-full md:w-auto">
          <motion.div whileHover={canSearch ? { scale: 1.03 } : undefined} whileTap={canSearch ? { scale: 0.97 } : undefined}>
            <button
              onClick={handleSearch}
              disabled={!canSearch}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-5 h-12 rounded-[12px] transition-colors ${
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
