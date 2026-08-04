import { useState, useEffect } from "react"
import { Calendar, DollarSign, TrendingUp, Users, Brain, ArrowRight } from "lucide-react"
import { Link } from "react-router"
import StatCard from "@/components/admin/StatCard"
import RevenueChart from "@/components/admin/RevenueChart"
import OccupancyChart from "@/components/admin/OccupancyChart"
import BookingsTable from "@/components/admin/BookingsTable"
import {
  getDashboardStats,
  getRecentBookings,
  getMonthlyRevenue,
  getOccupancyData,
  getDemandInsights,
  type DashboardStats,
  type MonthlyRevenue,
  type OccupancyData,
  type DemandInsightData,
} from "@/services/adminService"
import type { Booking } from "@/data/admin"

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentBookings, setRecentBookings] = useState<Booking[]>([])
  const [revenueData, setRevenueData] = useState<MonthlyRevenue[]>([])
  const [occupancyData, setOccupancyData] = useState<OccupancyData[]>([])
  const [demandInsights, setDemandInsights] = useState<DemandInsightData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, b, r, o, di] = await Promise.all([
        getDashboardStats(),
        getRecentBookings(5),
        getMonthlyRevenue(),
        getOccupancyData(),
        getDemandInsights(),
      ])
      setStats(s)
      setRecentBookings(b)
      setRevenueData(r)
      setOccupancyData(o)
      setDemandInsights(di)
      setLoading(false)
    }
    load()
  }, [])

  const topInsights = demandInsights.slice(0, 2)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1a1d26]">Overview</h1>
        <div className="flex items-center gap-2">
          <button className="rounded-[5px] border border-[#e2e4e8] bg-white px-3 py-1.5 text-[10px] font-medium text-[#6b7280] hover:bg-[#f5f6f8] transition-colors">
            Last 30 days ▾
          </button>
          <button className="rounded-[5px] bg-[#82285f] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-[#6b204f] transition-colors">
            Export
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Bookings"
              value={stats?.totalBookings ?? 0}
              icon={<Calendar className="size-5" />}
              trendValue="—"
              trend="this month"
              trendUp
            />
            <StatCard
              label="Monthly Revenue"
              value={`₱${(stats?.monthlyRevenue ?? 0).toLocaleString()}`}
              icon={<DollarSign className="size-5" />}
              trendValue="—"
              trend="this month"
              trendUp
            />
            <StatCard
              label="Occupancy Rate"
              value={`${stats?.occupancyRate ?? 0}%`}
              icon={<TrendingUp className="size-5" />}
              trendValue="—"
              trend="this month"
              trendUp
            />
            <StatCard
              label="Active Guests"
              value={stats?.activeGuests ?? 0}
              icon={<Users className="size-5" />}
              trendValue="—"
              trend="this month"
              trendUp
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RevenueChart data={revenueData} loading={loading} />
        <OccupancyChart data={occupancyData} loading={loading} />
      </div>

      {/* Predictive Analytics Highlights */}
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-[6px] bg-[#82285f]/10">
              <Brain className="w-4 h-4 text-[#82285f]" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-[#1a1d26]">AI Discount Recommendations</h2>
              <p className="text-[10px] text-[#7A7A70]">Based on real booking data · Statistical projection</p>
            </div>
          </div>
          <Link
            to="/admin/analytics"
            className="flex items-center gap-1 text-[11px] font-medium text-[#82285f] hover:text-[#6b1f4b] transition-colors duration-200"
          >
            View Full Analytics
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-32 bg-[#f0f1f3] rounded-[5px] animate-pulse" />
            ))}
          </div>
        ) : topInsights.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-[12px] text-[#7A7A70]">No discount recommendations at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topInsights.map((insight) => (
                <div
                  key={insight.id}
                  className="rounded-[5px] border border-[#e2e4e8] p-3.5 hover:shadow-card-hover transition-shadow duration-200"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[3px] bg-[#455d58]/10 text-[#455d58]">
                      {insight.discountPercent}% off
                    </span>
                    <span className="text-[10px] text-[#7A7A70]">{insight.confidence}% confidence</span>
                  </div>
                  <p className="text-[12px] font-semibold text-[#1a1d26] mb-1">{insight.period}</p>
                  <p className="text-[11px] text-[#7A7A70] leading-relaxed line-clamp-2">{insight.recommendation}</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="font-display text-lg font-bold text-[#1a1d26]">{insight.predictedOccupancy}%</span>
                    <span className="text-[10px] text-[#7A7A70]">predicted occupancy</span>
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Bookings */}
      <div>
        <h2 className="text-[13px] font-semibold text-[#1a1d26] mb-3">Recent Bookings</h2>
        <BookingsTable bookings={recentBookings} showFilters={false} loading={loading} />
      </div>
    </div>
  )
}
