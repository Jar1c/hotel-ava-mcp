import { useState } from "react"
import { format } from "date-fns"
import { DayPicker } from "react-day-picker"
import { Search, Calendar, Users, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function SearchBar() {
  const [checkIn, setCheckIn] = useState<Date | undefined>(undefined)
  const [checkOut, setCheckOut] = useState<Date | undefined>(undefined)
  const [guests, setGuests] = useState<number>(2)
  const [budget, setBudget] = useState<number>(500)
  const [showCheckIn, setShowCheckIn] = useState<boolean>(false)
  const [showCheckOut, setShowCheckOut] = useState<boolean>(false)

  return (
    <div className="w-full bg-canvas rounded-lg border border-hairline shadow-dropdown p-base">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-base">
        {/* Check-in Date */}
        <div className="relative">
          <label className="typo-caption text-muted block mb-xs">Check-in</label>
          <button
            onClick={() => { setShowCheckIn(!showCheckIn); setShowCheckOut(false) }}
            className="w-full flex items-center justify-between px-base py-sm rounded-sm border border-hairline bg-canvas hover:border-primary transition-colors text-left"
          >
            <span className="typo-body-sm text-ink">
              {checkIn ? format(checkIn, "MMM dd, yyyy") : "Select date"}
            </span>
            <Calendar className="h-4 w-4 text-muted" />
          </button>
          {showCheckIn && (
            <div className="absolute top-full left-0 mt-xs z-50 bg-canvas border border-hairline rounded-lg shadow-dropdown p-sm">
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
          <label className="typo-caption text-muted block mb-xs">Check-out</label>
          <button
            onClick={() => { setShowCheckOut(!showCheckOut); setShowCheckIn(false) }}
            className="w-full flex items-center justify-between px-base py-sm rounded-sm border border-hairline bg-canvas hover:border-primary transition-colors text-left"
          >
            <span className="typo-body-sm text-ink">
              {checkOut ? format(checkOut, "MMM dd, yyyy") : "Select date"}
            </span>
            <Calendar className="h-4 w-4 text-muted" />
          </button>
          {showCheckOut && (
            <div className="absolute top-full left-0 mt-xs z-50 bg-canvas border border-hairline rounded-lg shadow-dropdown p-sm">
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
        <div>
          <label className="typo-caption text-muted block mb-xs">Guests</label>
          <div className="flex items-center gap-sm px-base py-sm rounded-sm border border-hairline bg-canvas">
            <Users className="h-4 w-4 text-muted" />
            <button
              onClick={() => setGuests(Math.max(1, guests - 1))}
              className="w-6 h-6 rounded-full border border-hairline hover:border-primary transition-colors typo-body-sm"
            >
              -
            </button>
            <span className="typo-body-sm text-ink w-8 text-center">{guests}</span>
            <button
              onClick={() => setGuests(Math.min(10, guests + 1))}
              className="w-6 h-6 rounded-full border border-hairline hover:border-primary transition-colors typo-body-sm"
            >
              +
            </button>
          </div>
        </div>

        {/* Budget */}
        <div>
          <label className="typo-caption text-muted block mb-xs">
            Budget: Up to ${budget}/night
          </label>
          <div className="flex items-center gap-sm px-base py-sm rounded-sm border border-hairline bg-canvas">
            <DollarSign className="h-4 w-4 text-muted" />
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="flex-1 h-1 bg-hairline rounded-full appearance-none cursor-pointer accent-primary"
            />
            <span className="typo-body-sm text-ink w-16 text-right">${budget}</span>
          </div>
        </div>
      </div>

      {/* Search Button */}
      <div className="mt-base flex justify-center">
        <Button className="bg-primary text-on-primary hover:bg-primary-active px-xl">
          <Search className="h-4 w-4 mr-sm" />
          Search Rooms
        </Button>
      </div>
    </div>
  )
}