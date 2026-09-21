import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router"
import { ArrowLeft, Calendar, Check, CreditCard, AlertCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { publicRoomsApi, type PublicRoomData } from "@/services/api"
import { rooms as fallbackRooms, type Room } from "@/data/rooms"
import { getCached, setCache } from "@/lib/cache"
import { useAuth } from "@/contexts/AuthContext"
import LoadingDots from "@/components/LoadingDots"

const PRIMARY = "#82285f"

function parseTimeToHour(timeStr: string): number {
  const match = timeStr.match(/(\d+):00\s*(AM|PM)/i)
  if (!match) return 0
  let h = parseInt(match[1])
  const period = match[2].toUpperCase()
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return h
}

function addHoursToTime(timeStr: string, hours: number): string {
  const h = parseTimeToHour(timeStr)
  const endH = (h + hours) % 24
  const endPeriod = endH >= 12 ? "PM" : "AM"
  const endH12 = endH > 12 ? endH - 12 : endH === 0 ? 12 : endH
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
   const [submitted, setSubmitted] = useState(false)
   const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  })

  // All booking params come from URL — read-only, no state needed
  const checkIn = searchParams.get("checkIn") ? new Date(searchParams.get("checkIn")!) : null
  const checkOut = searchParams.get("checkOut") ? new Date(searchParams.get("checkOut")!) : null
  const guests = {
    adults: Number(searchParams.get("adults")) || 2,
    children: Number(searchParams.get("children")) || 0,
  }
  const stayType = (searchParams.get("stayType") as "overnight" | "day") || "overnight"
  const dayDuration = Number(searchParams.get("duration")) || 3
  const startTime = searchParams.get("startTime") || ""
  const overnightStartTime = searchParams.get("overnightStartTime") || ""

  const endTime = useMemo(() => addHoursToTime(startTime, dayDuration), [startTime, dayDuration])

  // For overnight: end time is same time on check-out date
  const overnightEndTime = useMemo(() => {
    if (!overnightStartTime) return ""
    return overnightStartTime // Same time on checkout day
  }, [overnightStartTime])

  useEffect(() => {
    if (!id) return
    const cached = getCached<PublicRoomData>(`room_${id}`)
    if (cached) {
      setRoom({
        id: cached.id, name: cached.name, type: cached.type,
        description: cached.description, price: cached.price,
        capacity: cached.capacity, max_adults: cached.max_adults,
        max_children: cached.max_children, allows_children: cached.allows_children,
        amenities: cached.amenities,
        images: cached.images.length > 0 ? cached.images : fallbackRooms[0].images,
        bookedDates: fallbackRooms.find(fr => fr.id === cached.id)?.bookedDates || [],
      })
      setLoading(false)
    }
    publicRoomsApi.getById(id)
      .then((data: PublicRoomData) => {
        const r: Room = {
          id: data.id, name: data.name, type: data.type,
          description: data.description, price: data.price,
          capacity: data.capacity, max_adults: data.max_adults,
          max_children: data.max_children, allows_children: data.allows_children,
          amenities: data.amenities,
          images: data.images.length > 0 ? data.images : fallbackRooms[0].images,
          bookedDates: fallbackRooms.find(fr => fr.id === data.id)?.bookedDates || [],
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

  const canSubmit = hasDate && validNights && !submitting && ((isOvernight && !!overnightStartTime) || (!isOvernight && !!startTime))

  const handleSubmit = async () => {
    if (!canSubmit || !room || !user) return
    setSubmitting(true)
    try {
      // Check availability first
      const availRes = await publicRoomsApi.checkAvailability({
        room_id: room.id,
        check_in: checkIn!.toISOString().split("T")[0],
        check_out: isOvernight && checkOut ? checkOut.toISOString().split("T")[0] : undefined,
        stay_type: stayType,
        start_time: isOvernight ? overnightStartTime : startTime,
        duration: !isOvernight ? dayDuration : undefined,
      })

      if (!availRes.available) {
        throw new Error("This room is no longer available for the selected dates. Please go back and choose different dates.")
      }

      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
      const token = sessionStorage.getItem("access_token")

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
          guests: guests.adults + guests.children,
          stays: isOvernight ? `${nights} Night${nights > 1 ? "s" : ""}` : `${dayDuration} Hours`,
          stay_type: stayType,
          duration: isOvernight ? null : dayDuration,
          start_time: isOvernight ? overnightStartTime : startTime,
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
          setSubmitted(true)
          window.location.href = data.checkout_url
        } else {
          setSubmitted(true)
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
             {/* Stay Details — read-only (already chosen on room page) */}
             <div className="bg-white border border-hairline rounded-[12px] p-lg">
               <h2 className="typo-display-sm text-ink mb-md flex items-center gap-2">
                 <Calendar className="h-5 w-5 text-primary" />
                 Stay Details
               </h2>

              {isOvernight ? (
                /* Overnight: read-only */
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Stay Type</span>
                    <span className="text-sm font-semibold text-ink">Overnight Stay</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Check-in</span>
                    <span className="text-sm font-semibold text-ink">
                      {checkIn ? checkIn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Check-out</span>
                    <span className="text-sm font-semibold text-ink">
                      {checkOut ? checkOut.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </div>
                  {overnightStartTime && (
                    <div className="flex items-center justify-between py-2 border-b border-hairline">
                      <span className="text-sm text-muted">Check-in Time</span>
                      <span className="text-sm font-semibold text-ink">{overnightStartTime}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Duration</span>
                    <span className="text-sm font-semibold text-ink">{nights} {nights === 1 ? "night" : "nights"}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted">Guests</span>
                    <span className="text-sm font-semibold text-ink">{guests.adults} adult{guests.adults !== 1 ? "s" : ""}{guests.children > 0 ? `, ${guests.children} child${guests.children !== 1 ? "ren" : ""}` : ""}</span>
                  </div>
                  {overnightStartTime && (
                    <div className="bg-primary/5 border border-primary/10 rounded-[10px] px-3 py-2 flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm text-ink font-medium">
                        {overnightStartTime} – {overnightEndTime}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Day Use: read-only */
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Stay Type</span>
                    <span className="text-sm font-semibold text-ink">Day Use</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Date</span>
                    <span className="text-sm font-semibold text-ink">
                      {checkIn ? checkIn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Duration</span>
                    <span className="text-sm font-semibold text-ink">{dayDuration} hours</span>
                  </div>
                  {startTime && (
                    <div className="flex items-center justify-between py-2 border-b border-hairline">
                      <span className="text-sm text-muted">Time</span>
                      <span className="text-sm font-semibold text-ink">{startTime} – {endTime}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted">Guests</span>
                    <span className="text-sm font-semibold text-ink">{guests.adults} adult{guests.adults !== 1 ? "s" : ""}{guests.children > 0 ? `, ${guests.children} child${guests.children !== 1 ? "ren" : ""}` : ""}</span>
                  </div>
                  {startTime && (
                    <div className="bg-primary/5 border border-primary/10 rounded-[10px] px-3 py-2 flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm text-ink font-medium">
                        {startTime} – {endTime}
                      </span>
                    </div>
                  )}
                </div>
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
               <div className={`bg-white border border-hairline rounded-[12px] overflow-hidden ${submitted ? "opacity-50 pointer-events-none" : ""}`}>
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
                        {!isOvernight && startTime && (
                          <p className="typo-caption-sm text-muted">{startTime} – {endTime}</p>
                        )}
                      </>
                    ) : (
                      <p className="typo-caption-sm text-muted">Date not selected</p>
                    )}
                    <p className="typo-caption-sm text-muted">{guests.adults} {guests.adults === 1 ? "adult" : "adults"}{guests.children > 0 ? `, ${guests.children} ${guests.children === 1 ? "child" : "children"}` : ""}</p>
                    {isOvernight && <p className="typo-caption-sm text-muted">{nights} {nights === 1 ? "night" : "nights"}</p>}
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
                 disabled={!canSubmit || submitted}
                 className={`w-full mt-md py-3 font-semibold !rounded-[12px] ${(!canSubmit || submitted) ? "opacity-50 cursor-not-allowed" : ""}`}
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
