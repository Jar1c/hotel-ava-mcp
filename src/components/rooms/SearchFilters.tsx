import { useState } from "react"
import { motion } from "motion/react"
import { format } from "date-fns"
import DatePicker from "react-datepicker"
import { Calendar, ChevronDown } from "lucide-react"

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
  const [filters, setFilters] = useState<FilterState>(initialFilters)

  const updateFilter = (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleCheckInChange = (date: Date | null) => {
    if (date) {
      updateFilter("checkIn", format(date, "yyyy-MM-dd"))
    } else {
      updateFilter("checkIn", "")
    }
  }

  const handleCheckOutChange = (date: Date | null) => {
    if (date) {
      updateFilter("checkOut", format(date, "yyyy-MM-dd"))
    } else {
      updateFilter("checkOut", "")
    }
  }

  return (
    <motion.div
      className="w-full bg-canvas rounded-[16px] shadow-card-hover border border-hairline mb-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] as const }}
    >
      <div className="flex flex-col md:flex-row md:items-center">
        {/* Check In */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Check-In</label>
          <DatePicker
            selected={filters.checkIn ? new Date(filters.checkIn) : null}
            onChange={handleCheckInChange}
            selectsStart
            startDate={filters.checkIn ? new Date(filters.checkIn) : null}
            endDate={filters.checkOut ? new Date(filters.checkOut) : null}
            minDate={new Date()}
            customInput={
              <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                <Calendar className="h-4 w-4 text-muted shrink-0" />
                <span className="typo-body-sm text-ink truncate">{filters.checkIn ? format(new Date(filters.checkIn), "dd/MM/yyyy") : "dd/mm/yyyy"}</span>
              </button>
            }
          />
        </div>

        {/* Check Out */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Check-Out</label>
          <DatePicker
            selected={filters.checkOut ? new Date(filters.checkOut) : null}
            onChange={handleCheckOutChange}
            selectsEnd
            startDate={filters.checkIn ? new Date(filters.checkIn) : null}
            endDate={filters.checkOut ? new Date(filters.checkOut) : null}
            minDate={filters.checkIn ? new Date(filters.checkIn) : new Date()}
            customInput={
              <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                <Calendar className="h-4 w-4 text-muted shrink-0" />
                <span className="typo-body-sm text-ink truncate">{filters.checkOut ? format(new Date(filters.checkOut), "dd/MM/yyyy") : "dd/mm/yyyy"}</span>
              </button>
            }
          />
        </div>

        {/* Guests */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Guests</label>
          <div className="relative">
            <select
              value={filters.guests}
              onChange={(e) => updateFilter("guests", Number(e.target.value))}
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
              value={filters.budget || ""}
              onChange={(e) => updateFilter("budget", e.target.value ? Number(e.target.value) : 0)}
              placeholder="Any"
              min="0"
              className="w-full bg-transparent border-none typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none pl-4 font-semibold"
            />
          </div>
        </div>

        {/* Check Availability Button */}
        <div className="px-base py-3 md:pr-1.5 md:py-1.5 w-full md:w-auto">
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <div className="w-full md:w-auto flex items-center justify-center gap-2 px-5 h-12 rounded-[16px] bg-primary text-on-primary hover:bg-primary-active transition-colors cursor-pointer">
              <span className="typo-body-sm font-semibold whitespace-nowrap">Check Availability</span>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
