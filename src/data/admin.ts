export type BookingStatus = "confirmed" | "pending" | "checked-out" | "cancelled"

export interface Booking {
  id: string
  guestName: string
  guestEmail: string
  roomType: string
  roomNumber: string
  checkIn: string
  checkOut: string
  nights: number
  amount: number
  status: BookingStatus
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

export const bookings: Booking[] = [
  {
    id: "BK-001",
    guestName: "Maria Santos",
    guestEmail: "maria.santos@email.com",
    roomType: "Deluxe Room",
    roomNumber: "D-201",
    checkIn: "2026-06-25",
    checkOut: "2026-06-27",
    nights: 2,
    amount: 5600,
    status: "confirmed",
  },
  {
    id: "BK-002",
    guestName: "Juan Dela Cruz",
    guestEmail: "juan.dc@email.com",
    roomType: "Regular Suite",
    roomNumber: "RS-301",
    checkIn: "2026-06-26",
    checkOut: "2026-06-29",
    nights: 3,
    amount: 11400,
    status: "checked-out",
  },
  {
    id: "BK-003",
    guestName: "Sarah Chen",
    guestEmail: "sarah.chen@email.com",
    roomType: "Standard Room",
    roomNumber: "S-105",
    checkIn: "2026-06-28",
    checkOut: "2026-06-30",
    nights: 2,
    amount: 4800,
    status: "pending",
  },
  {
    id: "BK-004",
    guestName: "Alex Rivera",
    guestEmail: "alex.r@email.com",
    roomType: "Executive Deluxe",
    roomNumber: "ED-401",
    checkIn: "2026-06-24",
    checkOut: "2026-06-26",
    nights: 2,
    amount: 6400,
    status: "checked-out",
  },
  {
    id: "BK-005",
    guestName: "Kim Tanaka",
    guestEmail: "kim.t@email.com",
    roomType: "Superior Suite",
    roomNumber: "SS-501",
    checkIn: "2026-06-29",
    checkOut: "2026-07-02",
    nights: 3,
    amount: 14400,
    status: "confirmed",
  },
  {
    id: "BK-006",
    guestName: "Patricia Reyes",
    guestEmail: "pat.r@email.com",
    roomType: "Standard Room",
    roomNumber: "S-102",
    checkIn: "2026-06-20",
    checkOut: "2026-06-22",
    nights: 2,
    amount: 4800,
    status: "cancelled",
  },
  {
    id: "BK-007",
    guestName: "Mark Lim",
    guestEmail: "mark.lim@email.com",
    roomType: "Deluxe Room",
    roomNumber: "D-203",
    checkIn: "2026-06-27",
    checkOut: "2026-06-28",
    nights: 1,
    amount: 2800,
    status: "confirmed",
  },
  {
    id: "BK-008",
    guestName: "Joyce Garcia",
    guestEmail: "joyce.g@email.com",
    roomType: "Regular Suite",
    roomNumber: "RS-302",
    checkIn: "2026-06-22",
    checkOut: "2026-06-25",
    nights: 3,
    amount: 11400,
    status: "checked-out",
  },
  {
    id: "BK-009",
    guestName: "Daniel Mendoza",
    guestEmail: "dan.m@email.com",
    roomType: "Standard Room",
    roomNumber: "S-108",
    checkIn: "2026-06-30",
    checkOut: "2026-07-01",
    nights: 1,
    amount: 2400,
    status: "pending",
  },
  {
    id: "BK-010",
    guestName: "Angela Torres",
    guestEmail: "angela.t@email.com",
    roomType: "Executive Deluxe",
    roomNumber: "ED-402",
    checkIn: "2026-06-23",
    checkOut: "2026-06-26",
    nights: 3,
    amount: 9600,
    status: "cancelled",
  },
  {
    id: "BK-011",
    guestName: "Carlo Bautista",
    guestEmail: "carlo.b@email.com",
    roomType: "Deluxe Room",
    roomNumber: "D-205",
    checkIn: "2026-06-28",
    checkOut: "2026-07-01",
    nights: 3,
    amount: 8400,
    status: "confirmed",
  },
  {
    id: "BK-012",
    guestName: "Liza Aquino",
    guestEmail: "liza.a@email.com",
    roomType: "Superior Suite",
    roomNumber: "SS-502",
    checkIn: "2026-06-19",
    checkOut: "2026-06-21",
    nights: 2,
    amount: 9600,
    status: "checked-out",
  },
]

export const monthlyRevenue: MonthlyRevenue[] = [
  { month: "Jan", revenue: 285000 },
  { month: "Feb", revenue: 312000 },
  { month: "Mar", revenue: 398000 },
  { month: "Apr", revenue: 345000 },
  { month: "May", revenue: 420000 },
  { month: "Jun", revenue: 378000 },
  { month: "Jul", revenue: 0 },
  { month: "Aug", revenue: 0 },
  { month: "Sep", revenue: 0 },
  { month: "Oct", revenue: 0 },
  { month: "Nov", revenue: 0 },
  { month: "Dec", revenue: 0 },
]

export const occupancyData: OccupancyData[] = [
  { month: "Jan", rate: 62, bookings: 38 },
  { month: "Feb", rate: 71, bookings: 43 },
  { month: "Mar", rate: 85, bookings: 52 },
  { month: "Apr", rate: 78, bookings: 47 },
  { month: "May", rate: 91, bookings: 56 },
  { month: "Jun", rate: 74, bookings: 45 },
]

export interface Guest {
  id: string
  name: string
  email: string
  phone: string
  totalBookings: number
  totalSpent: number
  lastStay: string
  status: "VIP" | "Regular" | "New"
}

export const guests: Guest[] = [
  { id: "G-001", name: "Maria Santos", email: "maria.santos@email.com", phone: "+63 917 555 1001", totalBookings: 3, totalSpent: 16800, lastStay: "2026-06-27", status: "VIP" },
  { id: "G-002", name: "Juan Dela Cruz", email: "juan.dc@email.com", phone: "+63 917 555 1002", totalBookings: 2, totalSpent: 22800, lastStay: "2026-06-29", status: "Regular" },
  { id: "G-003", name: "Sarah Chen", email: "sarah.chen@email.com", phone: "+63 917 555 1003", totalBookings: 1, totalSpent: 4800, lastStay: "2026-06-30", status: "New" },
  { id: "G-004", name: "Alex Rivera", email: "alex.r@email.com", phone: "+63 917 555 1004", totalBookings: 4, totalSpent: 32000, lastStay: "2026-06-26", status: "VIP" },
  { id: "G-005", name: "Kim Tanaka", email: "kim.t@email.com", phone: "+63 917 555 1005", totalBookings: 2, totalSpent: 28800, lastStay: "2026-07-02", status: "Regular" },
  { id: "G-006", name: "Patricia Reyes", email: "pat.r@email.com", phone: "+63 917 555 1006", totalBookings: 1, totalSpent: 4800, lastStay: "2026-06-22", status: "New" },
  { id: "G-007", name: "Mark Lim", email: "mark.lim@email.com", phone: "+63 917 555 1007", totalBookings: 2, totalSpent: 8400, lastStay: "2026-06-28", status: "Regular" },
  { id: "G-008", name: "Joyce Garcia", email: "joyce.g@email.com", phone: "+63 917 555 1008", totalBookings: 3, totalSpent: 34200, lastStay: "2026-06-25", status: "VIP" },
  { id: "G-009", name: "Daniel Mendoza", email: "dan.m@email.com", phone: "+63 917 555 1009", totalBookings: 1, totalSpent: 2400, lastStay: "2026-07-01", status: "New" },
  { id: "G-010", name: "Angela Torres", email: "angela.t@email.com", phone: "+63 917 555 1010", totalBookings: 2, totalSpent: 19200, lastStay: "2026-06-26", status: "Regular" },
  { id: "G-011", name: "Carlo Bautista", email: "carlo.b@email.com", phone: "+63 917 555 1011", totalBookings: 1, totalSpent: 8400, lastStay: "2026-07-01", status: "New" },
  { id: "G-012", name: "Liza Aquino", email: "liza.a@email.com", phone: "+63 917 555 1012", totalBookings: 2, totalSpent: 19200, lastStay: "2026-06-21", status: "Regular" },
]

export interface AdminRoom {
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

export const adminRooms: AdminRoom[] = [
  { id: "S-101", name: "Standard Room", type: "Standard", price: 2400, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Cable TV", "Hairdryer", "Personal Care Kit"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HACU-WEBSITE-RS-RM-79.jpg"], status: "available", bookings: 5, revenue: 14400 },
  { id: "S-102", name: "Standard Room", type: "Standard", price: 2400, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Cable TV", "Hairdryer", "Personal Care Kit"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HACU-WEBSITE-RS-RM-79.jpg"], status: "occupied", bookings: 3, revenue: 7200 },
  { id: "S-105", name: "Standard Room", type: "Standard", price: 2400, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Cable TV", "Hairdryer", "Personal Care Kit"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HACU-WEBSITE-RS-RM-79.jpg"], status: "maintenance", bookings: 1, revenue: 4800 },
  { id: "S-108", name: "Standard Room", type: "Standard", price: 2400, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Cable TV", "Hairdryer", "Personal Care Kit"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HACU-WEBSITE-RS-RM-79.jpg"], status: "available", bookings: 2, revenue: 4800 },
  { id: "D-201", name: "Deluxe Room", type: "Deluxe", price: 2800, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage"], images: ["https://hotel-ava.com/wp-content/uploads/2025/07/HAGP-RM-4.png"], status: "occupied", bookings: 4, revenue: 11200 },
  { id: "D-203", name: "Deluxe Room", type: "Deluxe", price: 2800, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage"], images: ["https://hotel-ava.com/wp-content/uploads/2025/07/HAGP-RM-4.png"], status: "available", bookings: 2, revenue: 5600 },
  { id: "D-205", name: "Deluxe Room", type: "Deluxe", price: 2800, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage"], images: ["https://hotel-ava.com/wp-content/uploads/2025/07/HAGP-RM-4.png"], status: "occupied", bookings: 3, revenue: 8400 },
  { id: "ED-401", name: "Executive Deluxe", type: "Deluxe", price: 3200, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Bathtub"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HAGP-ES-RM4.png"], status: "maintenance", bookings: 1, revenue: 6400 },
  { id: "ED-402", name: "Executive Deluxe", type: "Deluxe", price: 3200, capacity: 2, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Bathtub"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HAGP-ES-RM4.png"], status: "available", bookings: 1, revenue: 9600 },
  { id: "RS-301", name: "Regular Suite", type: "Suite", price: 3800, capacity: 4, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Bathtub", "Jacuzzi"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HAMA-ES-WEBSITE-PHOTO-RM123.png"], status: "occupied", bookings: 2, revenue: 11400 },
  { id: "RS-302", name: "Regular Suite", type: "Suite", price: 3800, capacity: 4, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Bathtub", "Jacuzzi"], images: ["https://hotel-ava.com/wp-content/uploads/2025/04/HAMA-ES-WEBSITE-PHOTO-RM123.png"], status: "available", bookings: 2, revenue: 11400 },
  { id: "SS-501", name: "Superior Suite", type: "Suite", price: 4500, capacity: 4, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Jacuzzi", "KTV"], images: ["https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room128-asgard.png"], status: "occupied", bookings: 3, revenue: 14400 },
  { id: "SS-502", name: "Superior Suite", type: "Suite", price: 4500, capacity: 4, amenities: ["Air Conditioning", "Hot & Cold Shower", "Free WiFi", "Smart TV", "Hairdryer", "Personal Care Kit", "Private Garage", "Jacuzzi", "KTV"], images: ["https://hotel-ava.com/wp-content/uploads/2022/10/Hotel-Ava_gallery-page_room128-asgard.png"], status: "available", bookings: 2, revenue: 9600 },
]

export const totalRooms = 25

export const stats = {
  totalBookings: 12,
  occupancyRate: 74,
  monthlyRevenue: 378000,
  confirmedBookings: 4,
  pendingBookings: 2,
  cancelledBookings: 2,
}

// Predictive analytics data
export interface ForecastPoint {
  month: string
  actual: number | null
  predicted: number
}

export const revenueForecast: ForecastPoint[] = [
  { month: "Jan", actual: 285000, predicted: 280000 },
  { month: "Feb", actual: 312000, predicted: 305000 },
  { month: "Mar", actual: 398000, predicted: 380000 },
  { month: "Apr", actual: 345000, predicted: 350000 },
  { month: "May", actual: 420000, predicted: 410000 },
  { month: "Jun", actual: 378000, predicted: 385000 },
  { month: "Jul", actual: null, predicted: 410000 },
  { month: "Aug", actual: null, predicted: 395000 },
  { month: "Sep", actual: null, predicted: 340000 },
  { month: "Oct", actual: null, predicted: 320000 },
  { month: "Nov", actual: null, predicted: 355000 },
  { month: "Dec", actual: null, predicted: 430000 },
]

export const occupancyForecast: ForecastPoint[] = [
  { month: "Jan", actual: 62, predicted: 60 },
  { month: "Feb", actual: 71, predicted: 68 },
  { month: "Mar", actual: 85, predicted: 82 },
  { month: "Apr", actual: 78, predicted: 76 },
  { month: "May", actual: 91, predicted: 88 },
  { month: "Jun", actual: 74, predicted: 72 },
  { month: "Jul", actual: null, predicted: 82 },
  { month: "Aug", actual: null, predicted: 78 },
  { month: "Sep", actual: null, predicted: 65 },
  { month: "Oct", actual: null, predicted: 58 },
  { month: "Nov", actual: null, predicted: 62 },
  { month: "Dec", actual: null, predicted: 85 },
]

export interface RoomPerformanceData {
  room: string
  revenue: number
  avgPerNight: number
  occupancy: number
}

export const roomPerformance: RoomPerformanceData[] = [
  { room: "Superior Suite", revenue: 48000, avgPerNight: 4800, occupancy: 88 },
  { room: "Regular Suite", revenue: 34200, avgPerNight: 3800, occupancy: 76 },
  { room: "Executive Deluxe", revenue: 28800, avgPerNight: 3200, occupancy: 72 },
  { room: "Deluxe Room", revenue: 25200, avgPerNight: 2800, occupancy: 81 },
  { room: "Standard Room", revenue: 14400, avgPerNight: 2400, occupancy: 68 },
]

export interface SeasonalData {
  month: string
  bookings: number
  revenue: number
  isPeak: boolean
}

export const seasonalData: SeasonalData[] = [
  { month: "Jan", bookings: 38, revenue: 285000, isPeak: false },
  { month: "Feb", bookings: 43, revenue: 312000, isPeak: false },
  { month: "Mar", bookings: 52, revenue: 398000, isPeak: true },
  { month: "Apr", bookings: 47, revenue: 345000, isPeak: true },
  { month: "May", bookings: 56, revenue: 420000, isPeak: true },
  { month: "Jun", bookings: 45, revenue: 378000, isPeak: false },
  { month: "Jul", bookings: 50, revenue: 410000, isPeak: true },
  { month: "Aug", bookings: 48, revenue: 395000, isPeak: false },
  { month: "Sep", bookings: 35, revenue: 340000, isPeak: false },
  { month: "Oct", bookings: 32, revenue: 320000, isPeak: false },
  { month: "Nov", bookings: 38, revenue: 355000, isPeak: false },
  { month: "Dec", bookings: 54, revenue: 430000, isPeak: true },
]

export const insights = [
  { label: "Peak Season", value: "Mar–May, Jul, Dec", detail: "85%+ occupancy expected" },
  { label: "Best Room", value: "Superior Suite", detail: "₱4,800/night avg, 88% occupancy" },
  { label: "Revenue Trend", value: "+12% projected", detail: "Q3 forecast vs Q2" },
  { label: "Low Season", value: "Sep–Oct", detail: "Consider promotional rates" },
]

// ── Demand Forecasting (Discount Recommendations Only) ──────────────────────

export interface DemandInsight {
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

export const demandInsights: DemandInsight[] = [
  {
    id: "DI-001",
    period: "September–October 2026",
    predictedOccupancy: 58,
    reason: "Historically lowest months. Sep 2025 was 55%, Oct 2025 was 52%. No major events expected.",
    recommendation: "10% discount on Standard & Deluxe rooms to stimulate demand",
    discountPercent: 10,
    affectedRooms: ["Standard Room", "Deluxe Room"],
    confidence: 87,
    projectedImpact: "+8% revenue lift vs no action, +12 projected bookings",
    applied: false,
  },
  {
    id: "DI-002",
    period: "November 2026",
    predictedOccupancy: 62,
    reason: "Pre-holiday lull. Last year: 58% occupancy. Guests waiting for December rates.",
    recommendation: "15% discount on all room types — pre-holiday promo to capture early bookings",
    discountPercent: 15,
    affectedRooms: ["Standard Room", "Deluxe Room", "Executive Deluxe", "Regular Suite", "Superior Suite"],
    confidence: 82,
    projectedImpact: "+10% bookings vs no action, fills rooms before peak season",
    applied: false,
  },
  {
    id: "DI-003",
    period: "January 2027 (Post-Sinulog)",
    predictedOccupancy: 65,
    reason: "Post-Sinulog dip. Festival ends Jan 3rd week, occupancy drops sharply after.",
    recommendation: "12% discount on all rooms for last week of January",
    discountPercent: 12,
    affectedRooms: ["Standard Room", "Deluxe Room", "Executive Deluxe", "Regular Suite", "Superior Suite"],
    confidence: 79,
    projectedImpact: "+6% revenue during otherwise low period",
    applied: false,
  },
  {
    id: "DI-004",
    period: "June 2027",
    predictedOccupancy: 68,
    reason: "Rainy season start. Historically slower month (Jun 2026: 74%, Jun 2025: 68%).",
    recommendation: "10% discount on Standard & Deluxe rooms — rainy season promo",
    discountPercent: 10,
    affectedRooms: ["Standard Room", "Deluxe Room"],
    confidence: 84,
    projectedImpact: "+5% occupancy vs no action",
    applied: false,
  },
]

// ── Discount Offers ──────────────────────────────────────────────────────────

export interface DiscountOffer {
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

export const discountOffers: DiscountOffer[] = [
  {
    id: "DO-001",
    roomType: "Standard Room",
    discountPercent: 10,
    validFrom: "2026-09-01",
    validTo: "2026-10-31",
    baseRate: 2400,
    discountedRate: 2160,
    projectedBookings: 18,
    projectedRevenue: 38880,
    status: "scheduled",
  },
  {
    id: "DO-002",
    roomType: "Deluxe Room",
    discountPercent: 10,
    validFrom: "2026-09-01",
    validTo: "2026-10-31",
    baseRate: 2800,
    discountedRate: 2520,
    projectedBookings: 14,
    projectedRevenue: 35280,
    status: "scheduled",
  },
  {
    id: "DO-003",
    roomType: "Standard Room",
    discountPercent: 15,
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
    baseRate: 2400,
    discountedRate: 2040,
    projectedBookings: 12,
    projectedRevenue: 24480,
    status: "scheduled",
  },
  {
    id: "DO-004",
    roomType: "Deluxe Room",
    discountPercent: 15,
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
    baseRate: 2800,
    discountedRate: 2380,
    projectedBookings: 10,
    projectedRevenue: 23800,
    status: "scheduled",
  },
  {
    id: "DO-005",
    roomType: "Executive Deluxe",
    discountPercent: 15,
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
    baseRate: 3200,
    discountedRate: 2720,
    projectedBookings: 8,
    projectedRevenue: 21760,
    status: "scheduled",
  },
  {
    id: "DO-006",
    roomType: "Regular Suite",
    discountPercent: 15,
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
    baseRate: 3800,
    discountedRate: 3230,
    projectedBookings: 6,
    projectedRevenue: 19380,
    status: "scheduled",
  },
  {
    id: "DO-007",
    roomType: "Superior Suite",
    discountPercent: 15,
    validFrom: "2026-11-01",
    validTo: "2026-11-30",
    baseRate: 4800,
    discountedRate: 4080,
    projectedBookings: 4,
    projectedRevenue: 16320,
    status: "scheduled",
  },
]

// ── Seasonal Events ─────────────────────────────────────────────────────────

export interface SeasonalEvent {
  month: string
  event: string
  impact: "peak" | "low"
}

export const seasonalEvents: SeasonalEvent[] = [
  { month: "Jan", event: "Sinulog Festival", impact: "peak" },
  { month: "Mar", event: "Summer Start", impact: "peak" },
  { month: "May", event: "Graduation Season", impact: "peak" },
  { month: "Jul", event: "Peak Summer", impact: "peak" },
  { month: "Dec", event: "Holiday Season", impact: "peak" },
  { month: "Sep", event: "Low Season", impact: "low" },
  { month: "Oct", event: "Low Season", impact: "low" },
]

// ── Model Info ───────────────────────────────────────────────────────────────

export interface ModelInfo {
  name: string
  accuracy: number
  lastUpdated: string
  dataSource: string
  description: string
}

export const modelInfo: ModelInfo = {
  name: "Prophet Time-Series + Linear Regression",
  accuracy: 87,
  lastUpdated: "Jun 29, 2026",
  dataSource: "12 months historical booking data (Jan–Jun 2026 actuals)",
  description: "Combines Facebook Prophet for seasonal trend detection with linear regression for occupancy-to-price optimization. Trained on 6 months of actual booking data + market events calendar.",
}
