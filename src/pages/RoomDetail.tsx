import { useState, useEffect, useMemo } from "react"
import { useParams, Link, useNavigate, useSearchParams } from "react-router"
import { motion } from "motion/react"
import DatePicker from "react-datepicker"
import {
  Star, Users, ArrowLeft, Check, X, Dog,
  Wifi, Wind, Wine, ConciergeBell, Building2, BedDouble,
  TreePine, Coffee, Sunrise, Bath, UserCheck, Sofa,
  Baby, Waves, Fence, Droplets, Monitor, Armchair,
  Shirt, Fish, Sunset, UtensilsCrossed, Tv, Sparkles, Music, Clock, Tag, Mail, QrCode,
  ChevronDown, ChevronLeft, ChevronRight,
  MapPin, Landmark, ShoppingBag, Trees, TrainFront, FerrisWheel, Car,
} from "lucide-react"
import QuickSignInPanel from "@/components/auth/QuickSignInPanel"
import hotelLogo from "@/assets/images/Hotel Ava logo.png"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import DateInput from "@/components/ui/date-input"
import GuestSelector, { type GuestCount } from "@/components/ui/guest-selector"
import { publicRoomsApi, reviewsApi, type PublicRoomData, type RoomReviewsResponse } from "@/services/api"
import { getAmenityIcon, rooms as fallbackRooms, type Room } from "@/data/rooms"
import { nearbyPlaces, travelLabel, type NearbyCategory } from "@/data/nearbyPlaces"
import { getCached, setCache } from "@/lib/cache"
import { formatDate as toISODate, parseDateParam } from "@/lib/dates"
import { overnightWindow, dayUseWindow, OVERNIGHT_CHECK_IN, OVERNIGHT_CHECK_OUT } from "@/lib/stayWindow"
import { dayUseRate } from "@/lib/roomPricing"
import { formatRoomCapacity } from "@/lib/capacity"
import { getGeneratedAvatar, getStoredAvatar, onAvatarError } from "@/lib/avatar"
import PhotoGallery from "@/components/rooms/PhotoGallery"
import { Pagination } from "@/components/ui/pagination"
import { useAuth } from "@/contexts/AuthContext"
import { getRoomDiscount } from "@/lib/discountEngine"
import { getActiveOffers, offerCoversDate, offerTitle, reasonWithUntil, type ActiveOffer } from "@/services/discountService"
import { useDiscountApproval } from "@/hooks/useDiscountApproval"
import { useDiscountRooms } from "@/hooks/useDiscountRooms"
import { cn } from "@/lib/utils"

const lucideIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Wifi, Wind, Wine, ConciergeBell, Building2, BedDouble,
  TreePine, Coffee, Sunrise, Bath, UserCheck, Sofa,
  Baby, Waves, Fence, Droplets, Monitor, Armchair,
  Shirt, Fish, Sunset, UtensilsCrossed, Tv, Sparkles, Music, Car
}

type DetailTabId = "amenities" | "nearby" | "reviews"

/** The three stacked sections below "About this room", now a tab strip. */
const DETAIL_TABS: { id: DetailTabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "amenities", label: "Amenities", icon: Sparkles },
  { id: "nearby", label: "Nearby Places", icon: MapPin },
  { id: "reviews", label: "Guest Reviews", icon: Star },
]

const DAY_USE_DURATIONS = [3, 6, 8, 12] as const
const CLOSING_HOUR = 22 // 10 PM
const REVIEW_PAGE_SIZE = 6

function generateStartTimes(maxHour: number = 20): string[] {
  const times: string[] = []
  for (let h = 6; h <= maxHour; h++) {
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    times.push(`${hour12}:00 ${period}`)
  }
  return times
}

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

function formatReviewDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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

/** Category → icon for the "Nearby Places" list on this page. */
const nearbyIcons: Record<NearbyCategory, typeof MapPin> = {
  Landmark,
  Shopping: ShoppingBag,
  Nature: Trees,
  Transport: TrainFront,
  Attraction: FerrisWheel,
}

export default function RoomDetail() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const [room, setRoom] = useState<Room | null>(null)
  const [loading, setLoading] = useState(true)
  const { rooms: discountRooms } = useDiscountRooms()
  const [stayType, setStayType] = useState<"overnight" | "day">(
    (searchParams.get("stayType") as "overnight" | "day") || "overnight"
  )
  // Locked only when the guest came from the home search bar (it always writes check-in).
  // Direct browsing has no check-in, so the full Overnight / Day Use toggle stays visible.
  const [stayLocked] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return Boolean(p.get("checkIn") || p.get("checkin"))
  })
  const [checkIn, setCheckIn] = useState<Date | null>(() => {
    const v = searchParams.get("checkIn") || searchParams.get("checkin")
    return v ? parseDateParam(v) : null
  })
  const [checkOut, setCheckOut] = useState<Date | null>(() => {
    const v = searchParams.get("checkOut") || searchParams.get("checkout")
    return v ? parseDateParam(v) : null
  })
  const [guests, setGuests] = useState<GuestCount>(() => ({
    adults: Number(searchParams.get("adults")) || 2,
    children: Number(searchParams.get("children")) || 0,
    pets: Number(searchParams.get("pets")) || 0,
  }))
  const [dayDuration, setDayDuration] = useState<number>(
    Number(searchParams.get("duration")) || 3
  )
  const [startTime, setStartTime] = useState<string>(
    searchParams.get("startTime") || ""
  )
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalMode, setAuthModalMode] = useState<"default" | "quick">("default")

  // Close the auth modal on Esc
  useEffect(() => {
    if (!showAuthModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAuthModal(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [showAuthModal])
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  // Amenities / Nearby Places / Guest Reviews live behind one tab strip
  const [detailTab, setDetailTab] = useState<DetailTabId>("amenities")
  // Live guest reviews for this room (average + list shown below)
  const [showAllNearby, setShowAllNearby] = useState(false)
  const [reviewSummary, setReviewSummary] = useState<RoomReviewsResponse | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  // Shopee-style rating filter ("All" + 5★…1★) and the photo lightbox
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [reviewPage, setReviewPage] = useState(1)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const { isApproved } = useDiscountApproval()
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([])
  useEffect(() => {
    getActiveOffers()
      .then(setActiveOffers)
      .catch(() => setActiveOffers([]))
  }, [])

  // Master amenities list — union of all amenities across all room types
  const allAmenities = useMemo(() => {
    const set = new Set<string>()
    fallbackRooms.forEach((r) => r.amenities.forEach((a) => set.add(a)))
    return Array.from(set).sort()
  }, [])

  const missingAmenities = useMemo(() => {
    if (!room) return []
    const roomSet = new Set(room.amenities)
    return allAmenities.filter((a) => !roomSet.has(a))
  }, [room, allAmenities])

  useEffect(() => {
    let checkInDate = searchParams.get("checkIn") || searchParams.get("checkin")
    let checkOutDate = searchParams.get("checkOut") || searchParams.get("checkout")
    let adultsValue = searchParams.get("adults")
    let childrenValue = searchParams.get("children")
    let petsValue = searchParams.get("pets")

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

        checkInDate = params.get("checkIn") || params.get("checkin")
        checkOutDate = params.get("checkOut") || params.get("checkout")
        adultsValue = params.get("adults")
        childrenValue = params.get("children")
        petsValue = params.get("pets")
      }
    }

    setCheckIn(checkInDate ? parseDateParam(checkInDate) : null)
    setCheckOut(checkOutDate ? parseDateParam(checkOutDate) : null)
    setGuests({
      adults: adultsValue ? Number(adultsValue) : 2,
      children: childrenValue ? Number(childrenValue) : 0,
      pets: petsValue ? Number(petsValue) : 0,
    })
  }, [searchParams])

  // Overnight stays are locked to 24 hours — check-out is always check-in + 1 day
  useEffect(() => {
    if (stayType !== "overnight" || !checkIn) return
    const nextDay = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000)
    // Compare as local date strings to avoid timezone issues
    if (!checkOut || toISODate(checkOut) !== toISODate(nextDay)) {
      setCheckOut(nextDay)
    }
  }, [checkIn, checkOut, stayType])

  // Sync selections to URL (without re-rendering)
  useEffect(() => {
    const params = new URLSearchParams()
    params.set("stayType", stayType)
    if (checkIn) params.set("checkIn", checkIn.toISOString())
    if (stayType === "overnight" && checkOut) params.set("checkOut", checkOut.toISOString())
    if (stayType === "day") {
      params.set("duration", String(dayDuration))
      if (startTime) params.set("startTime", startTime)
    }
    params.set("adults", String(guests.adults))
    params.set("children", String(guests.children))
    params.set("pets", String(guests.pets))
    window.history.replaceState(null, "", `?${params.toString()}`)
  }, [stayType, checkIn, checkOut, guests, dayDuration, startTime])

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
        max_adults: cached.max_adults,
        max_children: cached.max_children,
        allows_children: cached.allows_children,
        amenities: cached.amenities,
        images: cached.images.length > 0 ? cached.images : fallbackRooms[0].images,
        rating: cached.rating ?? undefined,
        reviews: cached.reviews,
        day_use_3h: cached.day_use_3h ?? null,
        day_use_6h: cached.day_use_6h ?? null,
        day_use_8h: cached.day_use_8h ?? null,
        day_use_12h: cached.day_use_12h ?? null,
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
          max_adults: data.max_adults,
          max_children: data.max_children,
          allows_children: data.allows_children,
          amenities: data.amenities,
          images: data.images.length > 0 ? data.images : fallbackRooms[0].images,
          rating: data.rating ?? undefined,
          reviews: data.reviews,
          day_use_3h: data.day_use_3h ?? null,
          day_use_6h: data.day_use_6h ?? null,
          day_use_8h: data.day_use_8h ?? null,
          day_use_12h: data.day_use_12h ?? null,
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

  // Guest reviews — fetched alongside the room so the ratings are always live
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setReviewsLoading(true)
    setRatingFilter(null)
    reviewsApi
      .getRoom(id)
      .then((data) => { if (!cancelled) setReviewSummary(data) })
      .catch(() => { if (!cancelled) setReviewSummary(null) })
      .finally(() => { if (!cancelled) setReviewsLoading(false) })
    return () => { cancelled = true }
  }, [id])

  const startTimes = useMemo(() => {
    const maxStart = Math.min(24 - dayDuration, CLOSING_HOUR)
    const allTimes = generateStartTimes(maxStart)
    if (!checkIn) return allTimes
    const now = new Date()
    const selectedDate = new Date(checkIn)
    const isToday = selectedDate.toDateString() === now.toDateString()
    if (!isToday) return allTimes
    const currentHour = now.getHours()
    return allTimes.filter((t) => {
      const h = parseTimeToHour(t)
      return h > currentHour
    })
  }, [dayDuration, checkIn])

  // Reset startTime if it's no longer available (e.g. date changed to today and hour passed)
  useEffect(() => {
    if (startTime && startTimes.length > 0 && !startTimes.includes(startTime)) {
      setStartTime("")
    }
  }, [startTimes])

  const endTime = useMemo(() => addHoursToTime(startTime, dayDuration), [startTime, dayDuration])

  // Overnight uses fixed house times: in 2:00 PM, out 12:00 PM (no picker).
  const overnightLabel = overnightWindow(checkIn, checkOut)
  const dayLabel = dayUseWindow(checkIn, startTime, endTime)

  // Check room availability when dates change
  useEffect(() => {
    if (!room) return
    if (stayType === "overnight" && !checkIn) {
      setIsAvailable(null)
      return
    }
    if (stayType === "day" && (!checkIn || !startTime)) {
      setIsAvailable(null)
      return
    }

    setCheckingAvailability(true)

    publicRoomsApi.checkAvailability({
      room_id: room.id,
      check_in: toISODate(checkIn!),
      check_out: stayType === "overnight" && checkOut ? toISODate(checkOut) : undefined,
      stay_type: stayType,
      start_time: stayType === "day" ? startTime : OVERNIGHT_CHECK_IN,
      duration: stayType === "day" ? dayDuration : undefined,
    })
      .then((res) => setIsAvailable(res.available))
      .catch(() => setIsAvailable(null))
      .finally(() => setCheckingAvailability(false))
  }, [room, checkIn, checkOut, stayType, startTime, dayDuration])

  const nights = useMemo(() => {
    if (stayType !== "overnight") return 1
    // Overnight stays are locked to 24 hours: always exactly 1 night
    return 1
  }, [stayType])

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

  const dayUsePrice = stayType === "day" ? dayUseRate(room, dayDuration) : 0
  const overnightTotal = stayType === "overnight" ? room.price * nights : 0
  const subtotal = stayType === "day" ? dayUsePrice : overnightTotal
  const discount = getRoomDiscount(discountRooms, room.id)
  const approvedDiscount = discount && isApproved(discount.eventRoomTypeKey) ? discount : null
  // Scheduled offer the admin switched on wins over the approved holiday
  // engine — same precedence the Rooms grid uses (offer > engine > full rate).
  const activeOffer = activeOffers.find(
    (o) => o.roomType === room.type && (!checkIn || offerCoversDate(o, checkIn)),
  )
  const showDiscount = activeOffer
    ? {
        discountPercent: activeOffer.discountPercent,
        discountedPrice: activeOffer.discountedRate,
        originalPrice: activeOffer.baseRate,
        reason: offerTitle(activeOffer),
        validTo: activeOffer.validTo,
      }
    : approvedDiscount
  const showDiscountReason = showDiscount ? reasonWithUntil(showDiscount.reason, showDiscount.validTo) : null
  const effectivePrice = showDiscount ? showDiscount.discountedPrice : room.price
  const dayUseDiscounted = stayType === "day" ? dayUseRate(room, dayDuration, effectivePrice) : 0
  const overnightDiscounted = stayType === "overnight" ? effectivePrice * nights : 0
  const discountedSubtotal = stayType === "day" ? dayUseDiscounted : overnightDiscounted
  const displaySubtotal = showDiscount ? discountedSubtotal : subtotal
  const totalPrice = displaySubtotal + Math.round(displaySubtotal * 0.12)

  // Prefer the live review aggregate; fall back to the value shipped with the room
  const avgRating = reviewSummary && reviewSummary.count > 0 ? reviewSummary.average : room.rating
  const reviewCount = reviewSummary ? reviewSummary.count : room.reviews

  const allReviews = reviewSummary?.reviews ?? []
  const distribution = reviewSummary?.distribution ?? {}
  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: distribution[String(star)] ?? 0,
  }))
  const visibleReviews = ratingFilter
    ? allReviews.filter((r) => r.rating === ratingFilter)
    : allReviews
  const reviewPageCount = Math.max(1, Math.ceil(visibleReviews.length / REVIEW_PAGE_SIZE))
  // Clamp instead of trusting reviewPage, so a tighter filter stays in range.
  const safeReviewPage = Math.min(reviewPage, reviewPageCount)
  const pagedReviews = visibleReviews.slice(
    (safeReviewPage - 1) * REVIEW_PAGE_SIZE,
    safeReviewPage * REVIEW_PAGE_SIZE,
  )
  const pickRatingFilter = (value: number | null) => {
    setRatingFilter(value)
    setReviewPage(1)
  }
  const filterChips: { value: number | null; label: string }[] = [
    { value: null, label: `All (${allReviews.length})` },
    ...starCounts.map(({ star, count }) => ({ value: star, label: `${star}★ (${count})` })),
  ]

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
                {avgRating != null && (
                  <div className="flex items-center gap-2 bg-surface-soft px-3 py-1 rounded-full shrink-0">
                    <Star className="h-4 w-4 fill-star-rating text-star-rating" />
                    <span className="typo-title-sm text-ink">{avgRating}</span>
                    {reviewCount != null && reviewCount > 0 && (
                      <span className="typo-caption-sm text-muted">
                        ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                      </span>
                    )}
                  </div>
                )}
              </div>

              {(() => {
                const capacity = formatRoomCapacity(room)
                if (!capacity) return null
                return (
                  <div className="flex items-center gap-4 mb-lg text-muted">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span className="typo-body-sm">Up to {capacity}</span>
                    </div>
                  </div>
                )
              })()}

                <div className="border-t border-hairline pt-lg">
                  <h2 className="typo-display-sm text-ink mb-md">About this room</h2>
                  <p className="typo-body-md text-body leading-relaxed">{room.description}</p>
                </div>

                {/* Pet Policy Notice */}
                {room.amenities && room.amenities.some(a => a.includes('Pet')) ? (
                  <div className="mt-4 rounded-[12px] bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-start gap-3">
                    <Dog className="h-5 w-5 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="typo-body-sm font-semibold text-emerald-800">Pet-Friendly Room</p>
                      <p className="typo-caption-sm text-emerald-700 mt-1">
                        Your furry friends are welcome! Maximum of 2 pets allowed per room. Please inform us at check-in for any special requirements.
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* ── Detail tabs — Amenities / Nearby Places / Guest Reviews ── */}
                <div className="mt-lg border-t border-hairline pt-lg">
                  <div
                    role="tablist"
                    aria-label="Room details"
                    className="flex items-center gap-0 overflow-x-auto border-b border-hairline"
                  >
                    {DETAIL_TABS.map((tab) => {
                      const TabIcon = tab.icon
                      const active = detailTab === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setDetailTab(tab.id)}
                          className={cn(
                            "relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-3 typo-body-sm font-semibold transition-colors sm:px-4",
                            active ? "text-primary" : "text-muted hover:text-ink",
                          )}
                        >
                          <TabIcon className="h-4 w-4" />
                          {tab.label}
                          {tab.id === "reviews" && reviewCount != null && reviewCount > 0 && (
                            <span
                              className={cn(
                                "ml-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 typo-caption-sm",
                                active ? "bg-primary/10 text-primary" : "bg-surface-soft text-muted",
                              )}
                            >
                              {reviewCount}
                            </span>
                          )}
                          {active && (
                            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                          )}
                        </button>
                      )
                    })}
                  </div>

                {/* ── Tab: Amenities ──────────────────────────────────────── */}
                {detailTab === "amenities" && (
                <>
                <div className="pt-lg">
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

                {/* Show More Button */}
                {showMoreDetails ? null : (
                  <button
                    type="button"
                    onClick={() => setShowMoreDetails(true)}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-active transition-colors cursor-pointer"
                  >
                    Show more details
                    <ChevronDown className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Full Amenities Detail View */}
              {showMoreDetails && (
                <>
                  <div className="border-t border-hairline pt-lg mt-lg">
                    <h2 className="typo-display-sm text-ink mb-md">Amenities Details</h2>
                    
                    {/* Available Amenities */}
                    <div className="mb-6">
                      <h3 className="typo-caption-sm font-semibold text-emerald-600 mb-3 flex items-center gap-2">
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                        Available ({room.amenities.length})
                      </h3>
                      <div className="grid grid-cols-2 gap-sm">
                        {room.amenities.map((amenity) => {
                          const iconName = getAmenityIcon(amenity)
                          const IconComponent = lucideIconMap[iconName] || Sparkles
                          return (
                            <div
                              key={amenity}
                              className="flex items-center gap-2 py-2"
                            >
                              <IconComponent className="h-4 w-4 text-emerald-600" />
                              <span className="typo-body-sm text-emerald-700">{amenity}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Not Available Amenities */}
                    {missingAmenities.length > 0 && (
                      <div>
                        <h3 className="typo-caption-sm font-semibold text-muted mb-3 flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-gray-400"></span>
                          Not available in this room ({missingAmenities.length})
                        </h3>
                        <div className="grid grid-cols-2 gap-sm">
                          {missingAmenities.map((amenity) => {
                            const iconName = getAmenityIcon(amenity)
                            const IconComponent = lucideIconMap[iconName] || Sparkles
                            return (
                              <div
                                key={amenity}
                                className="flex items-center gap-2 py-2 opacity-60"
                              >
                                <IconComponent className="h-4 w-4 text-muted" />
                                <span className="typo-body-sm text-muted line-through">{amenity}</span>
                              </div>
                            )
                          })}
                        </div>
                        <p className="typo-caption-sm text-muted mt-4 italic">
                          Available in other room types.
                        </p>
                      </div>
                    )}

                    {/* Close Button */}
                    <button
                      type="button"
                      onClick={() => setShowMoreDetails(false)}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-active transition-colors cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to room details
                    </button>
                  </div>
                </>
              )}
                </>
                )}

                {/* ── Tab: Nearby Places ─────────────────────────────────── */}
                {detailTab === "nearby" && (
              <div className="pt-lg">
                <div className="mb-md flex items-center justify-end">
                  <span className="typo-caption-sm text-muted">Malate, Manila</span>
                </div>

                <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
                  {(showAllNearby ? nearbyPlaces : nearbyPlaces.slice(0, 3)).map((place) => {
                    const Icon = nearbyIcons[place.category]
                    return (
                      <a
                        key={place.name}
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${place.name}, Manila, Philippines`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group overflow-hidden rounded-[12px] border border-hairline bg-white transition-colors hover:border-primary/40"
                      >
                        <div className="relative aspect-[16/10] overflow-hidden">
                          <img
                            src={place.image}
                            alt={place.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 typo-caption-sm text-ink shadow-sm">
                            <MapPin className="h-3 w-3 text-primary" />
                            {travelLabel(place.km)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                          <span className="min-w-0 truncate typo-body-sm font-semibold text-ink transition-colors group-hover:text-primary">
                            {place.name}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 typo-caption-sm text-muted">
                            <Icon className="h-3.5 w-3.5" />
                            {place.category}
                          </span>
                        </div>
                      </a>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAllNearby((open) => !open)}
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary-active"
                >
                  {showAllNearby ? "Show less" : `Show more (${nearbyPlaces.length - 3} more)`}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showAllNearby ? "rotate-180" : ""}`}
                  />
                </button>

                <p className="mt-2 typo-caption-sm text-muted">
                  Distances are approximate, measured from Hotel Ava (2184 Madre Ignacia St., cor. Quirino Ave., Malate,
                  Manila). Tap a place for directions. Photos: Wikimedia Commons.
                </p>
              </div>
                )}

                {/* ── Tab: Guest Reviews ─────────────────────────────────── */}
                {detailTab === "reviews" && (
              <div className="pt-lg">
                {reviewCount != null && reviewCount > 0 && (
                  <div className="mb-md flex justify-end">
                    <div className="flex items-center gap-1.5 bg-surface-soft px-3 py-1 rounded-full shrink-0">
                      <Star className="h-4 w-4 fill-star-rating text-star-rating" />
                      <span className="typo-title-sm text-ink">{avgRating}</span>
                      <span className="typo-caption-sm text-muted">
                        ({reviewCount} {reviewCount === 1 ? "review" : "reviews"})
                      </span>
                    </div>
                  </div>
                )}

                {reviewsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-[12px] border border-hairline p-4 animate-pulse">
                        <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
                        <div className="h-3 bg-gray-50 rounded w-full" />
                      </div>
                    ))}
                  </div>
                ) : allReviews.length > 0 ? (
                  <>
                    {/* Shopee-style average + per-star breakdown */}
                    <div className="mb-4 flex items-center gap-5 rounded-[12px] border border-hairline bg-white p-4">
                      <div className="shrink-0 border-r border-hairline pr-5 text-center">
                        <p className="font-display text-3xl leading-none text-ink">
                          {reviewSummary ? reviewSummary.average : avgRating}
                        </p>
                        <div className="my-1.5 flex justify-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((v) => (
                            <Star
                              key={v}
                              className={`h-3.5 w-3.5 ${
                                v <= Math.round(Number(avgRating) || 0)
                                  ? "fill-star-rating text-star-rating"
                                  : "text-[#D5DADF]"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="typo-caption-sm text-muted">
                          {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                        </p>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        {starCounts.map(({ star, count }) => {
                          const pct = allReviews.length ? (count / allReviews.length) * 100 : 0
                          const active = ratingFilter === star
                          return (
                            <button
                              key={star}
                              type="button"
                              onClick={() => pickRatingFilter(active ? null : star)}
                              className={`flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-1 py-0.5 transition-colors ${
                                active ? "bg-surface-soft" : "hover:bg-surface-soft"
                              }`}
                            >
                              <span
                                className={`typo-caption-sm w-7 shrink-0 text-right ${
                                  active ? "font-semibold text-primary" : "text-muted"
                                }`}
                              >
                                {star}★
                              </span>
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-soft">
                                <span
                                  className="block h-full rounded-full bg-star-rating transition-[width]"
                                  style={{ width: `${pct}%` }}
                                />
                              </span>
                              <span className="typo-caption-sm w-5 shrink-0 text-right text-muted">
                                {count}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Filter chips — All sa unahan, tapos 5★ hanggang 1★ */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      {filterChips.map((chip) => {
                        const active = ratingFilter === chip.value
                        return (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => pickRatingFilter(chip.value)}
                            className={`cursor-pointer rounded-full border px-3 py-1 typo-caption-sm transition-colors ${
                              active
                                ? "border-primary bg-primary font-semibold text-canvas"
                                : "border-hairline bg-white text-body hover:border-primary hover:text-primary"
                            }`}
                          >
                            {chip.label}
                          </button>
                        )
                      })}
                    </div>

                    {visibleReviews.length > 0 ? (
                      <div className="space-y-3">
                        {pagedReviews.map((r) => (
                          <div key={r.id} className="rounded-[12px] border border-hairline bg-white p-4">
                            <div className="flex items-center justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <img
                                  src={getStoredAvatar(r.guest_avatar) || getGeneratedAvatar(r.guest_name)}
                                  alt=""
                                  loading="lazy"
                                  onError={(e) => onAvatarError(e, r.guest_name)}
                                  className="h-9 w-9 shrink-0 rounded-full border border-hairline bg-surface-soft object-cover"
                                />
                                <span className="typo-body-sm font-semibold text-ink truncate">
                                  {r.guest_name}
                                </span>
                              </div>
                              <span className="typo-caption-sm text-muted shrink-0">
                                {formatReviewDate(r.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 mb-2">
                              {[1, 2, 3, 4, 5].map((v) => (
                                <Star
                                  key={v}
                                  className={`h-3.5 w-3.5 ${
                                    v <= r.rating ? "fill-star-rating text-star-rating" : "text-[#D5DADF]"
                                  }`}
                                />
                              ))}
                            </div>
                            {r.comment && (
                              <p className="typo-body-sm text-body leading-relaxed">{r.comment}</p>
                            )}

                            {/* Guest photos — up to 5, tap to enlarge */}
                            {r.images.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                {r.images.map((src, i) => (
                                  <button
                                    key={src}
                                    type="button"
                                    onClick={() => setLightbox({ images: r.images, index: i })}
                                    className="h-16 w-16 cursor-pointer overflow-hidden rounded-[6px] border border-hairline transition-opacity hover:opacity-90"
                                  >
                                    <img
                                      src={src}
                                      alt={`${r.guest_name}'s photo ${i + 1}`}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Hotel Ava's reply to this review */}
                            {r.admin_reply && (
                              <div className="mt-3 rounded-[8px] border border-hairline-soft bg-surface-soft px-3.5 py-2.5">
                                <p className="typo-caption-sm text-ink">
                                  <span className="font-semibold">Hotel Ava replied</span>
                                  {r.admin_replied_at && (
                                    <span className="font-normal text-muted">
                                      {" "}· {formatReviewDate(r.admin_replied_at)}
                                    </span>
                                  )}
                                </p>
                                <p className="typo-body-sm mt-1 whitespace-pre-line text-body">
                                  {r.admin_reply}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[12px] border border-dashed border-hairline p-5 text-center">
                        <p className="typo-body-sm font-medium text-ink">
                          No {ratingFilter}★ reviews yet
                        </p>
                        <button
                          type="button"
                          onClick={() => pickRatingFilter(null)}
                          className="typo-caption-sm mt-1 cursor-pointer text-primary underline underline-offset-2"
                        >
                          Show all reviews
                        </button>
                      </div>
                    )}

                    <Pagination
                      page={safeReviewPage}
                      pageCount={reviewPageCount}
                      onPageChange={setReviewPage}
                      className="mt-4"
                    />
                  </>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-hairline p-6 text-center">
                    <Star className="h-5 w-5 mx-auto mb-2 text-[#D5DADF]" />
                    <p className="typo-body-sm font-medium text-ink">No reviews yet</p>
                    <p className="typo-caption-sm text-muted mt-1">
                      Stayed here? Your review helps other guests decide.
                    </p>
                  </div>
                )}

                {/* Photo lightbox — tap a review photo to enlarge */}
                {lightbox && (
                  <Dialog open onOpenChange={(next) => { if (!next) setLightbox(null) }}>
                    <DialogContent className="max-w-[46rem] border-none bg-black/95 p-3 shadow-none ring-0 [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]]:hover:text-white/80">
                      <div className="relative flex items-center justify-center">
                        <img
                          src={lightbox.images[lightbox.index]}
                          alt="Review photo enlarged"
                          className="max-h-[70vh] w-auto max-w-full rounded-[8px] object-contain"
                        />
                        {lightbox.images.length > 1 && (
                          <>
                            <button
                              type="button"
                              aria-label="Previous photo"
                              onClick={() =>
                                setLightbox({
                                  images: lightbox.images,
                                  index:
                                    (lightbox.index - 1 + lightbox.images.length) %
                                    lightbox.images.length,
                                })
                              }
                              className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                            >
                              <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              aria-label="Next photo"
                              onClick={() =>
                                setLightbox({
                                  images: lightbox.images,
                                  index: (lightbox.index + 1) % lightbox.images.length,
                                })
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
                            >
                              <ChevronRight className="h-5 w-5" />
                            </button>
                          </>
                        )}
                      </div>
                      <p className="mt-2 text-center text-xs text-white/70">
                        {lightbox.index + 1} / {lightbox.images.length}
                      </p>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 bg-canvas border border-hairline rounded-[12px] p-lg">
              {/* Price Display */}
              <div className="mb-lg">
                {showDiscount ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="typo-display-lg text-[#A4423A]">&#x20B1;{showDiscount.discountedPrice.toLocaleString()}</span>
                      <span className="typo-body-sm text-muted">/ night</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="typo-body-sm text-muted line-through">&#x20B1;{room.price.toLocaleString()}</span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-[#A4423A]/10 text-[#A4423A]">
                        <Tag className="h-3 w-3" />
                        {showDiscount.discountPercent}% OFF
                      </span>
                    </div>
                    <p className="text-xs text-muted">{showDiscountReason}</p>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="typo-display-lg text-secondary">&#x20B1;{room.price.toLocaleString()}</span>
                    <span className="typo-body-sm text-muted">/ night</span>
                  </div>
                )}
              </div>

              {/* Stay Type — one bar with a dropdown; locked to the home search choice */}
              <div className="mb-lg">
                {stayLocked ? (
                  <div className="py-2.5 rounded-[12px] bg-primary text-on-primary shadow-sm text-sm font-semibold text-center">
                    {stayType === "overnight" ? "Overnight Stay" : "Day Use"}
                  </div>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Stay type"
                      className="group flex w-full items-center justify-between gap-2 rounded-[12px] border border-hairline bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-colors cursor-pointer hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary data-popup-open:border-primary data-popup-open:text-primary"
                    >
                      <span>{stayType === "overnight" ? "Overnight Stay" : "Day Use"}</span>
                      <ChevronDown className="size-4 text-muted transition-transform duration-200 group-data-popup-open:rotate-180" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" sideOffset={6} className="rounded-[12px] p-1.5">
                      <DropdownMenuItem
                        onClick={() => setStayType("overnight")}
                        className={`cursor-pointer rounded-[8px] py-2.5 ${
                          stayType === "overnight"
                            ? "bg-primary/10 text-primary font-semibold hover:bg-primary/10 focus:bg-primary/10"
                            : ""
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <BedDouble className="size-4" />
                          Overnight Stay
                        </span>
                        {stayType === "overnight" && <Check className="ml-auto size-4" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setStayType("day")}
                        className={`cursor-pointer rounded-[8px] py-2.5 ${
                          stayType === "day"
                            ? "bg-primary/10 text-primary font-semibold hover:bg-primary/10 focus:bg-primary/10"
                            : ""
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Sunrise className="size-4" />
                          Day Use
                        </span>
                        {stayType === "day" && <Check className="ml-auto size-4" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {/* Overnight: Date pickers + Time */}
              {stayType === "overnight" && (
                <div className="space-y-md mb-lg">
                  <div className={checkIn ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 gap-2"}>
                    <div>
                      <label className="typo-caption text-muted block mb-xs">Check-in</label>
                      <DatePicker
                        selected={checkIn}
                        onChange={(date: Date | null) => setCheckIn(date)}
                        startDate={checkIn}
                        endDate={checkOut}
                        minDate={new Date()}
                        dateFormat="MMM d, yyyy"
                        customInput={<DateInput placeholder="Select date" />}
                        placeholderText="Select date"
                      />
                    </div>
                    {checkIn && (
                      <div>
                        <label className="typo-caption text-muted block mb-xs">Check-out</label>
                        <div className="w-full flex items-center gap-sm px-base py-2.5 rounded-[12px] border border-hairline bg-surface-soft/60">
                          <span className="typo-body-sm font-semibold text-ink truncate">
                            {checkOut
                              ? checkOut.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : "—"}
                          </span>
                          <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                            Auto
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-primary/80">
                    <Clock className="h-3 w-3 shrink-0" />
                    1 night only · out by {OVERNIGHT_CHECK_OUT}
                  </p>

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Check-in Time</label>
                    <div className="w-full flex items-center gap-sm px-base py-2.5 rounded-[12px] border border-hairline bg-surface-soft/60">
                      <Clock className="h-4 w-4 text-muted shrink-0" />
                      <span className="typo-body-sm font-semibold text-ink">{OVERNIGHT_CHECK_IN}</span>
                    </div>
                  </div>

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Check-out Time</label>
                    <div className="w-full flex items-center gap-sm px-base py-2.5 rounded-[12px] border border-hairline bg-surface-soft/60">
                      <Clock className="h-4 w-4 text-muted shrink-0" />
                      <span className="typo-body-sm font-semibold text-ink">{OVERNIGHT_CHECK_OUT}</span>
                    </div>
                  </div>

                  {overnightLabel && (
                    <div className="bg-primary/5 border border-primary/10 rounded-[10px] px-3 py-2 space-y-1">
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

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Guests</label>
                    <div className="px-3 py-2 rounded-[12px] border border-hairline bg-white">
                      <GuestSelector 
                        value={guests} 
                        onChange={setGuests} 
                        maxAdults={room.max_adults} 
                        maxChildren={room.max_children} 
                        allowChildren={room.allows_children}
                        allowPets={room.amenities?.some(a => a.includes('Pet')) || false}
                        maxPets={2}
                      />
                    </div>
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
                      dateFormat="MMM d, yyyy"
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
                            if (startTime) {
                              const maxStart = 24 - d
                              const match = startTime.match(/(\d+):00/)
                              if (match) {
                                let h = parseInt(match[1])
                                if (startTime.includes("PM") && !startTime.startsWith("12")) h += 12
                                if (startTime.startsWith("12") && startTime.includes("AM")) h = 0
                                if (h > maxStart) {
                                  setStartTime("")
                                }
                              }
                            }
                          }}
                          className={`py-2.5 rounded-[10px] text-sm font-semibold transition-all ${
                            dayDuration === d
                              ? "bg-primary text-on-primary shadow-sm"
                              : "bg-white text-muted border border-hairline hover:border-primary/30"
                          }`}
                        >
                          <span className="block leading-tight">{d}h</span>
                          <span className="block text-[11px] font-medium tabular-nums opacity-80">
                            ₱{dayUseRate(room, d).toLocaleString()}
                          </span>
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
                        <option value="" disabled>Select Time</option>
                        {startTimes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                  </div>

                  {dayLabel && (
                    <div className="bg-primary/5 border border-primary/10 rounded-[10px] px-3 py-2 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      <span className="text-sm text-ink font-medium">{dayLabel}</span>
                    </div>
                  )}

                  <div>
                    <label className="typo-caption text-muted block mb-xs">Guests</label>
                    <div className="px-3 py-2 rounded-[12px] border border-hairline bg-white">
                      <GuestSelector 
                        value={guests} 
                        onChange={setGuests} 
                        maxAdults={room.max_adults} 
                        maxChildren={room.max_children} 
                        allowChildren={room.allows_children}
                        allowPets={room.amenities?.some(a => a.includes('Pet')) || false}
                        maxPets={2}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Price Breakdown */}
              <div className="mt-lg pt-lg border-t border-hairline">
                {showDiscount && (
                  <div className="flex justify-between mb-sm">
                    <span className="typo-body-sm text-muted">
                      {showDiscountReason} ({showDiscount.discountPercent}% off)
                    </span>
                    <span className="typo-body-sm text-[#A4423A] font-medium">Saved ₱{(subtotal - displaySubtotal).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between mb-sm">
                  <span className="typo-body-sm text-muted">
                    {stayType === "day" ? `Day Use (${dayDuration}h)` : `${stayType === "overnight" ? `₱${effectivePrice.toLocaleString()} × ${nights} night${nights > 1 ? "s" : ""}` : `Day Use (${dayDuration}h)`}`}
                  </span>
                  <span className="typo-body-sm text-ink">&#x20B1;{displaySubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-sm">
                  <span className="typo-body-sm text-muted">Taxes & fees</span>
                  <span className="typo-body-sm text-ink">&#x20B1;{Math.round(displaySubtotal * 0.12).toLocaleString()}</span>
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
                    Full payment — nothing left to pay
                  </li>
                  <li className="flex items-center gap-2 text-sm text-ink">
                    <Check className="h-4 w-4 text-success" />
                    Downpayment — pay the balance at the hotel
                  </li>
                </ul>
              </div>

              {/* Book Now Button — kept at the very bottom of the card */}
              <div className="mt-lg">
                {(() => {
                  const isMissingFields =
                    (stayType === "overnight" && (!checkIn || !checkOut)) ||
                    (stayType === "day" && (!checkIn || !startTime))
                  const isUnavailable = isAvailable === false
                  const canBook = !isMissingFields && !isUnavailable && !checkingAvailability
                  return (
                    <>
                      {isUnavailable && (
                        <div className="bg-red-50 border border-red-200 rounded-[12px] px-4 py-3 mb-3">
                          <p className="text-sm text-red-600 font-medium">
                            This room is not available for the selected dates/times. Please choose different dates.
                          </p>
                        </div>
                      )}
                      <motion.div whileHover={canBook ? { scale: 1.02 } : undefined} whileTap={canBook ? { scale: 0.98 } : undefined}>
                        <Button
                          className={`w-full bg-primary text-on-primary hover:bg-primary-active !rounded-[12px]${!canBook ? " opacity-50 cursor-not-allowed" : ""}`}
                          disabled={!canBook}
                          onClick={() => {
                            if (!isAuthenticated) {
                              setAuthModalMode("default")
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
                              params.set("adults", String(guests.adults))
                              params.set("children", String(guests.children))
                              navigate(`/booking/${id}?${params.toString()}`)
                            }
                          }}
                        >
                          Book Now
                        </Button>
                      </motion.div>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Required Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setShowAuthModal(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-signin-title"
            className="bg-white rounded-2xl shadow-lg p-8 text-center animate-scale-in relative max-h-[92dvh] overflow-y-auto"
            style={{ width: "100%", maxWidth: authModalMode === "quick" ? "540px" : "400px" }}
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

            <div className="mb-4 flex justify-center">
              <img src={hotelLogo} alt="" className="h-8 w-auto" />
            </div>

            <h2 id="room-signin-title" className="mb-1 text-xl font-semibold text-ink">
              Sign in to book
            </h2>
            <p className="mb-6 text-sm text-muted">
              {authModalMode === "quick"
                ? "Scan this code with your signed-in phone."
                : "You need to be signed in to make a reservation."}
            </p>

            {authModalMode === "quick" ? (
              <QuickSignInPanel
                layout="wide"
                onSignedIn={() => setShowAuthModal(false)}
                onBack={() => setAuthModalMode("default")}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    // window.location.search already starts with "?" when present — don't add another
                    const returnToUrl = `/rooms/${id}${window.location.search}`
                    sessionStorage.setItem("postOAuthReturnTo", returnToUrl)
                    sessionStorage.setItem("postOAuthReturnToAt", String(Date.now()))
                    const { supabase } = await import("@/lib/supabase")
                    await supabase.auth.signInWithOAuth({
                      provider: "google",
                      options: { redirectTo: `${window.location.origin}${returnToUrl}` },
                    })
                  }}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm text-ink/80">Continue with Google</span>
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
                    setShowAuthModal(false)
                    // window.location.search already starts with "?" when present — don't add another
                    const returnToUrl = `/rooms/${id}${window.location.search}`
                    navigate(`/login?returnTo=${encodeURIComponent(returnToUrl)}`)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer text-sm text-ink/80"
                >
                  <Mail className="w-4 h-4" />
                  Sign in with Email
                </button>

                {/* Quick Sign-In */}
                <button
                  type="button"
                  onClick={() => setAuthModalMode("quick")}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-hairline bg-white hover:bg-surface-soft transition-colors cursor-pointer text-sm text-ink/80"
                >
                  <QrCode className="w-4 h-4" />
                  Quick Sign-In
                </button>
              </>
            )}

            <p className="text-xs text-muted mt-5 leading-relaxed">
              By signing in, you agree to our{" "}
              <Link to="/terms" className="font-medium" style={{ color: "#82285f" }}>Terms of Service</Link>
              {" "}and{" "}
              <Link to="/terms#privacy" className="font-medium" style={{ color: "#82285f" }}>Privacy Policy</Link>
            </p>
          </div>
        </div>
      )}

      {/* Show More Details Modal */}
      {showMoreDetails && room && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setShowMoreDetails(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl animate-scale-in relative overflow-hidden flex flex-col"
            style={{ width: "100%", maxWidth: "520px", maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">Room Details</h2>
                <p className="text-sm text-gray-500 mt-0.5">{room.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMoreDetails(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer -mt-1"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto space-y-7">
              {/* Specifications */}
              <div>
                <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-3">Specifications</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 mb-0.5">Type</p>
                    <p className="text-sm font-medium text-gray-900">{room.type}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 mb-0.5">Capacity</p>
                    <p className="text-sm font-medium text-gray-900">{room.capacity} guests</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 mb-0.5">Max Adults</p>
                    <p className="text-sm font-medium text-gray-900">{room.max_adults}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 mb-0.5">Max Children</p>
                    <p className="text-sm font-medium text-gray-900">
                      {room.max_children}
                      {!room.allows_children && (
                        <span className="ml-1 text-xs font-normal text-gray-400">(n/a)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Available Amenities */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Available</h3>
                  <span className="text-[11px] text-gray-300">·</span>
                  <span className="text-[11px] text-gray-400">{room.amenities.length} of {allAmenities.length}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {allAmenities
                    .filter((a) => room.amenities.includes(a))
                    .map((amenity) => {
                      const iconName = getAmenityIcon(amenity)
                      const IconComponent = lucideIconMap[iconName] || Sparkles
                      return (
                        <div key={amenity} className="flex items-center gap-2.5 py-1.5">
                          <div className="w-5 h-5 rounded-md bg-emerald-50 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-emerald-600" />
                          </div>
                          <IconComponent className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                          <span className="text-[13px] text-gray-700">{amenity}</span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Divider */}
              {missingAmenities.length > 0 && (
                <div className="border-t border-gray-100" />
              )}

              {/* Not Available Amenities */}
              {missingAmenities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <h3 className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Not Available</h3>
                    <span className="text-[11px] text-gray-300">·</span>
                    <span className="text-[11px] text-gray-400">{missingAmenities.length} {missingAmenities.length === 1 ? "item" : "items"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {missingAmenities.map((amenity) => {
                      const iconName = getAmenityIcon(amenity)
                      const IconComponent = lucideIconMap[iconName] || Sparkles
                      return (
                        <div key={amenity} className="flex items-center gap-2.5 py-1.5">
                          <div className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                            <X className="h-3 w-3 text-gray-400" />
                          </div>
                          <IconComponent className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                          <span className="text-[13px] text-gray-400">{amenity}</span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-3 ml-7">Available in other room types.</p>
                </div>
              )}

              {/* All Included Note */}
              {missingAmenities.length === 0 && (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 rounded-xl">
                  <div className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-emerald-600" />
                  </div>
                  <p className="text-[13px] text-gray-600">This room includes every available amenity.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMoreDetails(false)}
                className="px-5 py-2 rounded-xl bg-primary text-on-primary hover:bg-primary-active text-sm font-medium transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
