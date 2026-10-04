import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate, useSearchParams, Link } from "react-router"
import { ArrowLeft, Calendar, Check, CreditCard, AlertCircle, Clock, Mail, Wallet, Landmark, X, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { publicRoomsApi, userBookingsApi, type PublicRoomData } from "@/services/api"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { rooms as fallbackRooms, type Room } from "@/data/rooms"
import { getCached, setCache } from "@/lib/cache"
import { overnightWindow, dayUseWindow, OVERNIGHT_CHECK_IN, OVERNIGHT_CHECK_OUT } from "@/lib/stayWindow"
import { API_BASE } from "@/lib/apiBase"
import { getAccessToken } from "@/lib/tokenStore"
import { formatDate as toISODate, parseDateParam } from "@/lib/dates"
import { getRoomDiscount } from "@/lib/discountEngine"
import { getActiveOffers, offerCoversDate, offerTitle, reasonWithUntil, type ActiveOffer } from "@/services/discountService"
import { useDiscountRooms } from "@/hooks/useDiscountRooms"
import { useDiscountApproval } from "@/hooks/useDiscountApproval"
import { useAuth } from "@/contexts/AuthContext"
import LoadingDots from "@/components/LoadingDots"
import TermsPopup from "@/components/TermsPopup"
import QuickSignInPanel from "@/components/auth/QuickSignInPanel"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"

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
    // Hard gate: nobody pays without ticking the cancellation / no-show policy.
    const [agreedToPolicy, setAgreedToPolicy] = useState(false)
    // T&C opens as a popup so the guest never loses the booking form.
    const [termsOpen, setTermsOpen] = useState(false)
    const [termsTarget, setTermsTarget] = useState<string | null>(null)
    const openTerms = (target: string | null = null) => {
      setTermsTarget(target)
      setTermsOpen(true)
    }
   const [submitted, setSubmitted] = useState(false)
   const [errorDialog, setErrorDialog] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  })
  // Non-blocking warning: guest already has an overlapping stay in ANOTHER room.
  const [overlapDialog, setOverlapDialog] = useState<{ open: boolean; roomName?: string; range?: string }>({ open: false })
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [signInMode, setSignInMode] = useState<"default" | "quick">("default")
  const [googleLoading, setGoogleLoading] = useState(false)

  // Always start from the default options whenever the modal opens
  useEffect(() => {
    if (showSignInModal) setSignInMode("default")
  }, [showSignInModal])

  // Close the sign-in modal on Esc
  useEffect(() => {
    if (!showSignInModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSignInModal(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showSignInModal])
  const [paymentMode, setPaymentMode] = useState<"full" | "downpayment">("full")
  const { rooms: discountRooms } = useDiscountRooms()
  const { isApproved } = useDiscountApproval()
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([])
  useEffect(() => {
    getActiveOffers()
      .then(setActiveOffers)
      .catch(() => setActiveOffers([]))
  }, [])

  // All booking params come from URL — read-only, no state needed
  const checkIn = searchParams.get("checkIn") ? parseDateParam(searchParams.get("checkIn")!) : null
  // Overnight stays are locked to 24 hours: check-out is always check-in + 1 day,
  // regardless of what the URL says (no 2-day / 3-day bookings).
  const checkOut =
    searchParams.get("stayType") !== "day" && checkIn
      ? new Date(checkIn.getTime() + 24 * 60 * 60 * 1000)
      : searchParams.get("checkOut")
        ? parseDateParam(searchParams.get("checkOut")!)
        : null
  const guests = {
    adults: Number(searchParams.get("adults")) || 2,
    children: Number(searchParams.get("children")) || 0,
    pets: Number(searchParams.get("pets")) || 0,
  }
  const stayType = (searchParams.get("stayType") as "overnight" | "day") || "overnight"
  const dayDuration = Number(searchParams.get("duration")) || 3
  const startTime = searchParams.get("startTime") || ""
  // Fixed house times — overnight check-in is always 2:00 PM (legacy
  // overnightStartTime URL params are ignored so every booking follows
  // the same clock).
  const overnightStartTime = OVERNIGHT_CHECK_IN

  const endTime = useMemo(() => addHoursToTime(startTime, dayDuration), [startTime, dayDuration])

  // Guest-facing window: dated 24-hour stay - check-out is the same clock time
  // on the check-out date.
  const overnightLabel = overnightWindow(checkIn, checkOut)
  const dayLabel = dayUseWindow(checkIn, startTime, endTime)

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
  // Overnight bookings are always exactly 1 night (24 hours)
  const nights = isOvernight && hasDates ? Math.min(1, Math.ceil((checkOut!.getTime() - checkIn!.getTime()) / (1000 * 60 * 60 * 24))) : 0
  const validNights = isOvernight ? nights > 0 : true
  // Discount-aware pricing — same precedence the Rooms grid and RoomDetail use:
  // active offer > approved holiday engine > full rate. The backend recomputes
  // this same total server-side; we never send a price it has to trust.
  const bookingOffer = room
    ? activeOffers.find((o) => o.roomType === room.type && (!checkIn || offerCoversDate(o, checkIn)))
    : undefined
  const engineDiscount = room ? getRoomDiscount(discountRooms, room.id) : undefined
  const bookingDiscount = bookingOffer
    ? { percent: bookingOffer.discountPercent, price: bookingOffer.discountedRate, reason: offerTitle(bookingOffer), validTo: bookingOffer.validTo }
    : engineDiscount && isApproved(engineDiscount.eventRoomTypeKey)
      ? { percent: engineDiscount.discountPercent, price: engineDiscount.discountedPrice, reason: engineDiscount.reason, validTo: engineDiscount.validTo }
      : null
  const bookingDiscountReason = bookingDiscount ? reasonWithUntil(bookingDiscount.reason, bookingDiscount.validTo) : null
  const nightlyRate = bookingDiscount ? bookingDiscount.price : room ? room.price : 0
  const originalSubtotal = isOvernight
    ? (validNights && room ? room.price * nights : 0)
    : (room ? Math.round(room.price * (dayDuration / 24)) : 0)
  const subtotal = isOvernight
    ? (validNights && room ? nightlyRate * nights : 0)
    : (room ? Math.round(nightlyRate * (dayDuration / 24)) : 0)
  const savedAmount = originalSubtotal - subtotal
  const taxes = Math.round(subtotal * 0.12)
  const total = subtotal + taxes
  const amountDue = paymentMode === "downpayment" ? Math.round(total / 2) : total
  const balanceDue = total - amountDue

  const canSubmit = hasDate && validNights && !submitting && agreedToPolicy && (isOvernight || !!startTime)

  const handleSubmit = () => void runCreate()

  const runCreate = async (opts: { skipConflictCheck?: boolean } = {}) => {
    if (!canSubmit || !room) return
    if (!user) {
      setShowSignInModal(true)
      return
    }
    if (user.scheduled_deletion_at) {
      setErrorDialog({
        open: true,
        title: "Booking Blocked",
        message:
          "Your account is scheduled for deletion, so new bookings are disabled. Cancel the deletion in Settings > Login & security to book again.",
      })
      return
    }
    setSubmitting(true)
    try {
      // Check availability first
      const availRes = await publicRoomsApi.checkAvailability({
        room_id: room.id,
        check_in: toISODate(checkIn!),
        check_out: isOvernight && checkOut ? toISODate(checkOut) : undefined,
        stay_type: stayType,
        start_time: isOvernight ? overnightStartTime : startTime,
        duration: !isOvernight ? dayDuration : undefined,
      })

      if (!availRes.available) {
        throw new Error("This room is no longer available for the selected dates. Please go back and choose different dates.")
      }

      // Non-blocking warning: the guest's OWN active booking overlaps these
      // exact dates/times in a DIFFERENT room. Same-room overlap never gets
      // here (backend 409s it), and back-to-back stays never warn.
      if (!opts.skipConflictCheck) {
        try {
          const conflictRes = await userBookingsApi.checkConflict({
            room_id: room.id,
            check_in: toISODate(checkIn!),
            check_out: isOvernight && checkOut ? toISODate(checkOut) : undefined,
            stay_type: stayType,
            start_time: isOvernight ? overnightStartTime : startTime,
            duration: !isOvernight ? dayDuration : undefined,
          })
          if (conflictRes.conflict) {
            setOverlapDialog({ open: true, roomName: conflictRes.room_name, range: conflictRes.range })
            return
          }
        } catch {
          // Warning-only check — a failure must never block the booking
        }
      }

      const apiBase = API_BASE
      const token = getAccessToken()

      const res = await fetch(`${apiBase}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          room_id: room.id,
          check_in: toISODate(checkIn!),
          check_out: isOvernight ? toISODate(checkOut!) : toISODate(checkIn!),
          guests: guests.adults + guests.children,
          adults: guests.adults,
          children: guests.children,
          pets: guests.pets,
          stays: isOvernight ? `${nights} Night${nights > 1 ? "s" : ""}` : `${dayDuration} Hours`,
          stay_type: stayType,
          duration: isOvernight ? null : dayDuration,
          start_time: isOvernight ? overnightStartTime : startTime,
          full_name: user.name,
          email: user.email,
          payment_mode: paymentMode,
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
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Stay Type</span>
                    <span className="text-sm font-semibold text-ink">Overnight Stay</span>
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Check-in</span>
                    <span className="text-sm font-semibold text-ink">
                      {checkIn ? checkIn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Check-out</span>
                    <span className="text-sm font-semibold text-ink">
                      {checkOut ? checkOut.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Check-in Time</span>
                    <span className="text-sm font-semibold text-ink">{OVERNIGHT_CHECK_IN}</span>
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Check-out Time</span>
                    <span className="text-sm font-semibold text-ink">{OVERNIGHT_CHECK_OUT}</span>
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Duration</span>
                    <span className="text-sm font-semibold text-ink">{nights} {nights === 1 ? "night" : "nights"}</span>
                  </div>
                  <div className="flex items-center gap-3 py-2">
                    <span className="text-sm text-muted">Guests</span>
                    <span className="text-sm font-semibold text-ink">{guests.adults} adult{guests.adults !== 1 ? "s" : ""}{guests.children > 0 ? `, ${guests.children} child${guests.children !== 1 ? "ren" : ""}` : ""}</span>
                  </div>
                  {overnightLabel && (
                    <div className="bg-primary/5 border border-primary/10 rounded-[10px] px-3 py-2 space-y-1 mt-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted">Check-in</span>
                        <span className="text-ink font-medium">{overnightLabel.checkIn}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-muted">Check-out</span>
                        <span className="text-ink font-medium">{overnightLabel.checkOut}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Day Use: read-only */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Stay Type</span>
                    <span className="text-sm font-semibold text-ink">Day Use</span>
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Date</span>
                    <span className="text-sm font-semibold text-ink">
                      {checkIn ? checkIn.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 py-2 border-b border-hairline">
                    <span className="text-sm text-muted">Duration</span>
                    <span className="text-sm font-semibold text-ink">{dayDuration} hours</span>
                  </div>
                  {startTime && (
                    <div className="flex items-center gap-3 py-2 border-b border-hairline">
                      <span className="text-sm text-muted">Time</span>
                      <span className="text-sm font-semibold text-ink">{startTime} – {endTime}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 py-2">
                    <span className="text-sm text-muted">Guests</span>
                    <span className="text-sm font-semibold text-ink">{guests.adults} adult{guests.adults !== 1 ? "s" : ""}{guests.children > 0 ? `, ${guests.children} child${guests.children !== 1 ? "ren" : ""}` : ""}</span>
                  </div>
                  {dayLabel && (
                    <div className="bg-primary/5 border border-primary/10 rounded-[10px] px-3 py-2 flex items-center gap-2 mt-1">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm text-ink font-medium">{dayLabel}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment option */}
            <div className="bg-white border border-hairline rounded-[12px] p-lg">
              <h2 className="typo-display-sm text-ink mb-md flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Payment Option
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: "full", title: "Full payment", Icon: CreditCard, due: total, note: "Nothing left to pay" },
                  { key: "downpayment", title: "Downpayment", Icon: Landmark, due: Math.round(total / 2), note: "Pay the balance at the hotel" },
                ] as const).map(({ key, title, Icon, due, note }) => {
                  const active = paymentMode === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPaymentMode(key)}
                      disabled={!validNights || submitted}
                      className={`text-left rounded-[12px] border p-4 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        active ? "border-primary bg-primary/5" : "border-hairline bg-white hover:border-primary/40"
                      }`}
                    >
                      <span className="flex items-center gap-2 mb-1.5">
                        <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted"}`} />
                        <span className="typo-body-sm font-semibold text-ink">{title}</span>
                        <span className={`ml-auto h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? "border-primary" : "border-hairline"}`}>
                          {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                      </span>
                      <span className="block typo-body-sm font-semibold text-ink">Pay ₱{due.toLocaleString()}</span>
                      <span className="block typo-caption-sm text-muted">{note}</span>
                    </button>
                  )
                })}
              </div>
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
                      <span className="text-ink">
                        {bookingDiscount && validNights && (
                          <s className="text-muted mr-1.5">
                            ₱{(isOvernight ? room.price : Math.round(room.price * (dayDuration / 24))).toLocaleString()}
                          </s>
                        )}
                        ₱{(isOvernight ? nightlyRate : Math.round(nightlyRate * (dayDuration / 24))).toLocaleString()}
                      </span>
                    </div>
                    {bookingDiscount && validNights && savedAmount > 0 && (
                      <div className="flex justify-between typo-body-sm">
                        <span className="text-muted">
                          {bookingDiscountReason} ({bookingDiscount.percent}% off)
                        </span>
                        <span className="text-[#A4423A]">-₱{savedAmount.toLocaleString()}</span>
                      </div>
                    )}
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
                    {paymentMode === "downpayment" && validNights && (
                      <>
                        <div className="flex justify-between typo-body-sm">
                          <span className="text-muted">Pay now (50%)</span>
                          <span className="text-ink font-semibold">₱{amountDue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between typo-body-sm">
                          <span className="text-muted">Balance at the hotel</span>
                          <span className="text-ink">₱{balanceDue.toLocaleString()}</span>
                        </div>
                      </>
                    )}
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
                    {(() => {
                      if (paymentMode === "downpayment") {
                        return (
                          <>
                            <div className="flex items-center gap-2 text-sm text-muted">
                              <Check className="h-3.5 w-3.5 text-success" />
                              Downpayment
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted">
                              <Check className="h-3.5 w-3.5 text-success" />
                              Pay the balance at the hotel
                            </div>
                          </>
                        );
                      }
                      return (
                        <>
                          <div className="flex items-center gap-2 text-sm text-muted">
                            <Check className="h-3.5 w-3.5 text-success" />
                            Full payment
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted">
                            <Check className="h-3.5 w-3.5 text-success" />
                            Nothing left to pay
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Policy agreement — required before payment */}
              <div className="mt-md flex items-start gap-2.5 rounded-[10px] border border-hairline bg-canvas p-3">
                <input
                  type="checkbox"
                  id="booking-policy"
                  className="mt-0.5 size-4 shrink-0 rounded border cursor-pointer"
                  style={{ accentColor: PRIMARY }}
                  checked={agreedToPolicy}
                  onChange={(e) => setAgreedToPolicy(e.target.checked)}
                />
                <label htmlFor="booking-policy" className="typo-caption-sm text-muted cursor-pointer leading-relaxed">
                  I have read and agree to the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openTerms(null)
                    }}
                    className="font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Terms &amp; Conditions
                  </button>
                  , including the{" "}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openTerms("cancellation")
                    }}
                    className="font-semibold text-primary hover:underline cursor-pointer"
                  >
                    24-hour cancellation, refund and no-show policy
                  </button>
                  .
                </label>
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
                  `Pay ₱${amountDue.toLocaleString()}`
                ) : (
                  "Pay"
                )}
              </Button>

              <p className="typo-caption text-muted text-center mt-3 leading-relaxed">
                Payments are processed securely by PayMongo.
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

      {/* Non-blocking overlap warning — Go back closes with nothing submitted;
          Continue booking proceeds with the normal booking flow. */}
      <ConfirmDialog
        open={overlapDialog.open}
        onOpenChange={(open) => setOverlapDialog((prev) => ({ ...prev, open }))}
        title="Overlapping Booking"
        description={
          overlapDialog.roomName || overlapDialog.range ? (
            <>
              <span className="block">
                You already have a booking{overlapDialog.roomName ? ` at ${overlapDialog.roomName}` : ""}.
              </span>
              {overlapDialog.range && (
                <span className="block mt-1.5 font-medium text-ink">{overlapDialog.range}</span>
              )}
              <span className="block mt-1.5">Book another room anyway?</span>
            </>
          ) : (
            "You already have a booking at this time. Book another room anyway?"
          )
        }
        confirmLabel="Continue booking"
        cancelLabel="Go back"
        descriptionClassName="mt-3 text-ink/70 text-center"
        onConfirm={() => {
          setOverlapDialog((prev) => ({ ...prev, open: false }))
          void runCreate({ skipConflictCheck: true })
        }}
      />

      {/* Terms popup — stays on this page, keeps the form state */}
      <TermsPopup open={termsOpen} onOpenChange={setTermsOpen} targetId={termsTarget} />

      {/* Sign In Modal (when not logged in) */}
      {showSignInModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setShowSignInModal(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-signin-title"
            className="bg-white rounded-2xl shadow-lg p-8 text-center animate-scale-in relative max-h-[92dvh] overflow-y-auto"
            style={{ width: "100%", maxWidth: signInMode === "quick" ? "540px" : "400px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowSignInModal(false)}
              disabled={googleLoading}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer z-10 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Logo */}
            <div className="mb-4 flex justify-center">
              <img src={hotelLogo} alt="" className="h-8 w-auto" />
            </div>

            <h2 id="booking-signin-title" className="mb-1 text-xl font-semibold text-ink">
              Sign in to continue
            </h2>
            <p className="mb-6 text-sm text-muted">
              {signInMode === "quick"
                ? "Scan this code with your signed-in phone."
                : "You need to be signed in to complete your booking."}
            </p>

            {signInMode === "quick" ? (
              <QuickSignInPanel
                layout="wide"
                onSignedIn={() => setShowSignInModal(false)}
                onBack={() => setSignInMode("default")}
              />
            ) : (
              <>
            {/* Google SSO */}
            <button
              type="button"
              disabled={googleLoading}
              onClick={async () => {
                setGoogleLoading(true)
                try {
                  const { supabase } = await import("@/lib/supabase")
                  const returnToUrl = `${window.location.pathname}${window.location.search}`
                  sessionStorage.setItem("postOAuthReturnTo", returnToUrl)
                  sessionStorage.setItem("postOAuthReturnToAt", String(Date.now()))
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      // pathname includes /booking/:id — bare "/booking" lands on NotFound
                      redirectTo: `${window.location.origin}${returnToUrl}`,
                    },
                  })

                  if (error) {
                    console.error("[Booking] Google OAuth error:", error)
                    setGoogleLoading(false)
                  }
                } catch (err) {
                  console.error("[Booking] Google sign-in error:", err)
                  setGoogleLoading(false)
                }
              }}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <LoadingDots size="sm" />
              ) : (
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              <span className="text-sm text-ink/80">{googleLoading ? "Opening Google..." : "Continue with Google"}</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-hairline" />
              <span className="text-[11px] text-muted uppercase tracking-wider font-medium">or</span>
              <div className="flex-1 h-px bg-hairline" />
            </div>

            {/* Sign in with Email */}
            <button
              type="button"
              onClick={() => {
                setShowSignInModal(false)
                navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`)
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer text-sm text-ink/80"
            >
              <Mail className="w-4 h-4" />
              Sign in with Email
            </button>

            {/* Quick Sign-In */}
            <button
              type="button"
              onClick={() => setSignInMode("quick")}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer text-sm text-ink/80"
            >
              <QrCode className="w-4 h-4" />
              Quick Sign-In
            </button>
              </>
            )}

            <p className="text-xs text-muted mt-5 leading-relaxed">
              By signing in, you agree to our{" "}
              <Link to="/terms" className="font-medium" style={{ color: PRIMARY }}>Terms of Service</Link>
              {" "}and{" "}
              <Link to="/terms#privacy" className="font-medium" style={{ color: PRIMARY }}>Privacy Policy</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
