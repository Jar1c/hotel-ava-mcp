import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "react-router"
import { motion } from "motion/react"
import { RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react"
import { publicRoomsApi, type PublicRoomData, type RoomQuote } from "@/services/api"
import { type Room } from "@/data/rooms"
import { setCache, getCached } from "@/lib/cache"
import { formatDate as toISODate, parseDateParam } from "@/lib/dates"
import { rankRooms } from "@/lib/roomRanking"
import RoomCard, { type RoomOfferDiscount } from "@/components/rooms/RoomCard"
import { getActiveOffers, offerCoversDate, offerTitle, type ActiveOffer } from "@/services/discountService"
import RoomFilters from "@/components/rooms/RoomFilters"
import {
  DEFAULT_ROOM_FILTERS,
  countActiveFilters,
  roomMatchesFilter,
  type FilterableRoom,
  type RoomFilterState,
} from "@/lib/roomFilters"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Skeleton, SkeletonLine, SkeletonRegion } from "@/components/ui/skeleton"
import { useMinSkeleton } from "@/hooks/useMinSkeleton"
import type { DiscountRoom } from "@/lib/discountEngine"
import { getRoomDiscount } from "@/lib/discountEngine"
import { useDiscountApproval } from "@/hooks/useDiscountApproval"

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const, delay: i * 0.15 },
  }),
}

const cardContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
}

const cardItem = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
}

function mapApiRoom(r: PublicRoomData): Room {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description,
    price: r.price,
    capacity: r.capacity,
    max_adults: r.max_adults,
    max_children: r.max_children,
    allows_children: r.allows_children,
    amenities: r.amenities,
    images: r.images,
    rating: r.rating ?? undefined,
    reviews: r.reviews,
    day_use_3h: r.day_use_3h ?? null,
    day_use_6h: r.day_use_6h ?? null,
    day_use_8h: r.day_use_8h ?? null,
    day_use_12h: r.day_use_12h ?? null,
  }
}

function RoomCardSkeleton() {
  return (
    <div className="bg-canvas rounded-lg overflow-hidden flex flex-col h-full">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <div className="p-3 flex flex-col gap-2 flex-1">
        <SkeletonLine className="h-4 w-3/4" />
        <SkeletonLine className="h-3 w-1/4" />
        <div className="flex gap-1 mt-auto">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <SkeletonLine className="h-4 w-1/3" />
      </div>
    </div>
  )
}

export default function Rooms() {
  const [searchParams] = useSearchParams()
  const [roomsData, setRoomsData] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({})
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const { isApproved } = useDiscountApproval()

  const filters = {
    stayType: searchParams.get("stayType") || undefined,
    checkIn: searchParams.get("checkIn") || searchParams.get("checkin") || undefined,
    checkOut: searchParams.get("checkOut") || searchParams.get("checkout") || undefined,
    startTime: searchParams.get("startTime") || undefined,
    duration: searchParams.get("duration") || undefined,
    adults: Number(searchParams.get("adults")) || undefined,
    children: Number(searchParams.get("children")) || undefined,
    pets: Number(searchParams.get("pets")) || undefined,
    budgetMax: Number(searchParams.get("budgetMax")) || 99999,
  }

  const hasDateFilter = filters.checkIn && (
    filters.stayType === "overnight" ? filters.checkOut : filters.startTime
  )

  const [loadError, setLoadError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  // Skeletons show at least 500ms — including the availability re-check that
  // runs when the guest picks dates.
  const showSkeleton = useMinSkeleton(
    Boolean(loading || (hasDateFilter && checkingAvailability)),
  )

  const retryRooms = () => {
    setLoadError(false)
    setReloadToken((t) => t + 1)
  }

  useEffect(() => {
    const cached = getCached<PublicRoomData[]>("public_rooms")
    if (cached) {
      setRoomsData(cached.map(mapApiRoom))
      setLoading(false)
    }

    publicRoomsApi.getAll()
      .then((data) => {
        setRoomsData(data.map(mapApiRoom))
        setCache("public_rooms", data)
        setLoadError(false)
      })
      .catch(() => {
        if (!cached) {
          setRoomsData([])
          setLoadError(true)
        }
      })
      .finally(() => setLoading(false))
  }, [reloadToken])

  // Scheduled offers the admin switched on - they must show on guest rooms,
  // otherwise "Activate" in the admin table does nothing visible.
  const [activeOffers, setActiveOffers] = useState<ActiveOffer[]>([])
  useEffect(() => {
    let cancelled = false
    getActiveOffers()
      .then((data) => { if (!cancelled) setActiveOffers(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Server-computed prices for the current search dates (same math
  // create_booking charges). Without dates the backend prices from today, so
  // browsing shows live promos too. Quote wins over every client-side path.
  const [quoteMap, setQuoteMap] = useState<Record<string, RoomQuote>>({})
  useEffect(() => {
    if (roomsData.length === 0) return
    let cancelled = false
    setQuoteMap({})
    publicRoomsApi.quote({
      check_in: filters.checkIn ? toISODate(parseDateParam(filters.checkIn)) : undefined,
      check_out:
        filters.stayType === "overnight" && filters.checkOut
          ? toISODate(parseDateParam(filters.checkOut))
          : undefined,
      stay_type: filters.stayType === "day" ? "day" : "overnight",
    })
      .then((list) => {
        if (cancelled) return
        setQuoteMap(Object.fromEntries(list.map((q) => [q.room_id, q])))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [roomsData, filters.checkIn, filters.checkOut, filters.stayType])

  // Check availability for all rooms when date filters are present.
  // checkingAvailability stays true until every room answered, so the grid
  // shows skeletons instead of rooms that may turn out to be booked.
  useEffect(() => {
    if (!hasDateFilter || roomsData.length === 0) {
      setAvailabilityMap({})
      setCheckingAvailability(false)
      return
    }

    let cancelled = false
    setCheckingAvailability(true)

    const checkAll = async () => {
      const results: Record<string, boolean> = {}
      await Promise.all(
        roomsData.map(async (room) => {
          try {
            const res = await publicRoomsApi.checkAvailability({
              room_id: room.id,
              check_in: toISODate(parseDateParam(filters.checkIn!)),
              check_out: filters.stayType === "overnight" && filters.checkOut
                ? toISODate(parseDateParam(filters.checkOut))
                : undefined,
              stay_type: filters.stayType || "overnight",
              start_time: filters.stayType === "day" ? filters.startTime : undefined,
              duration: filters.stayType === "day" && filters.duration ? Number(filters.duration) : undefined,
            })
            results[room.id] = res.available
          } catch {
            results[room.id] = true // Show room if check fails
          }
        })
      )
      if (cancelled) return
      setAvailabilityMap(results)
      setCheckingAvailability(false)
    }

    checkAll()
    return () => { cancelled = true }
  }, [roomsData, hasDateFilter, filters.checkIn, filters.checkOut, filters.stayType, filters.startTime, filters.duration])

  const discountRooms: DiscountRoom[] = useMemo(
    () => roomsData.map((r) => ({ id: r.id, name: r.name, type: r.type, price: r.price })),
    [roomsData],
  )

  // Room type -> the scheduled offer the admin switched on.
  const offerByType = useMemo(() => {
    const map = new Map<string, ActiveOffer>()
    activeOffers.forEach((o) => map.set(o.roomType, o))
    return map
  }, [activeOffers])

  /** The active scheduled offer for one room. Browsing shows every switched-on
   *  offer; once the guest picks dates we only advertise the ones that cover
   *  those dates, so the badge never promises a price the stay will not get. */
  const offerFor = useCallback((room: Room): RoomOfferDiscount | null => {
    const offer = offerByType.get(room.type)
    if (!offer) return null
    if (filters.checkIn) {
      const day = parseDateParam(filters.checkIn)
      if (!day || !offerCoversDate(offer, day)) return null
    }
    return {
      percent: offer.discountPercent,
      price: offer.discountedRate,
      original: offer.baseRate,
      reason: offerTitle(offer),
      validTo: offer.validTo,
    }
  }, [offerByType, filters.checkIn])

  // Sidebar filter panel (Room type / price / rating / amenities / guest needs).
  const [filterState, setFilterState] = useState<RoomFilterState>(DEFAULT_ROOM_FILTERS)
  const activeFilterCount = countActiveFilters(filterState)

  // One flat list the sidebar and the URL search filters both run against.
  const filterableRooms: FilterableRoom[] = useMemo(
    () =>
      roomsData.map((r) => {
        const quote = quoteMap[r.id]
        const deal = getRoomDiscount(discountRooms, r.id)
        // Scheduled offers the admin switched on count as a promo too -
        // otherwise the "active promo" filter hides every discounted room.
        const offer = offerFor(r)
        return {
          id: r.id,
          type: r.type,
          price: quote
            ? quote.rate
            : offer
              ? offer.price
              : deal
                ? deal.discountedPrice
                : r.price,
          rating: r.rating ?? null,
          amenities: r.amenities ?? [],
          allows_children: r.allows_children === true,
          petFriendly: (r.amenities ?? []).some((a) => a.includes("Pet")),
          hasDeal: quote ? Boolean(quote.discount) : Boolean(deal) || Boolean(offer),
        }
      }),
    [roomsData, discountRooms, offerFor, quoteMap],
  )

  const matchingFilterIds = useMemo(() => {
    // The search bar still owns pets/children, so merge them into the sidebar state.
    const merged: RoomFilterState = {
      ...filterState,
      petFriendly: filterState.petFriendly || Boolean(filters.pets && filters.pets > 0),
      familyFriendly:
        filterState.familyFriendly || Boolean(filters.children && filters.children > 0),
    }
    return new Set(
      filterableRooms.filter((r) => roomMatchesFilter(r, merged)).map((r) => r.id),
    )
  }, [filterableRooms, filterState, filters.pets, filters.children])

  // Smart Filter: sidebar + guests preference > date availability > budget
  const smartFilteredRooms = useMemo(() => {
    let result = roomsData.filter((room) => matchingFilterIds.has(room.id))

    // Date availability (if dates specified)
    if (hasDateFilter) {
      result = result.filter((room) => availabilityMap[room.id] === true)
    }

    // Budget from the home search bar
    if (filters.budgetMax && filters.budgetMax < 99999) {
      result = result.filter((room) => room.price <= filters.budgetMax!)
    }

    return result
  }, [roomsData, matchingFilterIds, availabilityMap, filters.budgetMax, hasDateFilter])

  // Sort: discounted rooms first, then by effective price (cheapest first).
  // The server quote wins whenever we have one, so sorting matches display.
  const sortedRooms = useMemo(() => {
    const effectivePrice = (r: Room) => {
      const quote = quoteMap[r.id]
      if (quote) return quote.rate
      const offer = offerFor(r)
      if (offer) return offer.price
      const d = getRoomDiscount(discountRooms, r.id)
      return d ? d.discountedPrice : r.price
    }
    const hasPromo = (r: Room) => {
      const quote = quoteMap[r.id]
      if (quote) return Boolean(quote.discount)
      return Boolean(offerFor(r)) || Boolean(getRoomDiscount(discountRooms, r.id))
    }
    return [...smartFilteredRooms].sort((a, b) => {
      // Discounted rooms come first
      if (hasPromo(a) && !hasPromo(b)) return -1
      if (!hasPromo(a) && hasPromo(b)) return 1
      // Then by effective price (cheapest first)
      return effectivePrice(a) - effectivePrice(b)
    })
  }, [smartFilteredRooms, discountRooms, offerFor, quoteMap])

  // AI ranking: the 3 best matches for this search, the rest follow below
  const guests = (filters.adults ?? 0) + (filters.children ?? 0)
  const rankedRooms = useMemo(
    () => rankRooms(sortedRooms, { guests, budgetMax: filters.budgetMax, discountRooms }),
    [sortedRooms, guests, filters.budgetMax, discountRooms]
  )
  const aiPicks = rankedRooms.slice(0, 3)
  const otherRooms = rankedRooms.slice(3)
  // Suggestions only make sense for a real search — hidden while browsing
  const showAiSuggestions = Boolean(hasDateFilter) && aiPicks.length > 0
  const belowRooms = showAiSuggestions ? otherRooms : sortedRooms

  // Suggested rooms: when no exact match, show closest alternatives
  const suggestedRooms = useMemo(() => {
    if (sortedRooms.length > 0 || !hasDateFilter) return []

    const budget = filters.budgetMax || 99999

    // Available rooms only (availability was already checked)
    const available = hasDateFilter
      ? roomsData.filter((r) => availabilityMap[r.id] === true)
      : roomsData

    if (available.length === 0) return []

    // Strategy 1: rooms within 1.5x the budget
    const expandedBudget = budget * 1.5
    let candidates = available.filter((r) => r.price <= expandedBudget)

    // Strategy 2: if still nothing, take the cheapest available rooms
    if (candidates.length === 0) {
      candidates = [...available].sort((a, b) => a.price - b.price).slice(0, 4)
    }

    // Sort by closest to budget (prefer rooms at or just under budget)
    return candidates.sort((a, b) => {
      const diffA = Math.abs(a.price - budget)
      const diffB = Math.abs(b.price - budget)
      return diffA - diffB
    }).slice(0, 4)
  }, [sortedRooms, hasDateFilter, roomsData, availabilityMap, filters.budgetMax])

  return (
    <div className="px-base py-section">
      <div className="max-w-container mx-auto">
        <motion.div
          className="mb-lg"
          custom={0}
          initial="hidden"
          animate="visible"
          variants={fadeUp}
        >
          <h1 className="typo-display-xl text-ink mb-sm">Rooms & Suites</h1>
          <p className="typo-body-md text-body">
            Discover our selection of rooms and suites at Hotel Ava Malate.
          </p>
        </motion.div>

        <div className="flex items-start gap-xl">
          <aside className="hidden w-[264px] shrink-0 self-start lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-2 lg:pb-2">
            <RoomFilters rooms={filterableRooms} value={filterState} onChange={setFilterState} />
          </aside>

          <div className="min-w-0 flex-1 lg:min-h-[70vh]">
        <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
          <p className="typo-caption-sm text-muted">
            {loading ? "Loading…"
              : hasDateFilter && checkingAvailability
                ? "Checking availability for your dates…"
                : hasDateFilter
                  ? sortedRooms.length > 0
                    ? `${sortedRooms.length} ${sortedRooms.length === 1 ? "room" : "rooms"} available for your preference`
                    : suggestedRooms.length > 0
                      ? `${suggestedRooms.length} ${suggestedRooms.length === 1 ? "room" : "rooms"} suggested — no exact match`
                      : "No rooms match your preference"
                  : `${roomsData.length} ${roomsData.length === 1 ? "room" : "rooms"} available`}
          </p>

          <Sheet>
            <SheetTrigger
              type="button"
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-white px-base py-2 text-sm font-semibold text-ink hover:border-primary hover:text-primary lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="text-primary">({activeFilterCount})</span>
              )}
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] overflow-y-auto sm:max-w-[300px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <RoomFilters
                rooms={filterableRooms}
                value={filterState}
                onChange={setFilterState}
              />
            </SheetContent>
          </Sheet>
        </div>

        <div className="border-b border-hairline/50 mb-xl" />

        <SkeletonRegion loading={showSkeleton}>
        {showSkeleton ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-lg">
            {Array.from({ length: 8 }).map((_, i) => (
              <RoomCardSkeleton key={i} />
            ))}
          </div>
        ) : loadError ? (
          <div className="text-center py-xl">
            <p className="typo-body-lg text-ink font-medium">Couldn't load rooms</p>
            <p className="typo-body-sm text-muted mt-sm">
              Something went wrong while fetching our rooms. Please try again.
            </p>
            <button
              type="button"
              onClick={retryRooms}
              className="mt-md inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-base py-2 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
            >
              <RotateCcw className="h-4 w-4" />
              Try again
            </button>
          </div>
        ) : sortedRooms.length > 0 ? (
          <div>
            {/* ── AI picks (only after a search) ─────────────────────── */}
            {showAiSuggestions && (
              <section className="mb-xl">
                <div className="flex flex-wrap items-end justify-between gap-sm mb-lg">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <h2 className="typo-display-md text-ink">AI Room Suggestions</h2>
                    </div>
                    <p className="typo-body-sm text-muted mt-xs">
                      Top 3 best matches for your dates, guests and budget
                    </p>
                  </div>
                  <span className="typo-caption-sm font-semibold text-primary">Top {aiPicks.length}</span>
                </div>

                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-lg"
                  variants={cardContainer}
                  initial="hidden"
                  animate="visible"
                  key="ai-picks"
                >
                  {aiPicks.map((room, index) => (
                    <motion.div key={room.id} variants={cardItem} custom={index}>
                      <RoomCard room={room} filters={filters} discountRooms={discountRooms} isApproved={isApproved} offerDiscount={offerFor(room)} quote={quoteMap[room.id] ?? null} />
                    </motion.div>
                  ))}
                </motion.div>
              </section>
            )}

            {/* ── The rest — or the full list when just browsing ───────── */}
            {belowRooms.length > 0 && (
              <section>
                {showAiSuggestions && (
                  <div className="mb-lg">
                    <h2 className="typo-display-md text-ink">Other Available Rooms</h2>
                    <p className="typo-body-sm text-muted mt-xs">
                      {otherRooms.length} more {otherRooms.length === 1 ? "room" : "rooms"} you can book
                    </p>
                  </div>
                )}

                <motion.div
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-lg"
                  variants={cardContainer}
                  initial="hidden"
                  animate="visible"
                  key={showAiSuggestions ? "search" : "browse"}
                >
                  {belowRooms.map((room, index) => (
                    <motion.div key={room.id} variants={cardItem} custom={index}>
                      <RoomCard room={room} filters={filters} discountRooms={discountRooms} isApproved={isApproved} offerDiscount={offerFor(room)} quote={quoteMap[room.id] ?? null} />
                    </motion.div>
                  ))}
                </motion.div>
              </section>
            )}
          </div>
        ) : (
          <div>
            <motion.div
              className="text-center py-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <p className="typo-body-lg text-ink font-medium">
                {activeFilterCount > 0 ? "No rooms match your filters" : "No exact match found"}
              </p>
              <p className="typo-body-sm text-muted mt-sm">
                {activeFilterCount > 0
                  ? "Try removing a filter to see more rooms."
                  : hasDateFilter
                    ? "No rooms are available for your exact search. Here are the closest options we found:"
                    : "No rooms match your budget. Here are the closest options:"}
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterState(DEFAULT_ROOM_FILTERS)}
                  className="mt-md inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-base py-2 text-sm font-semibold text-ink hover:border-primary hover:text-primary"
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear all filters
                </button>
              )}
            </motion.div>

            {suggestedRooms.length > 0 && (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-lg"
                variants={cardContainer}
                initial="hidden"
                animate="visible"
              >
                {suggestedRooms.map((room, index) => (
                  <motion.div key={room.id} variants={cardItem} custom={index}>
                    <RoomCard room={room} filters={filters} discountRooms={discountRooms} isApproved={isApproved} offerDiscount={offerFor(room)} quote={quoteMap[room.id] ?? null} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        )}
        </SkeletonRegion>
          </div>
        </div>
      </div>
    </div>
  )
}

