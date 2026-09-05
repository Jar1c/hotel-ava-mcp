import { useState, useEffect, useMemo } from "react"
import { useParams, Link, useNavigate, useSearchParams } from "react-router"
import { motion } from "motion/react"
import DatePicker from "react-datepicker"
import {
  Star, Users, ArrowLeft, Check,
  Wifi, Wind, Wine, ConciergeBell, Building2, BedDouble,
  TreePine, Coffee, Sunrise, Bath, UserCheck, Sofa,
  Baby, Waves, Fence, Droplets, Monitor, Armchair,
  Shirt, Fish, Sunset, UtensilsCrossed, Tv, Sparkles, Music, Clock
} from "lucide-react"
import { Button } from "@/components/ui/button"
import DateInput from "@/components/ui/date-input"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import { getAmenityIcon, rooms as fallbackRooms, type Room } from "@/data/rooms"
import { getCached, setCache } from "@/lib/cache"
import PhotoGallery from "@/components/rooms/PhotoGallery"
import { useAuth } from "@/contexts/AuthContext"

const lucideIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi, Wind, Wine, ConciergeBell, Building2, BedDouble,
  TreePine, Coffee, Sunrise, Bath, UserCheck, Sofa,
  Baby, Waves, Fence, Droplets, Monitor, Armchair,
  Shirt, Fish, Sunset, UtensilsCrossed, Tv, Sparkles, Music
}

const DAY_USE_DURATIONS = [4, 6, 8, 12] as const

function generateStartTimes(maxHour: number = 20): string[] {
  const times: string[] = []
  for (let h = 6; h <= maxHour; h++) {
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    times.push(`${hour12}:00 ${period}`)
  }
  return times
}

function addHoursToTime(timeStr: string, hours: number): string {
  const match = timeStr.match(/(\d+):00\s*(AM|PM)/i)
  if (!match) return ""
  let h = parseInt(match[1])
  const period = match[2].toUpperCase()
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h = 0
  h += hours
  const endPeriod = h >= 12 ? "PM" : "AM"
  const endH12 = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${endH12}:00 ${endPeriod}`
}

function DetailSkeleton() {
  return (
    <div className="px-base py-section animate-pulse">
      <div className="max-w-container mx-auto">
        <div className="h-4 bg-gray-200 rounded w-24 mb-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2">
            <div className="aspect-[16/9] bg-gray-200 rounded-lg" />
            <div className="mt-lg space-y-3">
              <div className="h-6 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-1/6" />
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="border-t border-hairline pt-lg mt-lg">
                <div className="h-5 bg-gray-200 rounded w-1/4 mb-3" />
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-5/6" />
                </div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-canvas border border-hairline rounded-[12px] p-lg space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-10 bg-gray-200 rounded" />
              <div className="h-12 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RoomDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [stayType, setStayType] = useState<"overnight" | "day">("overnight")
  const [checkIn, setCheckIn] = useState<Date | null>(() => {
    const v = searchParams.get("checkIn")
    return v ? new Date(v) : null
  })
  const [checkOut, setCheckOut] = useState<Date | null>(() => {
    const v = searchParams.get("checkOut")
    return v ? new Date(v) : null
  })
  const [guests, setGuests] = useState(() => Number(searchParams.get("guests")) || 1)
  const [stays, setStays] = useState<string>(searchParams.get("stays") || "24 Hours")
  const [dayDuration, setDayDuration] = useState<number>(4)
  const [startTime, setStartTime] = useState<string>("10:00 AM")
  const [showAuthModal, setShowAuthModal] = useState(false)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let checkInDate = searchParams.get("checkIn")
    let checkOutDate = searchParams.get("checkOut")
    let guestsValue = searchParams.get("guests")

    if (!checkInDate && !checkOutDate) {
      const returnTo = searchParams.get("returnTo")
      if (returnTo) {
        let params = new URLSearchParams()
        const questionMarkIndex = returnTo.indexOf("?")
        const hashIndex = returnTo.indexOf("#")

        if (questionMarkIndex !== -1) {
          params = new URLSearchParams(returnTo.substring(questionMarkIndex + 1))
        } else if (hashIndex !== -1) {
          params = new URLSearchParams(returnTo.substring(hashIndex + 1))
        }

        checkInDate = params.get("checkIn")
        checkOutDate = params.get("checkOut")
        guestsValue = params.get("guests")
      }
    }

    setCheckIn(checkInDate ? new Date(checkInDate) : null)
    setCheckOut(checkOutDate ? new Date(checkOutDate) : null)
    setGuests(guestsValue ? Number(guestsValue) : 1)
  }, [searchParams])

  useEffect(() => {
    if (!id) return

    const cached = getCached<PublicRoomData>(`room_${id}`)
    if (cached) {
      setRoom({
        id: cached.id,
        name: cached.name,
        type: cached.type,
        description: cached.description,
        price: cached.price,
        capacity: cached.capacity,
        amenities: cached.amenities,
        images: cached.images.length > 0 ? cached.images : fallbackRooms[0].images,
      })
      setLoading(false)
    }

    publicRoomsApi.getById(id)
      .then((data: PublicRoomData) => {
        setRoom({
          id: data.id,
          name: data.name,
          type: data.type,
          description: data.description,
          price: data.price,
          capacity: data.capacity,
          amenities: data.amenities,
          images: data.images.length > 0 ? data.images : fallbackRooms[0].images,
        })
        setCache(`room_${id}`, data)
      })
      .catch(() => {
        if (!cached) {
          const fallback = fallbackRooms.find(r => r.id === id)
          setRoom(fallback || null)
        }
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <DetailSkeleton />

  if (!room) {
    return (
      <div className="px-base py-section text-center">
        <h1 className="typo-display-xl text-ink mb-md">Room Not Found</h1>
        <p className="typo-body-md text-muted mb-lg">
          The room you're looking for doesn't exist.
        </p>
        <Link to="/rooms">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rooms
          </Button>
        </Link>
      </div>
    )
  }

  const startTimes = useMemo(() => {
    const maxStart = 24 - dayDuration
    return generateStartTimes(maxStart)
  }, [dayDuration])

  const endTime = useMemo(() => addHoursToTime(startTime, dayDuration), [startTime, dayDuration])

  const dayUsePrice = stayType === "day" ? Math.round(room.price * (dayDuration / 24)) : 0
  const totalPrice = stayType === "day"
    ? dayUsePrice + Math.round(dayUsePrice * 0.12)
    : room.price + Math.round(room.price * 0.12)

  return (
    <div className="px-base py-section">
      <div className="max-w-container mx-auto">
        <Link
          to="/rooms"
          className="inline-flex items-center gap-2 text-muted hover:text-ink transition-colors mb-lg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="typo-body-sm">Back to Rooms</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div className="lg:col-span-2">
            <PhotoGallery images={room.images} alt={room.name} />

            <div className="mt-lg">
              <div className="flex items-start justify-between mb-md">
                <div>
                  <h1 className="typo-display-lg text-ink">{room.name}</h1>
                  <p className="typo-body-sm text-muted">{room.type}</p>
                </div>
                {room.rating != null && (
                  <div className="flex items-center gap-2 bg-surface-soft px-3 py-1 rounded-full">
                    <Star className="h-4 w-4 fill-star-rating text-star-rating" />
                    <span className="typo-title-sm text-ink">{room.rating}</span>
                    {room.reviews != null && (
                      <span className="typo-caption-sm text-muted">({room.reviews} reviews)</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 mb-lg text-muted">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="typo-body-sm">Up to {room.capacity} guests</span>
                </div>
              </div>

              <div className="border-t border-hairline pt-lg">
                <h2 className="typo-display-sm text-ink mb-md">About this room</h2>
                <p className="typo-body-md text-body leading-relaxed">{room.description}</p>
              </div>

              <div className="border-t border-hairline pt-lg mt-lg">
                <h2 className="typo-display-sm text-ink mb-md">Amenities</h2>
                <div className="grid grid-cols-2 gap-sm">
                  {room.amenities.map((amenity) => {
                    const iconName = getAmenityIcon(amenity)
                    const IconComponent = lucideIconMap[iconName] || Sparkles
                    return (
                      <div
                        key={amenity}
                        className="flex items-center gap-2 py-2"
                      >
                        <IconComponent className="h-4 w-4 text-muted" />
                        <span className="typo-body-sm text-ink">{amenity}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-canvas border border-hairline rounded-[12px] p-lg">
              {/* Price Display */}
              <div className="mb-lg">
                <div className="flex items-baseline gap-1">
                  <span className="typo-display-lg text-secondary">&#x20B1;{(stayType === "day" ? dayUsePrice : room.price).toLocaleString()}</span>
                  <span className="typo-body-sm text-muted">/ {stayType === "day" ? `${dayDuration}h` : "night"}</span>
                </div>
              </div>

              {/* Stay Type Toggle */}
              <div className="flex gap-2 mb-lg">
                <button
                  type="button"
                  onClick={() => setStayType("overnight")}
                  className={`flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all ${
                    stayType === "overnight"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-white text-muted border border-hairline hover:border-primary/30"
                  }`}
                >
                  Overnight Stay
                </button>
                <button
                  type="button"
                  onClick={() => setStayType("day")}
                  className={`flex-1 py-2.5 rounded-[12px] text-sm font-semibold transition-all ${
                    stayType === "day"
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-white text-muted border border-hairline hover:border-primary/30"
                  }`}
                >
                  Day Use
                </button>
              </div>

              {/* Overnight: Date pickers */}
              {stayType === "overnight" && (
                <div className="space-y-md mb-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="typo-caption text-muted block mb-xs">Check-in</label>
                      <DatePicker
                        selected={checkIn}
                        onChange={(date: Date | null) => setCheckIn(date)}
                        selectsStart
                        startDate={checkIn}
                        endDate={checkOut}
                        minDate={new Date()}
                        customInput={<DateInput placeholder="Select date" />}
                        placeholderText="Select date"
                      />
                    </div>
                    <div>
                      <label className="typo-caption text-muted block mb-xs">Check-out</label>
                      <DatePicker
                        selected={checkOut}
                        onChange={(date: Date | null) => setCheckOut(date)}
                        selectsEnd
                        startDate={checkIn}
                        endDate={checkOut}
                        minDate={checkIn || new Date()}
                        customInput={<DateInput placeholder="Select date" />}
                        placeholderText="Select date"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Stays</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                      <select
                        value={stays}
                        onChange={(e) => setStays(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-[12px] border border-hairline bg-white typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none"
                      >
                        <option value="12 Hours">12 Hours</option>
                        <option value="24 Hours">24 Hours</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Guests</label>
                    <select
                      value={guests}
                      onChange={(e) => setGuests(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-[12px] border border-hairline bg-white typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none"
                    >
                      {Array.from({ length: room.capacity }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "Guest" : "Guests"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Day Use: Duration + Start Time */}
              {stayType === "day" && (
                <div className="space-y-md mb-lg">
                  <div>
                    <label className="typo-caption text-muted block mb-xs">Select Date</label>
                    <DatePicker
                      selected={checkIn}
                      onChange={(date: Date | null) => setCheckIn(date)}
                      minDate={new Date()}
                      customInput={<DateInput placeholder="Select date" />}
                      placeholderText="Select date"
                    />
                  </div>

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Duration</label>
                    <div className="grid grid-cols-4 gap-2">
                      {DAY_USE_DURATIONS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setDayDuration(d)
                            const maxStart = 24 - d
                            const currentMaxHour = parseInt(startTime) + (startTime.includes("PM") && !startTime.startsWith("12") ? 12 : startTime.startsWith("12") && startTime.includes("PM") ? 12 : 0)
                            if (currentMaxHour > maxStart) {
                              setStartTime(`${maxStart > 12 ? maxStart - 12 : maxStart}:00 ${maxStart >= 12 ? "PM" : "AM"}`)
                            }
                          }}
                          className={`py-2.5 rounded-[10px] text-sm font-semibold transition-all ${
                            dayDuration === d
                              ? "bg-primary text-on-primary shadow-sm"
                              : "bg-white text-muted border border-hairline hover:border-primary/30"
                          }`}
                        >
                          {d}h
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Start Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                      <select
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-[12px] border border-hairline bg-white typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none"
                      >
                        {startTimes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                  </div>

                  {checkIn && (
                    <div className="bg-primary/5 border border-primary/10 rounded-[10px] px-3 py-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm text-ink font-medium">
                        {startTime} – {endTime}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Guests</label>
                    <select
                      value={guests}
                      onChange={(e) => setGuests(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-[12px] border border-hairline bg-white typo-body-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none"
                    >
                      {Array.from({ length: room.capacity }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "Guest" : "Guests"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Book Now Button */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  className="w-full bg-primary text-on-primary hover:bg-primary-active !rounded-[12px]"
                  onClick={() => {
                    if (!isAuthenticated) {
                      setShowAuthModal(true)
                    } else {
                      const params = new URLSearchParams()
                      params.set("stayType", stayType)
                      if (checkIn) params.set("checkIn", checkIn.toISOString())
                      if (stayType === "overnight" && checkOut) params.set("checkOut", checkOut.toISOString())
                      if (stayType === "day") {
                        params.set("duration", String(dayDuration))
                        params.set("startTime", startTime)
                      }
                      params.set("guests", String(guests))
                      if (stayType === "overnight") params.set("stays", stays)
                      navigate(`/booking/${id}?${params.toString()}`)
                    }
                  }}
                >
                  Book Now
                </Button>
              </motion.div>

              {/* Price Breakdown */}
              <div className="mt-lg pt-lg border-t border-hairline">
                <div className="flex justify-between mb-sm">
                  <span className="typo-body-sm text-muted">
                    {stayType === "day" ? `Day Use (${dayDuration}h)` : "Per night"}
                  </span>
                  <span className="typo-body-sm text-ink">&#x20B1;{(stayType === "day" ? dayUsePrice : room.price).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-sm">
                  <span className="typo-body-sm text-muted">Taxes & fees</span>
                  <span className="typo-body-sm text-ink">&#x20B1;{Math.round((stayType === "day" ? dayUsePrice : room.price) * 0.12).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium pt-sm border-t border-hairline">
                  <span className="typo-body-md text-ink">Total</span>
                  <span className="typo-body-md text-ink">&#x20B1;{totalPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* Highlights */}
              <div className="mt-lg">
                <h3 className="typo-caption text-muted mb-sm">Highlights</h3>
                <ul className="space-y-sm">
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-success" />
                    Free cancellation up to 24 hours before check-in
                  </li>
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-success" />
                    No prepayment needed
                  </li>
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-success" />
                    Pay at the property
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Required Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setShowAuthModal(false)}>
          <div
            className="bg-white rounded-[12px] shadow-lg p-8 text-center animate-scale-in relative overflow-visible"
            style={{ width: "100%", maxWidth: "360px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowAuthModal(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer z-10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
              <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>

            <h2 className="text-lg font-semibold text-ink mb-2">Sign in to book</h2>
            <p className="text-sm text-muted mb-6">You need an account to make a reservation.</p>

            <div className="space-y-2.5">
              <Button
                onClick={() => navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                className="w-full py-2.5 text-sm font-medium !rounded-[4px] bg-primary text-on-primary hover:bg-primary-active"
              >
                Sign In
              </Button>
              <Button
                onClick={() => navigate(`/register?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)}
                variant="outline"
                className="w-full py-2.5 text-sm font-medium !rounded-[4px]"
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
