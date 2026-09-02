import { useState, useRef } from "react"
import { useNavigate } from "react-router"
import { motion } from "motion/react"
import DatePicker from "react-datepicker"
import { format } from "date-fns"
import { Calendar } from "lucide-react"
import GuestSelector, { type GuestCount } from "@/components/ui/guest-selector"

export type StayType = "overnight" | "day"

export default function SearchBar() {
  const navigate = useNavigate()
  const [checkIn, setCheckIn] = useState<Date | null>(null)
  const [checkOut, setCheckOut] = useState<Date | null>(null)
  const [guests, setGuests] = useState<GuestCount>({ adults: 2, children: 0 })
  const [budget, setBudget] = useState<string>("")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const datePickerRef = useRef<DatePicker>(null)

  const canSearch = checkIn && checkOut

  const handleDateChange = (dates: [Date | null, Date | null] | null) => {
    if (!dates) return
    const [start, end] = dates
    setCheckIn(start)
    if (start && end) {
      setCheckOut(end)
    } else {
      setCheckOut(null)
    }
  }

  const handleSearch = () => {
    if (!canSearch) return
    const searchParams = new URLSearchParams()
    searchParams.set("stayType", "overnight")
    if (checkIn) searchParams.set("checkIn", format(checkIn, "yyyy-MM-dd"))
    if (checkOut) searchParams.set("checkOut", format(checkOut, "yyyy-MM-dd"))
    searchParams.set("adults", String(guests.adults))
    searchParams.set("children", String(guests.children))
    if (budget) searchParams.set("budget", budget)
    navigate({
      pathname: "/rooms",
      search: searchParams.toString()
    })
  }

  const handleReset = () => {
    setCheckIn(null)
    setCheckOut(null)
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
          setCalendarOpen(false)
        }}
        className="typo-button-sm bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
      >
        Done
      </button>
    </div>
  )

  return (
    <div className="w-full bg-white rounded-[16px] shadow-card-hover border border-hairline">
      <div className="flex flex-col md:flex-row md:items-center">
        {/* Check In */}
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-5 relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5 cursor-pointer">
            Check-In
          </label>
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-ink">{checkIn ? format(checkIn, "MM/dd/yy") : "mm/dd/yy"}</span>
          </button>

          <div className="absolute left-0 bottom-0 h-0 w-0">
            <DatePicker
              ref={datePickerRef}
              selected={checkIn}
              onChange={handleDateChange}
              startDate={checkIn}
              endDate={checkOut}
              selectsRange
              monthsShown={2}
              minDate={new Date()}
              open={calendarOpen}
              onCalendarOpen={() => setCalendarOpen(true)}
              onClickOutside={() => setCalendarOpen(false)}
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
        <div className="w-1/2 md:flex-1 min-w-0 px-5 py-5 relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5 cursor-pointer">
            Check-Out
          </label>
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-ink">
              {checkOut ? format(checkOut, "MM/dd/yy") : "mm/dd/yy"}
            </span>
          </button>
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
