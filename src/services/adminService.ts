import {
  roomsApi,
  bookingsApi,
  guestsApi,
  dashboardApi,
  analyticsApi,
  type RoomData,
  type BookingData,
  type GuestData,
  type DashboardStats,
  type DashboardSummary,
  type MonthlyRevenue,
  type OccupancyData,
  type SeasonalData,
  type RoomPerformanceData,
  type Insight,
  type ForecastPoint,
  type ForecastAccuracyData,
  type ForecastAccuracyMetrics,
  type DemandInsightData,
  type DiscountOfferData,
  type DiscountOfferStatus,
  type DiscountSuggestion,
  type DiscountRules,
  type DiscountAuditEntry,
  type RecommendationsData,
  type AIRecommendation,
} from "./api"
import { getStale, isStale, setCache, clearCache } from "@/lib/cache"
import type { Booking, Guest, AdminRoom } from "@/data/admin"
import type { BookingStatus } from "@/data/admin"

type Revalidatable<T> = { data: T; revalidate?: Promise<T> }

function revalidate<T>(key: string, fetcher: () => Promise<T>): Revalidatable<T> | null {
  const stale = getStale<T>(key)
  if (stale !== null && !isStale(key)) {
    return { data: stale }
  }
  if (stale !== null) {
    return {
      data: stale,
      revalidate: fetcher().then((fresh) => {
        setCache(key, fresh)
        return fresh
      }),
    }
  }
  return null
}

// â”€â”€ Rooms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getRooms(): Promise<AdminRoom[]> {
  const rv = revalidate<AdminRoom[]>("rooms", fetchRooms)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchRooms()
}

async function fetchRooms(): Promise<AdminRoom[]> {
  // Errors propagate on purpose: falling back to demo rooms here made the admin
  // UI show fake inventory whenever the API was unreachable (expired session,
  // backend restarting). A real, empty list still returns [].
  const rooms = await roomsApi.getAll()
  const result = rooms.map((r: RoomData) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    price: r.price,
    capacity: r.capacity,
    max_adults: r.max_adults,
    max_children: r.max_children,
    allows_children: r.allows_children,
    amenities: r.amenities || [],
    images: r.images || [],
    description: r.description || "",
    status: r.status,
    bookings: r.bookings,
    revenue: r.revenue,
    day_use_3h: r.day_use_3h ?? null,
    day_use_6h: r.day_use_6h ?? null,
    day_use_8h: r.day_use_8h ?? null,
    day_use_12h: r.day_use_12h ?? null,
  }))
  setCache("rooms", result)
  return result
}

export async function addRoom(room: Omit<AdminRoom, "id" | "bookings" | "revenue">): Promise<AdminRoom | null> {
  try {
    const data = await roomsApi.add({
      name: room.name,
      type: room.type,
      price: room.price,
      capacity: room.capacity,
      max_adults: room.max_adults,
      max_children: room.max_children,
      allows_children: room.allows_children,
      amenities: room.amenities,
      images: room.images,
      description: room.description,
      status: room.status,
      day_use_3h: room.day_use_3h ?? null,
      day_use_6h: room.day_use_6h ?? null,
      day_use_8h: room.day_use_8h ?? null,
      day_use_12h: room.day_use_12h ?? null,
    })
    clearCache("rooms")
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      price: data.price,
      capacity: data.capacity,
      max_adults: data.max_adults,
      max_children: data.max_children,
      allows_children: data.allows_children,
      amenities: data.amenities || [],
      images: data.images || [],
      description: data.description || "",
      status: data.status,
      bookings: 0,
      revenue: 0,
      day_use_3h: data.day_use_3h ?? null,
      day_use_6h: data.day_use_6h ?? null,
      day_use_8h: data.day_use_8h ?? null,
      day_use_12h: data.day_use_12h ?? null,
    }
  } catch {
    return null
  }
}

export async function updateRoom(room: AdminRoom): Promise<AdminRoom | null> {
  try {
    const data = await roomsApi.update(room.id, {
      name: room.name,
      type: room.type,
      price: room.price,
      capacity: room.capacity,
      max_adults: room.max_adults,
      max_children: room.max_children,
      allows_children: room.allows_children,
      amenities: room.amenities,
      images: room.images,
      description: room.description,
      status: room.status,
      day_use_3h: room.day_use_3h ?? null,
      day_use_6h: room.day_use_6h ?? null,
      day_use_8h: room.day_use_8h ?? null,
      day_use_12h: room.day_use_12h ?? null,
    })
    clearCache("rooms")
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      price: data.price,
      capacity: data.capacity,
      max_adults: data.max_adults,
      max_children: data.max_children,
      allows_children: data.allows_children,
      amenities: data.amenities || [],
      images: data.images || [],
      description: data.description || "",
      status: data.status,
      bookings: data.bookings,
      revenue: data.revenue,
      day_use_3h: data.day_use_3h ?? null,
      day_use_6h: data.day_use_6h ?? null,
      day_use_8h: data.day_use_8h ?? null,
      day_use_12h: data.day_use_12h ?? null,
    }
  } catch {
    return null
  }
}

export async function deleteRoom(roomId: string): Promise<boolean> {
  try {
    await roomsApi.delete(roomId)
    clearCache("rooms")
    return true
  } catch {
    return false
  }
}

// â”€â”€ Bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getBookings(opts: { force?: boolean } = {}): Promise<Booking[]> {
  // After a status change the cached copy is already wrong â€” skip the
  // stale-while-revalidate window and go straight to the API.
  if (opts.force) return fetchBookings()
  const rv = revalidate<Booking[]>("bookings", fetchBookings)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchBookings()
}

async function fetchBookings(): Promise<Booking[]> {
  // Errors propagate on purpose: the old `catch â†’ mockBookings` fallback made
  // the admin table render DEMO rows (Maria Santos, #BK-001â€¦) whenever the API
  // failed â€” typically an expired session after leaving the tab idle. The pages
  // surface the failure instead of showing invented reservations.
  const bookings = await bookingsApi.getAll()
  const result = bookings.map((b: BookingData) => ({
    id: b.id,
    fullId: b.fullId,
    guestName: b.guestName,
    guestEmail: b.guestEmail,
    guestAvatar: b.guestAvatar || "",
    guestId: b.guestId || "",
    roomType: b.roomType,
    roomNumber: b.roomNumber,
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    nights: b.nights,
    amount: b.amount,
    status: b.status as BookingStatus,
    guests: b.guests ?? 1,
    phone: b.phone || "",
    specialRequests: b.specialRequests || "",
    stay_type: b.stay_type,
    duration: b.duration,
    start_time: b.start_time,
    createdAt: b.createdAt,
    payment_method: b.payment_method || "",
    payment_mode: b.payment_mode || "full",
    amount_paid: b.amount_paid ?? 0,
    refunded_at: b.refunded_at ?? null,
    checked_in_at: b.checked_in_at ?? null,
    cancellation_reason: b.cancellation_reason ?? null,
    extended_hours: b.extended_hours ?? 0,
    extended_at: b.extended_at ?? null,
  }))
  setCache("bookings", result)
  return result
}

export async function getRecentBookings(limit = 5): Promise<Booking[]> {
  const cacheKey = `bookings-recent-${limit}`
  const rv = revalidate<Booking[]>(cacheKey, () => fetchRecentBookings(limit))
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchRecentBookings(limit)
}

async function fetchRecentBookings(limit: number): Promise<Booking[]> {
  try {
    const bookings = await bookingsApi.getAll(limit)
    const result = bookings.map((b: BookingData) => ({
      id: b.id,
      fullId: b.fullId,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      guestAvatar: b.guestAvatar || "",
      guestId: b.guestId || "",
      roomType: b.roomType,
      roomNumber: b.roomNumber,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      amount: b.amount,
      status: b.status as BookingStatus,
      guests: b.guests ?? 1,
      stay_type: b.stay_type,
      duration: b.duration,
      start_time: b.start_time,
      payment_method: b.payment_method || "",
      payment_mode: b.payment_mode || "full",
      amount_paid: b.amount_paid ?? 0,
    checked_in_at: b.checked_in_at ?? null,
    cancellation_reason: b.cancellation_reason ?? null,
    extended_hours: b.extended_hours ?? 0,
    extended_at: b.extended_at ?? null,
  }))
  setCache(`bookings-recent-${limit}`, result)
    return result
  } catch {
    return []
  }
}

// â”€â”€ Guests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getGuests(): Promise<Guest[]> {
  const rv = revalidate<Guest[]>("guests", fetchGuests)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchGuests()
}

async function fetchGuests(): Promise<Guest[]> {
  try {
    const guests = await guestsApi.getAll()
    const result = guests.map((g: GuestData) => ({
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      totalBookings: g.totalBookings,
      totalSpent: g.totalSpent,
      lastStay: g.lastStay,
      status: g.status,
      avatar_url: g.avatar_url || "",
      created_at: g.created_at || "",
    }))
    setCache("guests", result)
    return result
  } catch {
    return []
  }
}

// â”€â”€ Dashboard Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { DashboardStats }

export async function getDashboardStats(): Promise<DashboardStats> {
  const rv = revalidate<DashboardStats>("dash-stats", fetchDashboardStats)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchDashboardStats()
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  try {
    const data = await dashboardApi.getStats()
    setCache("dash-stats", data)
    return data
  } catch {
    return {
      totalBookings: 0,
      monthlyRevenue: 0,
      occupancyRate: 0,
      confirmedBookings: 0,
      pendingBookings: 0,
      cancelledBookings: 0,
      totalGuests: 0,
      activeGuests: 0,
    }
  }
}

//  Admin Dashboard Summary (exact counts) 

export type { DashboardSummary }

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const rv = revalidate<DashboardSummary>("dash-summary-v3", fetchDashboardSummary)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchDashboardSummary()
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  // Errors propagate on purpose â€” the dashboard renders an explicit
  // "Couldn't load summary" + Retry instead of pretending every count is 0.
  const data = await dashboardApi.getSummary()
  setCache("dash-summary-v3", data)
  return data
}

// â”€â”€ Monthly Revenue Chart Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { MonthlyRevenue }

export async function getMonthlyRevenue(): Promise<MonthlyRevenue[]> {
  const rv = revalidate<MonthlyRevenue[]>("dash-revenue", fetchMonthlyRevenue)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchMonthlyRevenue()
}

async function fetchMonthlyRevenue(): Promise<MonthlyRevenue[]> {
  try {
    const data = await dashboardApi.getMonthlyRevenue()
    setCache("dash-revenue", data)
    return data
  } catch {
    return []
  }
}

// â”€â”€ Occupancy Chart Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { OccupancyData }

export async function getOccupancyData(): Promise<OccupancyData[]> {
  const rv = revalidate<OccupancyData[]>("dash-occupancy", fetchOccupancyData)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchOccupancyData()
}

async function fetchOccupancyData(): Promise<OccupancyData[]> {
  try {
    const data = await dashboardApi.getOccupancy()
    setCache("dash-occupancy", data)
    return data
  } catch {
    return []
  }
}

// â”€â”€ Analytics: Seasonal Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { SeasonalData }

export async function getSeasonalData(): Promise<SeasonalData[]> {
  const rv = revalidate<SeasonalData[]>("analytics-seasonal", fetchSeasonalData)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchSeasonalData()
}

async function fetchSeasonalData(): Promise<SeasonalData[]> {
  try {
    const data = await analyticsApi.getSeasonal()
    setCache("analytics-seasonal", data)
    return data
  } catch {
    return []
  }
}

// â”€â”€ Analytics: Room Performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { RoomPerformanceData }

export async function getRoomPerformance(): Promise<RoomPerformanceData[]> {
  const rv = revalidate<RoomPerformanceData[]>("analytics-room-perf", fetchRoomPerformance)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchRoomPerformance()
}

async function fetchRoomPerformance(): Promise<RoomPerformanceData[]> {
  try {
    const data = await analyticsApi.getRoomPerformance()
    setCache("analytics-room-perf", data)
    return data
  } catch {
    return []
  }
}

// â”€â”€ Analytics: Key Insights â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { Insight }

export async function getInsights(): Promise<Insight[]> {
  const rv = revalidate<Insight[]>("analytics-insights", fetchInsights)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchInsights()
}

async function fetchInsights(): Promise<Insight[]> {
  try {
    const data = await analyticsApi.getInsights()
    setCache("analytics-insights", data)
    return data
  } catch {
    return []
  }
}

// â”€â”€ Analytics: Forecast Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { ForecastPoint, ForecastAccuracyData, ForecastAccuracyMetrics }

export async function getOccupancyForecast(): Promise<ForecastPoint[]> {
  const rv = revalidate<ForecastPoint[]>("analytics-occ-forecast", fetchOccForecast)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchOccForecast()
}

async function fetchOccForecast(): Promise<ForecastPoint[]> {
  try {
    const data = await analyticsApi.getOccupancyForecast()
    setCache("analytics-occ-forecast", data)
    return data
  } catch {
    return []
  }
}

export async function getRevenueForecast(): Promise<ForecastPoint[]> {
  const rv = revalidate<ForecastPoint[]>("analytics-rev-forecast", fetchRevForecast)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchRevForecast()
}

async function fetchRevForecast(): Promise<ForecastPoint[]> {
  try {
    const data = await analyticsApi.getRevenueForecast()
    setCache("analytics-rev-forecast", data)
    return data
  } catch {
    return []
  }
}

export async function getForecastAccuracy(): Promise<ForecastAccuracyData | null> {
  try {
    const data = await analyticsApi.getForecastAccuracy()
    setCache("analytics-forecast-accuracy", data)
    return data
  } catch {
    return null
  }
}

// â”€â”€ AI: Demand Insight Recommendations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { DemandInsightData }

export async function getDemandInsights(): Promise<DemandInsightData[]> {
  const rv = revalidate<DemandInsightData[]>("analytics-demand", fetchDemandInsights)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchDemandInsights()
}

async function fetchDemandInsights(): Promise<DemandInsightData[]> {
  try {
    const data = await analyticsApi.getDemandInsights()
    setCache("analytics-demand", data)
    return data
  } catch {
    return []
  }
}

export async function setDemandInsightStatus(id: string, action: "accept" | "dismiss" | "edit", discountPercent?: number): Promise<void> {
  await analyticsApi.setDemandInsightStatus(id, action, discountPercent)
  clearCache("analytics-demand")
}

// â”€â”€ AI: Discount Offers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { DiscountOfferData, DiscountOfferStatus, DiscountSuggestion, DiscountRules, DiscountAuditEntry }

export async function getDiscountOffers(): Promise<DiscountOfferData[]> {
  const rv = revalidate<DiscountOfferData[]>("analytics-discounts", fetchDiscountOffers)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchDiscountOffers()
}

async function fetchDiscountOffers(): Promise<DiscountOfferData[]> {
  try {
    const data = await analyticsApi.getDiscountOffers()
    setCache("analytics-discounts", data)
    return data
  } catch {
    return []
  }
}

/** Post-mutation refresh: always the network, never the SWR window (a stale
 *  hit here would hide a just-approved promo). One retry, then last known. */
export async function getDiscountOffersFresh(): Promise<DiscountOfferData[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await analyticsApi.getDiscountOffers()
      setCache("analytics-discounts", data)
      return data
    } catch {
      // retry once after a short pause
      await new Promise((r) => setTimeout(r, 300))
    }
  }
  return getStale<DiscountOfferData[]>("analytics-discounts") ?? []
}

/** Activate/deactivate one offer or a promo-wide ids batch; optional percent
 *  edit rides along (validated server-side against cap + minimum rate). */
export async function setDiscountOfferStatus(payload: {
  id?: string
  ids?: string[]
  enabled?: boolean
  discountPercent?: number
}): Promise<{ ok: boolean; statuses?: Record<string, DiscountOfferStatus> }> {
  const res = await analyticsApi.setDiscountOfferStatus(payload)
  clearCache("analytics-discounts")
  return res
}

/** Cap + minimum rate the admin UI validates against. Falls back to the
 *  server defaults if the rules endpoint is unreachable. */
export async function getDiscountRules(): Promise<DiscountRules> {
  try {
    return await analyticsApi.getDiscountRules()
  } catch {
    return { maxPercent: 50, minPrice: 500 }
  }
}

/** AI holiday promo suggestions with reasoning + estimate. Not cached: the
 *  list changes on every approve/dismiss. */
export async function getDiscountSuggestions(): Promise<DiscountSuggestion[]> {
  try {
    const data = await analyticsApi.getDiscountSuggestions()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export async function applyDiscountSuggestion(
  event: string,
  action: "approve" | "dismiss",
): Promise<{ ok: boolean; state: string; offers?: DiscountOfferData[] }> {
  const res = await analyticsApi.applyDiscountSuggestion(event, action)
  clearCache("analytics-discounts")
  return res
}

export async function createDiscountOffer(payload: {
  roomType: string
  validFrom: string
  validTo: string
  name?: string
  discountPercent: number
}): Promise<DiscountOfferData> {
  const res = await analyticsApi.createDiscountOffer(payload)
  clearCache("analytics-discounts")
  return res
}

/** Recent create/activate/deactivate audit entries (who, when, what). */
export async function getDiscountAudit(): Promise<DiscountAuditEntry[]> {
  try {
    const data = await analyticsApi.getDiscountAudit()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

// â”€â”€ AI: Recommendations Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type { RecommendationsData, AIRecommendation }

export async function getAIRecommendations(): Promise<RecommendationsData> {
  const rv = revalidate<RecommendationsData>("analytics-recommendations", fetchAIRecommendations)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchAIRecommendations()
}

async function fetchAIRecommendations(): Promise<RecommendationsData> {
  try {
    const data = await analyticsApi.getAIRecommendations()
    setCache("analytics-recommendations", data)
    return data
  } catch {
    // Honest empty state â€” callers show "â€”" instead of fake numbers
    return {
      next30DaysOccupancy: 0,
      occupancyTrend: "stable" as const,
      projectedRevenue: 0,
      revenueGrowth: 0,
      activeDiscounts: 0,
      confidence: 0,
      recommendations: [],
    }
  }
}

