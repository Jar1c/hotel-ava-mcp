import { useState } from "react"
import { format } from "date-fns"
import { DayPicker } from "react-day-picker"
import { Search, Calendar, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SearchBar() {
  const [checkIn, setCheckIn] = useState<Date | undefined>(undefined)
  const [checkOut, setCheckOut] = useState<Date | undefined>(undefined)
  const [guests, setGuests] = useState<number>(2)
  const [showCheckIn, setShowCheckIn] = useState<boolean>(false)
  const [showCheckOut, setShowCheckOut] = useState<boolean>(false)

  return (
    <div className="w-full bg-white rounded-lg shadow-card-hover p-lg">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-md items-end">
        {/* Check-in Date */}
        <div className="relative">
          <label className="typo-caption text-muted block mb-xs">Check In</label>
          <button
            onClick={() => { setShowCheckIn(!showCheckIn); setShowCheckOut(false) }}
            className="w-full flex items-center justify-between px-base py-sm rounded-sm border border-hairline hover:border-primary transition-colors text-left"
          >
            <span className="typo-body-sm text-ink">
              {checkIn ? format(checkIn, "dd MMM yyyy") : "Select date"}
            </span>
            <Calendar className="h-4 w-4 text-muted" />
          </button>
          {showCheckIn && (
            <div className="absolute top-full left-0 mt-xs z-50 bg-white border border-hairline rounded-lg shadow-dropdown p-sm">
              <DayPicker
                mode="single"
                selected={checkIn}
                onSelect={(date) => { setCheckIn(date); setShowCheckIn(false) }}
                disabled={{ before: new Date() }}
              />
            </div>
          )}
        </div>

        {/* Check-out Date */}
        <div className="relative">
          <label className="typo-caption text-muted block mb-xs">Check Out</label>
          <button
            onClick={() => { setShowCheckOut(!showCheckOut); setShowCheckIn(false) }}
            className="w-full flex items-center justify-between px-base py-sm rounded-sm border border-hairline hover:border-primary transition-colors text-left"
          >
            <span className="typo-body-sm text-ink">
              {checkOut ? format(checkOut, "dd MMM yyyy") : "Select date"}
            </span>
            <Calendar className="h-4 w-4 text-muted" />
          </button>
          {showCheckOut && (
            <div className="absolute top-full left-0 mt-xs z-50 bg-white border border-hairline rounded-lg shadow-dropdown p-sm">
              <DayPicker
                mode="single"
                selected={checkOut}
                onSelect={(date) => { setCheckOut(date); setShowCheckOut(false) }}
                disabled={{ before: checkIn || new Date() }}
              />
            </div>
          )}
        </div>

        {/* Guests */}
        <div className="relative">
          <label className="typo-caption text-muted block mb-xs">Guests</label>
          <div className="flex items-center justify-between px-base py-sm rounded-sm border border-hairline">
            <div className="flex items-center gap-sm">
              <Users className="h-4 w-4 text-muted" />
              <span className="typo-body-sm text-ink">{guests} {guests === 1 ? "Guest" : "Guests"}</span>
            </div>
            <div className="flex items-center gap-xs">
              <button
                onClick={() => setGuests(Math.max(1, guests - 1))}
                className="w-6 h-6 rounded-full border border-hairline hover:border-primary transition-colors flex items-center justify-center text-sm"
              >
                -
              </button>
              <button
                onClick={() => setGuests(Math.min(10, guests + 1))}
                className="w-6 h-6 rounded-full border border-hairline hover:border-primary transition-colors flex items-center justify-center text-sm"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Search Button */}
        <div>
          <Button className="w-full bg-primary text-on-primary hover:bg-primary-active py-2.5">
            <Search className="h-4 w-4 mr-sm" />
            Search
          </Button>
        </div>
      </div>
    </div>
  )
}
