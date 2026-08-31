import { useState } from "react"
import { useNavigate } from "react-router"
import { motion } from "motion/react"
import DatePicker from "react-datepicker"
import { format } from "date-fns"
import { Calendar, ChevronDown, Clock } from "lucide-react"
import GuestSelector, { type GuestCount } from "@/components/ui/guest-selector"

export default function SearchBar() {
  const navigate = useNavigate()
  const [checkIn, setCheckIn] = useState<Date | null>(null)
  const [checkOut, setCheckOut] = useState<Date | null>(null)
  const [guests, setGuests] = useState<GuestCount>({ adults: 2, children: 0 })
  const [budget, setBudget] = useState<string>("")
  const [stays, setStays] = useState<string>("24 Hours")

  const canSearch = checkIn !== null && checkOut !== null

  const handleSearch = () => {
    if (!canSearch) return
    const searchParams = new URLSearchParams()
    if (checkIn) searchParams.set("checkIn", format(checkIn, "yyyy-MM-dd"))
    if (checkOut) searchParams.set("checkOut", format(checkOut, "yyyy-MM-dd"))
    searchParams.set("adults", String(guests.adults))
    searchParams.set("children", String(guests.children))
    searchParams.set("stays", stays)
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
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-5 relative z-20">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Check-In</label>
          <div className="relative">
            <DatePicker
              selected={checkIn}
              onChange={(date: Date | null) => setCheckIn(date)}
              selectsStart
              startDate={checkIn}
              endDate={checkOut}
              minDate={new Date()}
              popperPlacement="bottom"
              popperProps={{ strategy: "fixed" }}
              calendarClassName="border border-hairline rounded-[12px] shadow-dropdown"
              wrapperClassName="w-full"
              customInput={
                <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                  <Calendar className="h-4 w-4 text-muted shrink-0" />
                  <span className="typo-body-sm text-ink truncate">{checkIn ? format(checkIn, "MM/dd/yy") : "mm/dd/yy"}</span>
                </button>
              }
            />
          </div>
        </div>

        {/* Check Out */}
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-5 relative z-20">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Check-Out</label>
          <div className="relative">
            <DatePicker
              selected={checkOut}
              onChange={(date: Date | null) => setCheckOut(date)}
              selectsEnd
              startDate={checkIn}
              endDate={checkOut}
              minDate={checkIn || new Date()}
              popperPlacement="bottom"
              popperProps={{ strategy: "fixed" }}
              calendarClassName="border border-hairline rounded-[12px] shadow-dropdown"
              wrapperClassName="w-full"
              customInput={
                <button className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer">
                  <Calendar className="h-4 w-4 text-muted shrink-0" />
                  <span className="typo-body-sm text-ink truncate">{checkOut ? format(checkOut, "MM/dd/yy") : "mm/dd/yy"}</span>
                </button>
              }
            />
          </div>
        </div>

        {/* Stays */}
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-5">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Stays</label>
          <div className="relative">
            <Clock className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <select
              value={stays}
              onChange={(e) => setStays(e.target.value)}
              className="w-full bg-transparent border-none typo-body-sm text-ink focus:outline-none appearance-none cursor-pointer pl-5 pr-4 font-semibold"
            >
              <option value="12 Hours">12 Hours</option>
              <option value="24 Hours">24 Hours</option>
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          </div>
        </div>

        {/* Guests */}
        <div className="w-1/2 md:flex-1 px-5 py-5">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Guests</label>
          <GuestSelector value={guests} onChange={setGuests} />
        </div>

        {/* Budget */}
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-5">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Budget</label>
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
        <div className="px-5 py-5 md:pr-3 md:py-3 w-full md:w-auto">
          <motion.button
            onClick={handleSearch}
            disabled={!canSearch}
            whileHover={canSearch ? { scale: 1.03 } : undefined}
            whileTap={canSearch ? { scale: 0.97 } : undefined}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-5 h-14 rounded-[16px] transition-colors ${
              canSearch
                ? "bg-primary text-on-primary hover:bg-primary-active cursor-pointer"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <span className="typo-body-sm font-semibold whitespace-nowrap">Check Availability</span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
