import { useNavigate } from "react-router"
import { Brain, TrendingUp, PhilippinePeso, Calendar, ArrowRight } from "lucide-react"
import type { RecommendationsData } from "@/services/adminService"

type Props = {
  recommendations: RecommendationsData | null
  loading: boolean
  /** Admin AI Assistant base path — enables card clicks + header link. */
  linkBase?: string
  showHeaderLink?: boolean
}

export default function AIInsightCards({ recommendations, loading, linkBase, showHeaderLink }: Props) {
  const navigate = useNavigate()
  const go = (tab: string) => {
    if (linkBase) navigate(`${linkBase}?tab=${tab}`)
  }

  return (
    <div className="bg-[#82285f]/5 rounded-[6px] border border-[#82285f]/20 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-[6px] bg-[#82285f]/10">
            <Brain className="w-4 h-4 text-[#82285f]" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-[#82285f]">AI-Powered Insights</h2>
            <p className="text-[11px] text-[#82285f]/70">Forecasts and discount ideas from your booking history</p>
          </div>
        </div>
        {showHeaderLink && linkBase && (
          <button
            onClick={() => go("forecast")}
            className="flex items-center gap-1 text-[12px] font-semibold text-[#82285f] hover:underline cursor-pointer"
          >
            Open AI Assistant
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/50 rounded-[8px] animate-pulse" />
          ))
        ) : (
          <>
            <div
              onClick={() => go("forecast")}
              className={`rounded-[8px] bg-white border border-[#e2e4e8] p-4 shadow-sm ${linkBase ? "cursor-pointer hover:border-[#82285f]/40 transition-colors" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <Calendar className="w-5 h-5 text-[#82285f]" />
                <span className={`text-[11px] font-bold px-2 py-1 rounded-[4px] ${
                  (recommendations?.occupancyTrend ?? "stable") === "up"
                    ? "bg-green-100 text-green-700"
                    : (recommendations?.occupancyTrend ?? "stable") === "down"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {(recommendations?.occupancyTrend ?? "stable") === "up"
                    ? "TRENDING UP"
                    : (recommendations?.occupancyTrend ?? "stable") === "down"
                    ? "TRENDING DOWN"
                    : "STEADY"}
                </span>
              </div>
              <p className="text-[13px] font-bold text-[#1a1d26] mb-1">How full we'll be</p>
              <p className="text-[12px] text-[#4a4f59]">
                {recommendations && recommendations.confidence > 0
                  ? `${recommendations.next30DaysOccupancy}% projected next 30 days`
                  : "No forecast data yet"}
              </p>
            </div>

            <div
              onClick={() => go("forecast")}
              className={`rounded-[8px] bg-white border border-[#e2e4e8] p-4 shadow-sm ${linkBase ? "cursor-pointer hover:border-[#82285f]/40 transition-colors" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <PhilippinePeso className="w-5 h-5 text-[#82285f]" />
                <span className="text-[11px] font-bold px-2 py-1 rounded-[4px] bg-[#455d58]/10 text-[#455d58]">
                  {recommendations && recommendations.revenueGrowth !== 0
                    ? `${recommendations.revenueGrowth > 0 ? "+" : ""}${recommendations.revenueGrowth}%`
                    : "—"}
                </span>
              </div>
              <p className="text-[13px] font-bold text-[#1a1d26] mb-1">Expected earnings</p>
              <p className="text-[12px] text-[#4a4f59]">
                {recommendations && recommendations.confidence > 0
                  ? `₱${recommendations.projectedRevenue.toLocaleString()} next 30 days`
                  : "No forecast data yet"}
              </p>
            </div>

            <div
              onClick={() => go("discounts")}
              className={`rounded-[8px] bg-white border border-[#e2e4e8] p-4 shadow-sm ${linkBase ? "cursor-pointer hover:border-[#82285f]/40 transition-colors" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-[#82285f]" />
                <span className="text-[11px] font-bold px-2 py-1 rounded-[4px] bg-[#82285f]/10 text-[#82285f]">
                  {recommendations?.activeDiscounts ?? 0} active
                </span>
              </div>
              <p className="text-[13px] font-bold text-[#1a1d26] mb-1">Discount ideas</p>
              <p className="text-[12px] text-[#4a4f59]">
                {recommendations?.bestDiscountPeriod ?? "No price cuts needed right now."}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
