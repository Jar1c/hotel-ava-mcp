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
  type MonthlyRevenue,
  type OccupancyData,
  type SeasonalData,
  type RoomPerformanceData,
  type Insight,
  type ForecastPoint,
  type DemandInsightData,
  type DiscountOfferData,
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

// ── Rooms ────────────────────────────────────────────────────────────────────

export async function getRooms(): Promise<AdminRoom[]> {
  const rv = revalidate<AdminRoom[]>("rooms", fetchRooms)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchRooms()
}

async function fetchRooms(): Promise<AdminRoom[]> {
  try {
    const rooms = await roomsApi.getAll()
    const result = rooms.map((r: RoomData) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      price: r.price,
      capacity: r.capacity,
      amenities: r.amenities || [],
      images: r.images || [],
      description: r.description || "",
      status: r.status,
      bookings: r.bookings,
      revenue: r.revenue,
    }))
    setCache("rooms", result)
    return result
  } catch {
    return []
  }
}

export async function addRoom(room: Omit<AdminRoom, "id" | "bookings" | "revenue">): Promise<AdminRoom | null> {
  try {
    const data = await roomsApi.add({
      name: room.name,
      type: room.type,
      price: room.price,
      capacity: room.capacity,
      amenities: room.amenities,
      images: room.images,
      description: room.description,
      status: room.status,
    })
    clearCache("rooms")
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      price: data.price,
      capacity: data.capacity,
      amenities: data.amenities || [],
      images: data.images || [],
      description: data.description || "",
      status: data.status,
      bookings: 0,
      revenue: 0,
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
      amenities: room.amenities,
      images: room.images,
      description: room.description,
      status: room.status,
    })
    clearCache("rooms")
    return {
      id: data.id,
      name: data.name,
      type: data.type,
      price: data.price,
      capacity: data.capacity,
      amenities: data.amenities || [],
      images: data.images || [],
      description: data.description || "",
      status: data.status,
      bookings: data.bookings,
      revenue: data.revenue,
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

// ── Bookings ─────────────────────────────────────────────────────────────────

export async function getBookings(): Promise<Booking[]> {
  const rv = revalidate<Booking[]>("bookings", fetchBookings)
  if (rv) { rv.revalidate?.catch(() => {}); return rv.data }
  return fetchBookings()
}

async function fetchBookings(): Promise<Booking[]> {
  try {
    const bookings = await bookingsApi.getAll()
    const result = bookings.map((b: BookingData) => ({
      id: b.id,
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      roomType: b.roomType,
      roomNumber: b.roomNumber,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      amount: b.amount,
      status: b.status as BookingStatus,
    }))
    setCache("bookings", result)
    return result
  } catch {
    return []
  }
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
      guestName: b.guestName,
      guestEmail: b.guestEmail,
      roomType: b.roomType,
      roomNumber: b.roomNumber,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      nights: b.nights,
      amount: b.amount,
      status: b.status as BookingStatus,
    }))
    setCache(`bookings-recent-${limit}`, result)
    return result
  } catch {
    return []
  }
}

// ── Guests ───────────────────────────────────────────────────────────────────

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
    }))
    setCache("guests", result)
    return result
  } catch {
    return []
  }
}

// ── Dashboard Stats ──────────────────────────────────────────────────────────

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

// ── Monthly Revenue Chart Data ───────────────────────────────────────────────

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

// ── Occupancy Chart Data ─────────────────────────────────────────────────────

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

// ── Analytics: Seasonal Data ─────────────────────────────────────────────────

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

// ── Analytics: Room Performance ──────────────────────────────────────────────

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

// ── Analytics: Key Insights ──────────────────────────────────────────────────

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

// ── Analytics: Forecast Data ─────────────────────────────────────────────────

export type { ForecastPoint }

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

// ── AI: Demand Insight Recommendations ───────────────────────────────────────

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

// ── AI: Discount Offers ──────────────────────────────────────────────────────

export type { DiscountOfferData }

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
