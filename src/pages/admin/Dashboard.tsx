import { useState } from "react"
import { TrendingUp, PhilippinePeso, Calendar } from "lucide-react"
import StatCard from "@/components/admin/StatCard"
import AIInsightCards from "@/components/admin/AIInsightCards"
import { getDashboardStats, type DashboardStats } from "@/services/adminService"
import { getAIRecommendations, type RecommendationsData } from "@/services/adminService"
import { usePolling } from "@/hooks/usePolling"

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Poll every 30 seconds for live dashboard updates
  usePolling(
    async () => {
      const [s, reco] = await Promise.all([getDashboardStats(), getAIRecommendations()])
      return { s, reco }
    },
    ({ s, reco }) => { setStats(s); setRecommendations(reco); setLoading(false) },
    30000,
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1a1d26]">Dashboard</h1>
      </div>

      {/* AI Recommendations (3 cards) — shared with the AI Assistant page */}
      <AIInsightCards
        recommendations={recommendations}
        loading={loading}
        linkBase="/admin/ai"
        showHeaderLink
      />

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
              icon={<PhilippinePeso className="size-5" />}
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
              icon={<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="8" r="4" /></svg>}
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
