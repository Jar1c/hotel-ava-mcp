import { useState, useEffect, useMemo } from "react"
import { TrendingUp, Calendar, Star, AlertTriangle, ChevronDown, Brain, BarChart3, Tag, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import DemandForecastChart from "@/components/admin/DemandForecastChart"
import RevenueForecast from "@/components/admin/RevenueForecast"
import DemandInsight from "@/components/admin/DemandInsight"
import DiscountOffers from "@/components/admin/DiscountOffers"
import SeasonalChart from "@/components/admin/SeasonalChart"
import RoomPerformance from "@/components/admin/RoomPerformance"
import InsightCard from "@/components/admin/InsightCard"
import {
  getSeasonalData,
  getRoomPerformance,
  getInsights,
  getOccupancyForecast,
  getRevenueForecast,
  getDemandInsights,
  getDiscountOffers,
  getRooms,
  type SeasonalData,
  type RoomPerformanceData,
  type Insight,
  type ForecastPoint,
  type DemandInsightData,
  type DiscountOfferData,
} from "@/services/adminService"
import type { AdminRoom } from "@/data/admin"
import type { DiscountRoom } from "@/lib/discountEngine"

const insightIcons = [
  <Calendar key="cal" className="w-4 h-4" />,
  <Star key="star" className="w-4 h-4" />,
  <TrendingUp key="trend" className="w-4 h-4" />,
  <AlertTriangle key="warn" className="w-4 h-4" />,
]

const periodOptions = [
  { label: "Full Year 2026", value: "full" },
  { label: "Q3 2026 (Jul–Sep)", value: "q3" },
  { label: "Q4 2026 (Oct–Dec)", value: "q4" },
  { label: "Next 6 Months", value: "next6" },
]

type TabId = "forecasts" | "discounts" | "performance" | "insights"

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "forecasts", label: "Forecasts", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "discounts", label: "Discount Offers", icon: <Tag className="h-4 w-4" /> },
  { id: "performance", label: "Performance", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "insights", label: "Key Insights", icon: <Lightbulb className="h-4 w-4" /> },
]

export default function Analytics() {
  const [selectedPeriod, setSelectedPeriod] = useState("full")
  const [showInsights, setShowInsights] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("forecasts")

  const [seasonalData, setSeasonalData] = useState<SeasonalData[]>([])
  const [roomPerformance, setRoomPerformance] = useState<RoomPerformanceData[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [occForecast, setOccForecast] = useState<ForecastPoint[]>([])
  const [revForecast, setRevForecast] = useState<ForecastPoint[]>([])
  const [demandInsights, setDemandInsights] = useState<DemandInsightData[]>([])
  const [discountOffers, setDiscountOffers] = useState<DiscountOfferData[]>([])
  const [adminRooms, setAdminRooms] = useState<AdminRoom[]>([])

  useEffect(() => {
    async function load() {
      const [s, r, i, o, rv, di, do_, rooms] = await Promise.all([
        getSeasonalData(),
        getRoomPerformance(),
        getInsights(),
        getOccupancyForecast(),
        getRevenueForecast(),
        getDemandInsights(),
        getDiscountOffers(),
        getRooms(),
      ])
      setSeasonalData(s)
      setRoomPerformance(r)
      setInsights(i)
      setOccForecast(o)
      setRevForecast(rv)
      setDemandInsights(di)
      setDiscountOffers(do_)
      setAdminRooms(rooms)
      setLoading(false)
    }
    load()
  }, [])

  const visibleInsights = showInsights ? demandInsights : demandInsights.slice(0, 2)

  const discountRooms: DiscountRoom[] = useMemo(
    () => adminRooms.map((r) => ({ id: r.id, name: r.name, type: r.type, price: r.price })),
    [adminRooms]
  )

  return (
    <div className="space-y-5">
      {/* Header + Period Selector */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-muted text-sm mt-1">AI-powered demand forecasting & discount recommendations</p>
          </div>

          <div className="relative flex-shrink-0">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none bg-white border border-[#e2e4e8] rounded-[6px] px-3 py-2 pr-8 text-sm font-medium text-foreground cursor-pointer hover:border-[#82285f]/30 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#82285f]/20 focus:border-[#82285f]/40"
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#f8f7f4] border border-[#e2e4e8] rounded-[6px] px-3 py-1.5">
            <Brain className="w-3.5 h-3.5 text-[#82285f]" />
            <span className="text-xs text-muted">
              Powered by <span className="font-medium text-foreground">Statistical Projection</span>
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#3D6B4F]/8 border border-[#3D6B4F]/15 rounded-[6px] px-3 py-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-[#3D6B4F]" />
            <span className="text-xs text-muted">
              Based on <span className="font-semibold text-[#3D6B4F]">actual booking data</span>
            </span>
          </div>
        </div>
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

      {/* ── Tab: Forecasts ──────────────────────────────── */}
      {activeTab === "forecasts" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <DemandForecastChart data={occForecast} loading={loading} />
          <RevenueForecast data={revForecast} loading={loading} />
        </div>
      )}

      {/* ── Tab: Discount Offers ─────────────────────────── */}
      {activeTab === "discounts" && (
        <div className="space-y-6">
          {/* AI Discount Recommendations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#455d58]" />
                <h2 className="font-display text-lg font-semibold text-foreground">AI Discount Recommendations</h2>
              </div>
              {demandInsights.length > 2 && (
                <button
                  onClick={() => setShowInsights(!showInsights)}
                  className="text-xs font-medium text-[#455d58] hover:text-[#374d48] transition-colors duration-200"
                >
                  {showInsights ? "Show less" : `Show all ${demandInsights.length} recommendations`}
                </button>
              )}
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-40 bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse" />
                ))}
              </div>
            ) : demandInsights.length === 0 ? (
              <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-8 text-center">
                <Tag className="w-8 h-8 text-[#9ca3af] mx-auto mb-2" />
                <p className="text-sm text-muted">No discount recommendations at this time.</p>
                <p className="text-xs text-[#9ca3af] mt-1">Recommendations appear when low-demand periods are detected.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleInsights.map((insight) => (
                  <DemandInsight key={insight.id} insight={insight} />
                ))}
              </div>
            )}
          </div>

          {/* Discount Offers Table */}
          <DiscountOffers offers={discountOffers} rooms={discountRooms} loading={loading} />
        </div>
      )}

      {/* ── Tab: Performance ─────────────────────────────── */}
      {activeTab === "performance" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SeasonalChart data={seasonalData} loading={loading} />
          <RoomPerformance data={roomPerformance} loading={loading} />
        </div>
      )}

      {/* ── Tab: Key Insights ────────────────────────────── */}
      {activeTab === "insights" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse" />
            ))
          ) : (
            insights.map((insight, i) => (
              <InsightCard
                key={insight.label}
                icon={insightIcons[i]}
                label={insight.label}
                value={insight.value}
                detail={insight.detail}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
