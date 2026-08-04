import { useState } from "react"
import { useNavigate } from "react-router"
import { motion } from "motion/react"
import DatePicker from "react-datepicker"
import { format } from "date-fns"
import { Calendar, ChevronDown } from "lucide-react"

export default function SearchBar() {
  const navigate = useNavigate()
  const [checkIn, setCheckIn] = useState<Date | null>(null)
  const [checkOut, setCheckOut] = useState<Date | null>(null)
  const [guests, setGuests] = useState<number>(2)
  const [budget, setBudget] = useState<string>("")

  const handleSearch = () => {
    const searchParams = new URLSearchParams()
    if (checkIn) searchParams.set("checkIn", format(checkIn, "yyyy-MM-dd"))
    if (checkOut) searchParams.set("checkOut", format(checkOut, "yyyy-MM-dd"))
    searchParams.set("guests", String(guests))
    if (budget) searchParams.set("budget", budget)
    navigate({
      pathname: "/rooms",
      search: searchParams.toString()
    })
  }

  return (
    <div className="w-full bg-white rounded-[16px] shadow-card-hover border border-hairline">
      <div className="flex flex-col md:flex-row md:items-center">
        {/* Check In */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Check-In</label>
          <DatePicker
            selected={checkIn}
            onChange={(date: Date | null) => setCheckIn(date)}
            selectsStart
            startDate={checkIn}
            endDate={checkOut}
            minDate={new Date()}
            customInput={
              <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                <Calendar className="h-4 w-4 text-muted shrink-0" />
                <span className="typo-body-sm text-ink truncate">{checkIn ? format(checkIn, "dd/MM/yyyy") : "dd/mm/yyyy"}</span>
              </button>
            }
          />
        </div>

        {/* Check Out */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Check-Out</label>
          <DatePicker
            selected={checkOut}
            onChange={(date: Date | null) => setCheckOut(date)}
            selectsEnd
            startDate={checkIn}
            endDate={checkOut}
            minDate={checkIn || new Date()}
            customInput={
              <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                <Calendar className="h-4 w-4 text-muted shrink-0" />
                <span className="typo-body-sm text-ink truncate">{checkOut ? format(checkOut, "dd/MM/yyyy") : "dd/mm/yyyy"}</span>
              </button>
            }
          />
        </div>

        {/* Guests */}
        <div className="w-1/2 md:flex-1 min-w-0 px-base py-3">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1">Guests</label>
          <div className="relative">
            <select
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
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
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Any"
              min="0"
              className="w-full bg-transparent border-none typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none pl-4 font-semibold"
            />
          </div>
        </div>

        {/* Check Availability Button */}
        <div className="px-base py-3 md:pr-1.5 md:py-1.5 w-full md:w-auto">
          <motion.button
            onClick={handleSearch}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full md:w-auto flex items-center justify-center gap-2 px-5 h-12 rounded-[16px] bg-primary text-on-primary hover:bg-primary-active transition-colors cursor-pointer"
          >
            <span className="typo-body-sm font-semibold whitespace-nowrap">Check Availability</span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
