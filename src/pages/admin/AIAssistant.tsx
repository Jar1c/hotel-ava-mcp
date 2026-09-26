import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router"
import { TrendingUp, Tag, Brain, BarChart3, Calendar, Star, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import DemandForecastChart from "@/components/admin/DemandForecastChart"
import RevenueForecast from "@/components/admin/RevenueForecast"
import DemandInsight from "@/components/admin/DemandInsight"
import DiscountOffers from "@/components/admin/DiscountOffers"
import SeasonalChart from "@/components/admin/SeasonalChart"
import RoomPerformance from "@/components/admin/RoomPerformance"
import InsightCard from "@/components/admin/InsightCard"
import AIInsightCards from "@/components/admin/AIInsightCards"
import {
  getSeasonalData,
  getRoomPerformance,
  getInsights,
  getOccupancyForecast,
  getRevenueForecast,
  getDemandInsights,
  getDiscountOffers,
  getAIRecommendations,
  getRooms,
  type SeasonalData,
  type RoomPerformanceData,
  type Insight,
  type ForecastPoint,
  type DemandInsightData,
  type DiscountOfferData,
  type RecommendationsData,
} from "@/services/adminService"
import type { AdminRoom } from "@/data/admin"
import type { DiscountRoom } from "@/lib/discountEngine"

type TabId = "forecast" | "pricing" | "discounts" | "stats"

const TAB_IDS: TabId[] = ["forecast", "pricing", "discounts", "stats"]

const tabs: { id: TabId; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: "forecast",
    label: "Smart Forecast",
    icon: <TrendingUp className="h-4 w-4" />,
    desc: "See how full the hotel will be and expected revenue for the coming months.",
  },
  {
    id: "pricing",
    label: "Price Suggestions",
    icon: <Tag className="h-4 w-4" />,
    desc: "Discount ideas for dates when bookings are low — accept to activate, or dismiss.",
  },
  {
    id: "discounts",
    label: "Discounts",
    icon: <Brain className="h-4 w-4" />,
    desc: "Holiday promos and scheduled price cuts — approve, activate, or dismiss here.",
  },
  {
    id: "stats",
    label: "Hotel Stats",
    icon: <BarChart3 className="h-4 w-4" />,
    desc: "Seasonal trends, room performance, and key takeaways from your bookings.",
  },
]

const insightIcons = [
  <Calendar key="cal" className="w-4 h-4" />,
  <Star key="star" className="w-4 h-4" />,
  <TrendingUp key="trend" className="w-4 h-4" />,
  <AlertTriangle key="warn" className="w-4 h-4" />,
]

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse", className)} />
}

function ErrorBox({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-8 text-center">
      <p className="text-sm text-muted">Couldn't load data.</p>
      <button
        onClick={onRetry}
        className="mt-3 text-xs font-medium text-[#82285f] hover:underline cursor-pointer"
      >
        Refresh
      </button>
    </div>
  )
}

export default function AIAssistant() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get("tab")
  const activeTab: TabId = TAB_IDS.includes(tabParam as TabId) ? (tabParam as TabId) : "forecast"
  const setActiveTab = (id: TabId) => setSearchParams({ tab: id }, { replace: true })

  const active = tabs.find((t) => t.id === activeTab)!

  // ── Per-section state (loaded lazily on first tab visit) ─────────────────
  const [loaded, setLoaded] = useState<Set<TabId>>(new Set())

  const [fcLoading, setFcLoading] = useState(false)
  const [fcError, setFcError] = useState(false)
  const [occForecast, setOccForecast] = useState<ForecastPoint[]>([])
  const [revForecast, setRevForecast] = useState<ForecastPoint[]>([])
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null)

  const [pricingLoading, setPricingLoading] = useState(false)
  const [pricingError, setPricingError] = useState(false)
  const [demandInsights, setDemandInsights] = useState<DemandInsightData[]>([])

  const [discLoading, setDiscLoading] = useState(false)
  const [discError, setDiscError] = useState(false)
  const [discountOffers, setDiscountOffers] = useState<DiscountOfferData[]>([])
  const [adminRooms, setAdminRooms] = useState<AdminRoom[]>([])

  const [perfLoading, setPerfLoading] = useState(false)
  const [perfError, setPerfError] = useState(false)
  const [seasonalData, setSeasonalData] = useState<SeasonalData[]>([])
  const [roomPerformance, setRoomPerformance] = useState<RoomPerformanceData[]>([])

  const [insLoading, setInsLoading] = useState(false)
  const [insError, setInsError] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])

  const loadTab = (tab: TabId) => {
    setLoaded((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })

    if (tab === "forecast" && !loaded.has("forecast")) {
      setFcLoading(true)
      setFcError(false)
      void Promise.all([getOccupancyForecast(), getRevenueForecast(), getAIRecommendations()])
        .then(([o, rv, reco]) => {
          setOccForecast(o)
          setRevForecast(rv)
          setRecommendations(reco)
        })
        .catch(() => setFcError(true))
        .finally(() => setFcLoading(false))
    }

    if (tab === "pricing" && !loaded.has("pricing")) {
      setPricingLoading(true)
      setPricingError(false)
      void getDemandInsights()
        .then(setDemandInsights)
        .catch(() => setPricingError(true))
        .finally(() => setPricingLoading(false))
    }

    if (tab === "discounts" && !loaded.has("discounts")) {
      setDiscLoading(true)
      setDiscError(false)
      void Promise.all([getDiscountOffers(), getRooms()])
        .then(([offers, rooms]) => {
          setDiscountOffers(offers)
          setAdminRooms(rooms)
        })
        .catch(() => setDiscError(true))
        .finally(() => setDiscLoading(false))
    }

    if (tab === "stats" && !loaded.has("stats")) {
      setPerfLoading(true)
      setInsLoading(true)
      setPerfError(false)
      setInsError(false)
      void Promise.all([getSeasonalData(), getRoomPerformance()])
        .then(([s, r]) => {
          setSeasonalData(s)
          setRoomPerformance(r)
        })
        .catch(() => setPerfError(true))
        .finally(() => setPerfLoading(false))
      void getInsights()
        .then(setInsights)
        .catch(() => setInsError(true))
        .finally(() => setInsLoading(false))
    }
  }

  useEffect(() => {
    loadTab(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const discountRooms: DiscountRoom[] = useMemo(
    () => adminRooms.map((r) => ({ id: r.id, name: r.name, type: r.type, price: r.price })),
    [adminRooms]
  )

  const retryForecast = () => { setLoaded((p) => { const n = new Set(p); n.delete("forecast"); return n }); loadTab("forecast") }
  const retryPricing = () => { setLoaded((p) => { const n = new Set(p); n.delete("pricing"); return n }); loadTab("pricing") }
  const retryDiscounts = () => { setLoaded((p) => { const n = new Set(p); n.delete("discounts"); return n }); loadTab("discounts") }
  const retryStats = () => { setLoaded((p) => { const n = new Set(p); n.delete("stats"); return n }); loadTab("stats") }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted text-sm mt-1">Forecasts, price ideas, and hotel stats — in one place</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#e2e4e8] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap",
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

      {/* Active tab description — plain language */}
      <p className="text-sm text-muted -mt-1">{active.desc}</p>

      {/* ── Tab: Smart Forecast ─────────────────────────────── */}
      {activeTab === "forecast" && (
        <div className="space-y-5">
          {/* Summary strip — same shared panel as the Dashboard */}
          {fcError ? (
            <ErrorBox onRetry={retryForecast} />
          ) : (
            <AIInsightCards
              recommendations={recommendations}
              loading={fcLoading}
              linkBase="/admin/ai"
            />
          )}

          {/* Charts */}
          {fcLoading ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          ) : !fcError ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <DemandForecastChart data={occForecast} loading={false} />
              <RevenueForecast data={revForecast} loading={false} />
            </div>
          ) : null}
        </div>
      )}

      {/* ── Tab: Price Suggestions ──────────────────────────── */}
      {activeTab === "pricing" && (
        <div className="space-y-3">
          {pricingLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40" />)
          ) : pricingError ? (
            <ErrorBox onRetry={retryPricing} />
          ) : demandInsights.length === 0 ? (
            <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-8 text-center">
              <Tag className="w-8 h-8 text-[#9ca3af] mx-auto mb-2" />
              <p className="text-sm text-muted">No price suggestions right now.</p>
              <p className="text-xs text-[#9ca3af] mt-1">Suggestions appear when slow periods are detected.</p>
            </div>
          ) : (
            demandInsights.map((insight) => (
              <DemandInsight key={insight.id} insight={insight} />
            ))
          )}
        </div>
      )}

      {/* ── Tab: Discounts ──────────────────────────────────── */}
      {activeTab === "discounts" && (
        <div className="space-y-5">
          {discError ? (
            <ErrorBox onRetry={retryDiscounts} />
          ) : (
            <DiscountOffers offers={discountOffers} rooms={discountRooms} loading={discLoading} />
          )}
        </div>
      )}

      {/* ── Tab: Hotel Stats ────────────────────────────────── */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {(perfLoading || insLoading) ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          ) : perfError ? (
            <ErrorBox onRetry={retryStats} />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <SeasonalChart data={seasonalData} loading={false} />
              <RoomPerformance data={roomPerformance} loading={false} />
            </div>
          )}

          {insError ? (
            <ErrorBox onRetry={retryStats} />
          ) : insLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : insights.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {insights.map((insight, i) => (
                <InsightCard
                  key={insight.label}
                  icon={insightIcons[i]}
                  label={insight.label}
                  value={insight.value}
                  detail={insight.detail}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6 text-center">
              <p className="text-sm text-muted">No key insights yet — needs more booking data.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
