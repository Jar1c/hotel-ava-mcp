import { useState, useEffect } from "react"
import { Brain, Target, PhilippinePeso, Calendar, Tag, TrendingUp, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAIRecommendations, getDemandInsights, getDiscountOffers, type DemandInsightData, type DiscountOfferData, type RecommendationsData } from "@/services/adminService"
import { getDashboardStats, type DashboardStats } from "@/services/adminService"

type TabId = "overview" | "recommendations" | "discounts" | "demand"

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "recommendations", label: "AI Recommendations", icon: <Brain className="h-4 w-4" /> },
  { id: "discounts", label: "Discount Offers", icon: <Tag className="h-4 w-4" /> },
  { id: "demand", label: "Demand Insights", icon: <Lightbulb className="h-4 w-4" /> },
]

export default function AIInsights() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null)
  const [demandInsights, setDemandInsights] = useState<DemandInsightData[]>([])
  const [discountOffers, setDiscountOffers] = useState<DiscountOfferData[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    async function load() {
      const [reco, di, doff, s] = await Promise.all([
        getAIRecommendations(),
        getDemandInsights(),
        getDiscountOffers(),
        getDashboardStats(),
      ])
      setRecommendations(reco)
      setDemandInsights(di)
      setDiscountOffers(doff)
      setStats(s)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-[#1a1d26]">AI Insights</h1>
        <p className="text-[12px] text-[#7A7A70] mt-0.5">Machine learning powered recommendations &amp; forecasts</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#e2e4e8]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer",
              activeTab === tab.id ? "text-[#82285f]" : "text-[#7A7A70] hover:text-[#1a1d26]"
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#82285f]" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────── */}
      {activeTab === "overview" && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-[#e2e4e8] rounded-[8px] p-4 shadow-sm">
              <div className="flex items-center gap-2.5 mb-2">
                <Calendar className="w-5 h-5 text-[#82285f]" />
                <span className="text-[11px] font-medium text-[#7A7A70]">Next 30 Days</span>
              </div>
              <p className="text-[13px] font-bold text-[#1a1d26]">Occupancy Forecast</p>
              <p className="text-[20px] font-bold text-[#82285f] mt-1">
                {recommendations?.next30DaysOccupancy ?? 72}%
              </p>
              <p className="text-[11px] text-[#7A7A70] mt-0.5">
                Trend: {(recommendations?.occupancyTrend ?? "stable").toUpperCase()}
              </p>
            </div>

            <div className="bg-white border border-[#e2e4e8] rounded-[8px] p-4 shadow-sm">
              <div className="flex items-center gap-2.5 mb-2">
                <PhilippinePeso className="w-5 h-5 text-[#82285f]" />
                <span className="text-[11px] font-medium text-[#7A7A70]">Next 30 Days</span>
              </div>
              <p className="text-[13px] font-bold text-[#1a1d26]">Revenue Forecast</p>
              <p className="text-[20px] font-bold text-[#82285f] mt-1">
                ₱{(recommendations?.projectedRevenue ?? 450000).toLocaleString()}
              </p>
              <p className="text-[11px] text-[#7A7A70] mt-0.5">
                Growth: {(recommendations?.revenueGrowth ?? 5) > 0 ? "+" : ""}
                {recommendations?.revenueGrowth ?? 5}% vs last month
              </p>
            </div>

            <div className="bg-white border border-[#e2e4e8] rounded-[8px] p-4 shadow-sm">
              <div className="flex items-center gap-2.5 mb-2">
                <Target className="w-5 h-5 text-[#82285f]" />
                <span className="text-[11px] font-medium text-[#7A7A70]">AI Confidence</span>
              </div>
              <p className="text-[13px] font-bold text-[#1a1d26]">Recommendation Confidence</p>
              <p className="text-[20px] font-bold text-[#82285f] mt-1">
                {recommendations?.confidence ?? 85}%
              </p>
              <p className="text-[11px] text-[#7A7A70] mt-0.5">
                Based on {stats?.totalBookings ?? 0} booking records
              </p>
            </div>
          </div>

          {/* Quick Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-[#e2e4e8] rounded-[8px] p-4 shadow-sm">
              <h3 className="text-[13px] font-bold text-[#1a1d26] mb-2">Top Recommendation</h3>
              {loading ? (
                <div className="h-16 bg-[#f5f6f8] rounded-[6px] animate-pulse" />
              ) : (recommendations?.recommendations ?? [])[0] ? (
                <div>
                  <p className="text-[12px] font-semibold text-[#1a1d26]">{recommendations!.recommendations[0].title}</p>
                  <p className="text-[11px] text-[#4a4f59] mt-0.5 line-clamp-2">{recommendations!.recommendations[0].description}</p>
                </div>
              ) : (
                <p className="text-[12px] text-[#7A7A70]">No recommendations right now.</p>
              )}
            </div>

            <div className="bg-white border border-[#e2e4e8] rounded-[8px] p-4 shadow-sm">
              <h3 className="text-[13px] font-bold text-[#1a1d26] mb-2">Upcoming Demand Alert</h3>
              {loading ? (
                <div className="h-16 bg-[#f5f6f8] rounded-[6px] animate-pulse" />
              ) : demandInsights[0] ? (
                <div>
                  <p className="text-[12px] font-semibold text-[#1a1d26]">{demandInsights[0].period}</p>
                  <p className="text-[11px] text-[#4a4f59] mt-0.5 line-clamp-2">{demandInsights[0].reason}</p>
                </div>
              ) : (
                <p className="text-[12px] text-[#7A7A70]">Demand is stable.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Tab: AI Recommendations ───────────────────────── */}
      {activeTab === "recommendations" && (
        <div className="bg-[#82285f]/5 rounded-[6px] border border-[#82285f]/20 p-5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <Brain className="w-4 h-4 text-[#82285f]" />
            <h2 className="text-[14px] font-bold text-[#82285f]">AI Recommendations</h2>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-white/50 rounded-[8px] animate-pulse" />
              ))
            ) : (recommendations?.recommendations ?? []).length > 0 ? (
              (recommendations?.recommendations ?? []).map((rec, i) => (
                <div key={i} className="rounded-[8px] bg-white border border-[#e2e4e8] p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-[13px] font-bold text-[#1a1d26] mb-1">{rec.title}</p>
                      <p className="text-[12px] text-[#4a4f59] leading-relaxed">{rec.description}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-[4px] ${
                      rec.priority === "high" ? "bg-red-100 text-red-700"
                      : rec.priority === "medium" ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 bg-white/50 rounded-[8px]">
                <p className="text-[12px] text-[#7A7A70]">No specific recommendations at this time. Demand appears stable.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Discount Offers ──────────────────────────── */}
      {activeTab === "discounts" && (
        <div className="bg-white rounded-[8px] border border-[#e2e4e8] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#1a1d26]">Discount Opportunities</h2>
            <span className="text-[11px] font-medium text-[#7A7A70]">
              {discountOffers.length} offer{(discountOffers.length !== 1 ? "s" : "")} generated by AI
            </span>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 bg-[#f5f6f8] rounded-[6px] animate-pulse" />
              ))
            ) : discountOffers.length > 0 ? (
              discountOffers.map((offer) => (
                <div key={offer.id} className="border border-[#e2e4e8] rounded-[6px] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold text-[#1a1d26]">{offer.roomType}</span>
                    <span className="text-[11px] font-bold px-2 py-1 bg-[#82285f]/10 text-[#82285f] rounded-[4px]">
                      {offer.discountPercent}% off
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4a4f59] mb-2">
                    {offer.validFrom} → {offer.validTo} • Confidence: {offer.confidence}%
                  </p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span>Base: ₱{offer.baseRate.toLocaleString()}</span>
                    <span className="text-[#82285f] font-bold">Discounted: ₱{offer.discountedRate.toLocaleString()}</span>
                    <span>Projected: ₱{offer.projectedRevenue.toLocaleString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-3 bg-[#f5f6f8] rounded-[6px]">
                <p className="text-[12px] text-[#7A7A70]">No discount offers needed. Occupancy is healthy.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Demand Insights ──────────────────────────── */}
      {activeTab === "demand" && (
        <div className="bg-white rounded-[8px] border border-[#e2e4e8] p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#1a1d26]">Demand Insights</h2>
            <span className="text-[11px] font-medium text-[#7A7A70]">
              {demandInsights.length} insight{demandInsights.length !== 1 ? "s" : ""} found
            </span>
          </div>

          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 bg-[#f5f6f8] rounded-[6px] animate-pulse" />
              ))
            ) : demandInsights.length > 0 ? (
              demandInsights.map((insight) => (
                <div key={insight.id} className="border border-[#e2e4e8] rounded-[6px] p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold text-[#1a1d26]">{insight.period}</span>
                    <span className="text-[11px] font-bold px-2 py-1 bg-[#82285f]/10 text-[#82285f] rounded-[4px]">
                      {insight.discountPercent}% off
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4a4f59]">
                    {insight.reason}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-3 bg-[#f5f6f8] rounded-[6px]">
                <p className="text-[12px] text-[#7A7A70]">Demand is stable. No special insights.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
