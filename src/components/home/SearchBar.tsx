import { useState, useMemo } from "react"
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

function parseTime(time: string): number {
  const [timePart, period] = time.split(" ")
  let [hours] = timePart.split(":").map(Number)
  if (period === "PM" && hours !== 12) hours += 12
  if (period === "AM" && hours === 12) hours = 0
  return hours
}

export default function SearchBar() {
  const navigate = useNavigate()
  const [stayType, setStayType] = useState<StayType>("overnight")
  const [checkIn, setCheckIn] = useState<Date | null>(null)
  const [checkOut, setCheckOut] = useState<Date | null>(null)
  const [dayUseTime, setDayUseTime] = useState<string>("")
  const [guests, setGuests] = useState<GuestCount>({ adults: 0, children: 0 })
  const [budget, setBudget] = useState<string>("")
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
    } else if (date && checkOut && checkOut <= date) {
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
    if (budget) searchParams.set("budget", budget)
    navigate({
      pathname: "/rooms",
      search: searchParams.toString()
    })
  }

  const handleReset = () => {
    setCheckIn(null)
    setCheckOut(null)
    setDayUseTime("")
  }

  return (
    <div className="w-full bg-white rounded-[16px] shadow-card-hover border border-hairline">
      {/* Stay Type Toggle */}
      <div className="flex border-b border-hairline">
        <button
          type="button"
          onClick={() => handleStayTypeChange("overnight")}
          className={`flex-1 py-3 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            stayType === "overnight"
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-ink"
          }`}
        >
          Overnight Stay
        </button>
        <button
          type="button"
          onClick={() => handleStayTypeChange("day")}
          className={`flex-1 py-3 text-center typo-body-sm font-semibold transition-colors cursor-pointer ${
            stayType === "day"
              ? "text-primary border-b-2 border-primary"
              : "text-muted hover:text-ink"
          }`}
        >
          Day Use
        </button>
      </div>

      {/* Fields */}
      <div className="flex flex-col md:flex-row md:items-stretch">
        {/* Check In / Select Date */}
        <div className="flex-1 min-w-0 px-5 py-4 border-b md:border-b-0 md:border-r border-hairline relative">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5 cursor-pointer">
            {isDayUse ? "Select Date" : "Check-In"}
          </label>
          <button
            type="button"
            onClick={() => setCheckInOpen(true)}
            className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
          >
            <Calendar className="h-4 w-4 text-muted shrink-0" />
            <span className="typo-body-sm text-muted">{checkIn ? format(checkIn, "MMM dd, yyyy") : "Select date"}</span>
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
                  }}
                  className="typo-button-sm bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </DatePicker>
          </div>
        </div>

        {/* Check Out - overnight only */}
        {!isDayUse && (
          <div className="flex-1 min-w-0 px-5 py-4 border-b md:border-b-0 md:border-r border-hairline relative">
            <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5 cursor-pointer">
              Check-Out
            </label>
            <button
              type="button"
              onClick={() => setCheckOutOpen(true)}
              className="w-full flex items-center gap-2 text-left bg-transparent border-none p-0 cursor-pointer"
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
                minDate={checkIn || new Date()}
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

        {/* Time - day use only */}
        {isDayUse && (
          <div className="flex-1 min-w-0 px-5 py-4 border-b md:border-b-0 md:border-r border-hairline">
            <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">
              Time
            </label>
            <div className="flex items-center gap-2">
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
        <div className="flex-1 min-w-0 px-5 py-4 border-b md:border-b-0 md:border-r border-hairline">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Guests</label>
          <GuestSelector value={guests} onChange={setGuests} />
        </div>

        {/* Budget */}
        <div className="flex-1 min-w-0 px-5 py-4 border-b md:border-b-0 md:border-r border-hairline">
          <label className="typo-caption font-display font-semibold text-ink uppercase tracking-wider block mb-1.5">Budget</label>
          <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted pointer-events-none">&#x20B1;</span>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Any"
              min="0"
              className="w-full bg-transparent border-none typo-body-sm text-ink placeholder:text-muted-soft focus:outline-none pl-4 font-medium"
            />
          </div>
        </div>

        {/* Button */}
        <div className="px-5 py-4 flex items-center">
          <motion.button
            onClick={handleSearch}
            disabled={!canSearch}
            whileHover={canSearch ? { scale: 1.03 } : undefined}
            whileTap={canSearch ? { scale: 0.97 } : undefined}
            className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 h-12 rounded-[12px] transition-colors ${
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
