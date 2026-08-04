const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

/** Flag to prevent multiple concurrent refresh attempts */
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

/**
 * Try to refresh the access_token using the stored refresh_token.
 * Returns true if refresh succeeded, false otherwise.
 */
async function tryRefreshToken(): Promise<boolean> {
  // If already refreshing, wait for the in-flight attempt
  if (isRefreshing && refreshPromise) return refreshPromise

  const refreshToken = localStorage.getItem("refresh_token")
  if (!refreshToken) return false

  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })

      if (!res.ok) return false

      const data = await res.json()
      localStorage.setItem("access_token", data.access_token)
      localStorage.setItem("refresh_token", data.refresh_token)
      return true
    } catch {
      return false
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function apiFetch<T>(path: string, options: RequestInit = {}, _isRetry = false): Promise<T> {
  const token = localStorage.getItem("access_token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  // On 401 (expired token), try to refresh and retry once
  if (res.status === 401 && !_isRetry) {
    const refreshed = await tryRefreshToken()
    if (refreshed) {
      return apiFetch<T>(path, options, true)
    }
    // Refresh failed — throw error but DON'T clear tokens here
    // AuthContext handles token cleanup based on the error
    throw new Error("Unauthorized")
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `API error ${res.status}`)
  }

  return res.json()
}

// ── Auth ───────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  avatar_url?: string
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  user: AuthUser
}

export const authApi = {
  register: (data: { email: string; password: string; name: string }) =>
    apiFetch<{ user: AuthUser }>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    apiFetch<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  getProfile: () => apiFetch<AuthUser>("/auth/profile"),

  updateProfile: (data: { name?: string; avatar_url?: string; phone?: string }) =>
    apiFetch<AuthUser>("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),

  logout: () => apiFetch("/auth/logout", { method: "POST" }),

  uploadAvatar: async (file: File): Promise<{ avatar_url: string }> => {
    const token = localStorage.getItem("access_token")
    const form = new FormData()
    form.append("file", file)

    const res = await fetch(`${API_BASE}/auth/avatar`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Upload failed ${res.status}`)
    }
    return res.json()
  },

  changePassword: (data: { new_password: string }) =>
    apiFetch<{ message: string }>("/auth/password", { method: "PUT", body: JSON.stringify(data) }),

  refreshTokens: (refreshToken: string) =>
    fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).then(r => {
      if (!r.ok) throw new Error("Refresh failed")
      return r.json() as Promise<LoginResponse>
    }),
}

// ── Public Rooms (no auth required) ───────────────────────────────────────────

export interface PublicRoomData {
  id: string
  name: string
  type: string
  description: string
  price: number
  capacity: number
  amenities: string[]
  images: string[]
}

export const publicRoomsApi = {
  getAll: () => apiFetch<PublicRoomData[]>("/rooms/public"),
  getById: (id: string) => apiFetch<PublicRoomData>(`/rooms/public/${id}`),
}

// ── Upload ────────────────────────────────────────────────────────────────────

export const uploadApi = {
  image: async (file: File): Promise<{ url: string; path: string }> => {
    const token = localStorage.getItem("access_token")
    const form = new FormData()
    form.append("file", file)

    const res = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error || `Upload failed ${res.status}`)
    }
    return res.json()
  },

  delete: (path: string) =>
    apiFetch("/upload", {
      method: "DELETE",
      body: JSON.stringify({ path }),
    }),
}

// ── Rooms (admin) ─────────────────────────────────────────────────────────────

export interface RoomData {
  id: string
  name: string
  type: string
  price: number
  capacity: number
  amenities: string[]
  images: string[]
  status: "available" | "occupied" | "maintenance"
  bookings: number
  revenue: number
}

export const roomsApi = {
  getAll: () => apiFetch<RoomData[]>("/rooms"),

  add: (room: Omit<RoomData, "id" | "bookings" | "revenue">) =>
    apiFetch<RoomData>("/rooms", { method: "POST", body: JSON.stringify(room) }),

  update: (id: string, room: Omit<RoomData, "id" | "bookings" | "revenue">) =>
    apiFetch<RoomData>(`/rooms/${id}`, { method: "PUT", body: JSON.stringify(room) }),

  delete: (id: string) =>
    apiFetch(`/rooms/${id}`, { method: "DELETE" }),
}

// ── Bookings (user) ────────────────────────────────────────────────────────────

export interface CreateBookingPayload {
  room_id: string
  check_in: string
  check_out: string
  guests: number
  full_name: string
  email: string
  phone: string
  special_requests?: string
  payment_method: string
  total_price: number
}

export interface BookingResponse {
  booking_id: string
  checkout_url?: string
  status: string
}

export interface UserBookingData {
  id: string
  room_id: string
  room_name: string
  room_type: string
  room_image: string
  check_in: string
  check_out: string
  nights: number
  guests: number
  total_price: number
  status: string
  payment_method: string
  created_at: string
}

export const userBookingsApi = {
  create: (payload: CreateBookingPayload) =>
    apiFetch<BookingResponse>("/bookings", { method: "POST", body: JSON.stringify(payload) }),

  getMine: () => apiFetch<UserBookingData[]>("/bookings/mine"),

  getOne: (id: string) => apiFetch<UserBookingData & { full_name: string; email: string; phone: string; special_requests: string }>(`/bookings/${id}`),

  cancel: (id: string) =>
    apiFetch(`/bookings/${id}/cancel`, { method: "POST" }),

  retryPay: (id: string) =>
    apiFetch<{ checkout_url: string }>(`/bookings/${id}/pay`, { method: "POST" }),
}

// ── Bookings (admin) ──────────────────────────────────────────────────────────

export interface BookingData {
  id: string
  guestName: string
  guestEmail: string
  roomType: string
  roomNumber: string
  checkIn: string
  checkOut: string
  nights: number
  amount: number
  status: string
}

export const bookingsApi = {
  getAll: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : ""
    return apiFetch<BookingData[]>(`/bookings${params}`)
  },
}

// ── Guests ─────────────────────────────────────────────────────────────────────

export interface GuestData {
  id: string
  name: string
  email: string
  phone: string
  totalBookings: number
  totalSpent: number
  lastStay: string
  status: "VIP" | "Regular" | "New"
}

export const guestsApi = {
  getAll: () => apiFetch<GuestData[]>("/guests"),
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalBookings: number
  monthlyRevenue: number
  occupancyRate: number
  confirmedBookings: number
  pendingBookings: number
  cancelledBookings: number
  totalGuests: number
  activeGuests: number
}

export interface MonthlyRevenue {
  month: string
  revenue: number
}

export interface OccupancyData {
  month: string
  rate: number
  bookings: number
}

export const dashboardApi = {
  getStats: () => apiFetch<DashboardStats>("/dashboard/stats"),
  getMonthlyRevenue: () => apiFetch<MonthlyRevenue[]>("/dashboard/monthly-revenue"),
  getOccupancy: () => apiFetch<OccupancyData[]>("/dashboard/occupancy"),
}

// ── Analytics ──────────────────────────────────────────────────────────────────

export interface SeasonalData {
  month: string
  bookings: number
  revenue: number
  isPeak: boolean
}

export interface RoomPerformanceData {
  room: string
  revenue: number
  avgPerNight: number
  occupancy: number
}

export interface Insight {
  label: string
  value: string
  detail: string
}

export interface ForecastPoint {
  month: string
  actual: number | null
  predicted: number
}

export interface DemandInsightData {
  id: string
  period: string
  predictedOccupancy: number
  reason: string
  recommendation: string
  discountPercent: number
  affectedRooms: string[]
  confidence: number
  projectedImpact: string
  applied: boolean
}

export interface DiscountOfferData {
  id: string
  roomType: string
  discountPercent: number
  validFrom: string
  validTo: string
  baseRate: number
  discountedRate: number
  projectedBookings: number
  projectedRevenue: number
  status: "active" | "scheduled" | "expired"
}

export const analyticsApi = {
  getSeasonal: () => apiFetch<SeasonalData[]>("/analytics/seasonal"),
  getRoomPerformance: () => apiFetch<RoomPerformanceData[]>("/analytics/room-performance"),
  getInsights: () => apiFetch<Insight[]>("/analytics/insights"),
  getOccupancyForecast: () => apiFetch<ForecastPoint[]>("/analytics/forecast/occupancy"),
  getRevenueForecast: () => apiFetch<ForecastPoint[]>("/analytics/forecast/revenue"),
  getDemandInsights: () => apiFetch<DemandInsightData[]>("/analytics/demand-insights"),
  getDiscountOffers: () => apiFetch<DiscountOfferData[]>("/analytics/discount-offers"),
}
