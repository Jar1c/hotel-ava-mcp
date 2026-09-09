import { useState, useEffect } from "react"
import { Brain, TrendingUp, DollarSign, Calendar } from "lucide-react"
import StatCard from "@/components/admin/StatCard"
import { getDashboardStats, type DashboardStats } from "@/services/adminService"
import { getAIRecommendations, type RecommendationsData } from "@/services/adminService"

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [s, reco] = await Promise.all([
        getDashboardStats(),
        getAIRecommendations(),
      ])
      setStats(s)
      setRecommendations(reco)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1a1d26]">Dashboard</h1>
      </div>

      {/* AI Recommendations (3 cards) */}
      <div className="bg-[#82285f]/5 rounded-[6px] border border-[#82285f]/20 p-5 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-[6px] bg-[#82285f]/10">
            <Brain className="w-4 h-4 text-[#82285f]" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-[#82285f]">AI-Powered Insights</h2>
            <p className="text-[11px] text-[#82285f]/70">Machine learning predictions &amp; recommendations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 bg-white/50 rounded-[8px] animate-pulse" />
            ))
          ) : (
            <>
              <div className="rounded-[8px] bg-white border border-[#e2e4e8] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-[#82285f]" />
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-[4px] ${
                    (recommendations?.occupancyTrend ?? "stable") === "up"
                      ? "bg-green-100 text-green-700"
                      : (recommendations?.occupancyTrend ?? "stable") === "down"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}>
                    {(recommendations?.occupancyTrend ?? "stable").toUpperCase()}
                  </span>
                </div>
                <p className="text-[13px] font-bold text-[#1a1d26] mb-1">Occupancy Forecast</p>
                <p className="text-[12px] text-[#4a4f59]">{recommendations?.next30DaysOccupancy ?? 72}% projected next 30 days</p>
              </div>

              <div className="rounded-[8px] bg-white border border-[#e2e4e8] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-[#82285f]" />
                  <span className="text-[11px] font-bold px-2 py-1 rounded-[4px] bg-[#455d58]/10 text-[#455d58]">
                    {(recommendations?.revenueGrowth ?? 0) > 0 ? "+" : ""}
                    {recommendations?.revenueGrowth ?? 0}%
                  </span>
                </div>
                <p className="text-[13px] font-bold text-[#1a1d26] mb-1">Revenue Forecast</p>
                <p className="text-[12px] text-[#4a4f59]">₱{(recommendations?.projectedRevenue ?? 0).toLocaleString()} next 30 days</p>
              </div>

              <div className="rounded-[8px] bg-white border border-[#e2e4e8] p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-[#82285f]" />
                  <span className="text-[11px] font-bold px-2 py-1 rounded-[4px] bg-[#82285f]/10 text-[#82285f]">
                    {recommendations?.activeDiscounts ?? 0} active
                  </span>
                </div>
                <p className="text-[13px] font-bold text-[#1a1d26] mb-1">Discount Recommendations</p>
                <p className="text-[12px] text-[#4a4f59]">{recommendations?.bestDiscountPeriod ?? "No discounts needed at this time."}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Key Stats */}
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
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 5 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="8" r="4" /></svg>}
              trendValue="—"
              trend="this month"
              trendUp
            />
          </>
        )}
      </div>
    </div>
  )
}
