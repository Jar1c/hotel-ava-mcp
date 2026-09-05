import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router"
import { ArrowLeft, Calendar, Check, CreditCard, AlertCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import DatePicker from "react-datepicker"
import DateInput from "@/components/ui/date-input"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import { rooms as fallbackRooms, type Room } from "@/data/rooms"
import { getCached, setCache } from "@/lib/cache"
import { useAuth } from "@/contexts/AuthContext"
import LoadingDots from "@/components/LoadingDots"

const PRIMARY = "#82285f"

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

export default function Booking() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  })

  const [checkIn, setCheckIn] = useState<Date | null>(
    searchParams.get("checkIn") ? new Date(searchParams.get("checkIn")!) : null
  )
  const [checkOut, setCheckOut] = useState<Date | null>(
    searchParams.get("checkOut") ? new Date(searchParams.get("checkOut")!) : null
  )
  const [guests, setGuests] = useState(Number(searchParams.get("guests")) || 1)
  const [stays, setStays] = useState<string>(searchParams.get("stays") || "24 Hours")
  const [stayType, setStayType] = useState<"overnight" | "day">(
    (searchParams.get("stayType") as "overnight" | "day") || "overnight"
  )
  const [dayDuration, setDayDuration] = useState<number>(
    Number(searchParams.get("duration")) || 4
  )
  const [startTime, setStartTime] = useState<string>(
    searchParams.get("startTime") || "10:00 AM"
  )

  const startTimes = useMemo(() => {
    const maxStart = 24 - dayDuration
    return generateStartTimes(maxStart)
  }, [dayDuration])

  const endTime = useMemo(() => addHoursToTime(startTime, dayDuration), [startTime, dayDuration])

  useEffect(() => {
    if (!id) return
    const cached = getCached<PublicRoomData>(`room_${id}`)
    if (cached) {
      setRoom({
        id: cached.id, name: cached.name, type: cached.type,
        description: cached.description, price: cached.price,
        capacity: cached.capacity, amenities: cached.amenities,
        images: cached.images.length > 0 ? cached.images : fallbackRooms[0].images,
      })
      setLoading(false)
    }
    publicRoomsApi.getById(id)
      .then((data: PublicRoomData) => {
        const r: Room = {
          id: data.id, name: data.name, type: data.type,
          description: data.description, price: data.price,
          capacity: data.capacity, amenities: data.amenities,
          images: data.images.length > 0 ? data.images : fallbackRooms[0].images,
        }
        setRoom(r)
        setCache(`room_${id}`, data)
      })
      .catch(() => { if (!cached) setRoom(fallbackRooms.find(r => r.id === id) || null) })
      .finally(() => setLoading(false))
  }, [id])

  const isOvernight = stayType === "overnight"
  const hasDate = checkIn !== null
  const hasDates = isOvernight ? (checkIn !== null && checkOut !== null) : hasDate
  const nights = isOvernight && hasDates ? Math.ceil((checkOut!.getTime() - checkIn!.getTime()) / (1000 * 60 * 60 * 24)) : 0
  const validNights = isOvernight ? nights > 0 : true
  const subtotal = isOvernight
    ? (validNights && room ? room.price * nights : 0)
    : (room ? Math.round(room.price * (dayDuration / 24)) : 0)
  const taxes = Math.round(subtotal * 0.12)
  const total = subtotal + taxes

  const canSubmit = hasDate && validNights && !submitting

  const handleSubmit = async () => {
    if (!canSubmit || !room || !user) return
    setSubmitting(true)
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
      const token = localStorage.getItem("access_token")

      const res = await fetch(`${apiBase}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          room_id: room.id,
          check_in: checkIn!.toISOString().split("T")[0],
          check_out: isOvernight ? checkOut!.toISOString().split("T")[0] : checkIn!.toISOString().split("T")[0],
          guests,
          stays: isOvernight ? stays : `${dayDuration} Hours`,
          stay_type: stayType,
          duration: isOvernight ? null : dayDuration,
          start_time: isOvernight ? null : startTime,
          full_name: user.name,
          email: user.email,
          total_price: total,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Booking failed")
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setErrorDialog({ open: true, title: "Booking Confirmed", message: "Your reservation has been placed." })
        navigate(`/booking/confirmation/${data.booking_id || "success"}`)
      }
    } catch (err: any) {
      setErrorDialog({ open: true, title: "Booking Failed", message: err.message || "Please try again." })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="px-base py-section animate-pulse">
        <div className="max-w-container mx-auto">
          <div className="h-4 bg-gray-200 rounded w-24 mb-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-40 bg-gray-200 rounded-lg" />
              <div className="h-60 bg-gray-200 rounded-lg" />
            </div>
            <div className="lg:col-span-1">
              <div className="h-80 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="px-base py-section text-center">
        <h1 className="typo-display-xl text-ink mb-md">Room Not Found</h1>
        <Button variant="outline" onClick={() => navigate("/rooms")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Rooms
        </Button>
      </div>
    )
  }

  return (
    <div className="px-base py-section">
      <div className="max-w-container mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-muted hover:text-ink transition-colors mb-lg cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="typo-body-sm">Back</span>
        </button>

        <h1 className="typo-display-lg text-ink mb-lg">Complete Your Booking</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          {/* LEFT: Forms */}
          <div className="lg:col-span-2 space-y-lg">
            {/* Stay Details */}
            <div className="bg-white border border-hairline rounded-[12px] p-lg">
              <h2 className="typo-display-sm text-ink mb-md flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Stay Details
              </h2>

              {/* Stay Type Toggle */}
              <div className="flex gap-2 mb-md">
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

              {isOvernight ? (
                /* Overnight: Check-in + Check-out */
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
                  <div>
                    <label className="typo-caption text-muted block mb-xs">Check-in</label>
                    <DatePicker
                      selected={checkIn}
                      onChange={(date: Date | null) => {
                        setCheckIn(date)
                        if (date && checkOut && date >= checkOut) setCheckOut(null)
                      }}
                      selectsStart startDate={checkIn} endDate={checkOut}
                      minDate={new Date()}
                      customInput={<DateInput placeholder="Select date" />}
                    />
                  </div>
                  <div>
                    <label className="typo-caption text-muted block mb-xs">Check-out</label>
                    <DatePicker
                      selected={checkOut}
                      onChange={(date: Date | null) => setCheckOut(date)}
                      selectsEnd startDate={checkIn} endDate={checkOut}
                      minDate={checkIn ? new Date(checkIn.getTime() + 86400000) : new Date()}
                      customInput={<DateInput placeholder="Select date" />}
                    />
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
                        <option key={n} value={n}>{n} {n === 1 ? "Guest" : "Guests"}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* Day Use: Date + Duration + Start Time */
                <div className="space-y-md">
                  <div>
                    <label className="typo-caption text-muted block mb-xs">Date</label>
                    <DatePicker
                      selected={checkIn}
                      onChange={(date: Date | null) => setCheckIn(date)}
                      minDate={new Date()}
                      customInput={<DateInput placeholder="Select date" />}
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
                            const match = startTime.match(/(\d+):00/)
                            if (match) {
                              let h = parseInt(match[1])
                              if (startTime.includes("PM") && !startTime.startsWith("12")) h += 12
                              if (startTime.startsWith("12") && startTime.includes("PM")) h = 12
                              if (h > maxStart) {
                                setStartTime(`${maxStart > 12 ? maxStart - 12 : maxStart}:00 ${maxStart >= 12 ? "PM" : "AM"}`)
                              }
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
                        <option key={n} value={n}>{n} {n === 1 ? "Guest" : "Guests"}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {isOvernight && validNights && (
                <p className="typo-caption text-muted mt-md">
                  {nights} {nights === 1 ? "night" : "nights"} stay
                </p>
              )}
            </div>

            {/* Secure payment notice */}
            <div className="flex items-center gap-3 bg-gray-50 border border-hairline rounded-[12px] p-md">
              <CreditCard className="h-5 w-5 text-muted shrink-0" />
              <div>
                <p className="typo-body-sm text-ink font-medium">Secure checkout</p>
                <p className="typo-caption-sm text-muted">You'll be redirected to PayMongo to complete your payment safely.</p>
              </div>
            </div>
          </div>

          {/* RIGHT: Booking Summary (sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white border border-hairline rounded-[12px] overflow-hidden">
                <div className="h-44 overflow-hidden">
                  <img
                    src={room.images[0] || "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=400&fit=crop"}
                    alt={room.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-lg">
                  <h3 className="typo-title-md text-ink mb-xs">{room.name}</h3>
                  <p className="typo-caption text-muted">{room.type}</p>

                  <div className={`border-t border-hairline mt-md pt-md space-y-sm ${!validNights ? "opacity-50" : ""}`}>
                    <div className="flex justify-between typo-body-sm">
                      <span className="text-muted">{isOvernight ? "Per night" : `Day Use (${dayDuration}h)`}</span>
                      <span className="text-ink">₱{(isOvernight ? room.price : Math.round(room.price * (dayDuration / 24))).toLocaleString()}</span>
                    </div>
                    {isOvernight && (
                      <div className="flex justify-between typo-body-sm">
                        <span className="text-muted">
                          × {validNights ? nights : "—"} {validNights ? (nights === 1 ? "night" : "nights") : "nights"}
                        </span>
                        <span className="text-ink">{validNights ? `₱${subtotal.toLocaleString()}` : "—"}</span>
                      </div>
                    )}
                    <div className="flex justify-between typo-body-sm">
                      <span className="text-muted">Taxes & fees (12%)</span>
                      <span className="text-ink">₱{taxes.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-sm border-t border-hairline">
                      <span className="typo-body-md text-ink">Total</span>
                      <span className={`typo-body-md ${validNights ? "text-primary" : "text-muted"}`}>
                        {validNights ? `₱${total.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-md pt-md border-t border-hairline space-y-xs">
                    {hasDate ? (
                      <>
                        <p className="typo-caption-sm text-muted">
                          {checkIn!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {isOvernight && checkOut ? ` – ${checkOut!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                        </p>
                        {!isOvernight && (
                          <p className="typo-caption-sm text-muted">{startTime} – {endTime}</p>
                        )}
                      </>
                    ) : (
                      <p className="typo-caption-sm text-muted">Date not selected</p>
                    )}
                    <p className="typo-caption-sm text-muted">{guests} {guests === 1 ? "guest" : "guests"}</p>
                    {isOvernight && <p className="typo-caption-sm text-muted">{stays}</p>}
                  </div>

                  <div className="mt-md space-y-xs">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Check className="h-3.5 w-3.5 text-success" />
                      Free cancellation up to 24 hours before check-in
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Check className="h-3.5 w-3.5 text-success" />
                      No prepayment needed
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA — always show Pay button */}
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full mt-md py-3 font-semibold !rounded-[12px] ${!canSubmit ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingDots size="sm" />
                    Processing...
                  </span>
                ) : validNights ? (
                  `Pay ₱${total.toLocaleString()}`
                ) : (
                  "Pay"
                )}
              </Button>

              <p className="typo-caption text-muted text-center mt-3">
                By booking, you agree to our Terms & Conditions
              </p>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog((prev) => ({ ...prev, open }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                   style={{ backgroundColor: errorDialog.title.includes("Failed") ? "#FEE2E2" : "#E8F5E9" }}>
                {errorDialog.title.includes("Failed") ? (
                  <AlertCircle className="h-5 w-5" style={{ color: "#A4423A" }} />
                ) : (
                  <Check className="h-5 w-5" style={{ color: "#3D6B4F" }} />
                )}
              </div>
              <div>
                <DialogTitle className="text-ink">{errorDialog.title}</DialogTitle>
                <DialogDescription className="text-muted">{errorDialog.message}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex justify-end mt-2">
            <Button
              onClick={() => setErrorDialog((prev) => ({ ...prev, open: false }))}
              className="!rounded-[8px]"
              style={{ backgroundColor: PRIMARY, color: "#FBF9F4" }}
            >
              OK
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
