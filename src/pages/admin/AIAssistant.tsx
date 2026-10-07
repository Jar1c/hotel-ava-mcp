import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "react-router"
import { TrendingUp, Calendar, Star, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import DemandForecastChart from "@/components/admin/DemandForecastChart"
import RevenueForecast from "@/components/admin/RevenueForecast"
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
  getDiscountOffers,
  getAIRecommendations,
  getForecastAccuracy,
  getRooms,
  type SeasonalData,
  type RoomPerformanceData,
  type Insight,
  type ForecastPoint,
  type DiscountOfferData,
  type RecommendationsData,
  type ForecastAccuracyData,
} from "@/services/adminService"
import type { AdminRoom } from "@/data/admin"
import type { DiscountRoom } from "@/lib/discountEngine"
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton"
import { useMinSkeleton } from "@/hooks/useMinSkeleton"

type TabId = "forecast" | "discounts" | "stats"

const TAB_IDS: TabId[] = ["forecast", "discounts", "stats"]

const tabs: { id: TabId; label: string; desc: string }[] = [
  {
    id: "forecast",
    label: "Smart Forecast",
    desc: "See how full the hotel will be and expected revenue for the coming months.",
  },
  {
    id: "discounts",
    label: "Discounts",
    desc: "Holiday promos and scheduled price cuts. Approve, activate, or dismiss here.",
  },
  {
    id: "stats",
    label: "Hotel Stats",
    desc: "Seasonal trends, room performance, and key takeaways from your bookings.",
  },
]

const insightIcons = [
  <Calendar key="cal" className="w-4 h-4" />,
  <Star key="star" className="w-4 h-4" />,
  <TrendingUp key="trend" className="w-4 h-4" />,
  <AlertTriangle key="warn" className="w-4 h-4" />,
]

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
  const [accuracy, setAccuracy] = useState<ForecastAccuracyData | null>(null)

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
      void Promise.all([getOccupancyForecast(), getRevenueForecast(), getAIRecommendations(), getForecastAccuracy()])
        .then(([o, rv, reco, acc]) => {
          setOccForecast(o)
          setRevForecast(rv)
          setRecommendations(reco)
          setAccuracy(acc)
        })
        .catch(() => setFcError(true))
        .finally(() => setFcLoading(false))
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
  const retryDiscounts = () => { setLoaded((p) => { const n = new Set(p); n.delete("discounts"); return n }); loadTab("discounts") }
  const retryStats = () => { setLoaded((p) => { const n = new Set(p); n.delete("stats"); return n }); loadTab("stats") }

  // Skeletons stay at least 500ms; the section then fades in as one view.
  const showFc = useMinSkeleton(fcLoading)
  const showDisc = useMinSkeleton(discLoading)
  const showStats = useMinSkeleton(perfLoading || insLoading)
  const showIns = useMinSkeleton(insLoading)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">AI Assistant</h1>
        <p className="text-muted text-sm mt-1">Forecasts, price ideas, and hotel stats in one place</p>
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
        <SkeletonRegion loading={showFc} className="space-y-5">
          {/* Summary strip — same shared panel as the Dashboard */}
          {fcError ? (
            <ErrorBox onRetry={retryForecast} />
          ) : (
            <AIInsightCards
              recommendations={recommendations}
              loading={showFc}
              linkBase="/admin/ai"
            />
          )}

          {/* Charts */}
          {showFc && !fcError ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          ) : !fcError ? (
<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
               <DemandForecastChart data={occForecast} loading={false} accuracy={accuracy} />
               <RevenueForecast data={revForecast} loading={false} accuracy={accuracy} />
             </div>
          ) : null}
        </SkeletonRegion>
      )}

      {/* ── Tab: Discounts ──────────────────────────────────── */}
      {activeTab === "discounts" && (
        <SkeletonRegion loading={showDisc} className="space-y-5">
          {discError ? (
            <ErrorBox onRetry={retryDiscounts} />
          ) : (
            <DiscountOffers offers={discountOffers} rooms={discountRooms} loading={showDisc} />
          )}
        </SkeletonRegion>
      )}

      {/* ── Tab: Hotel Stats ────────────────────────────────── */}
      {activeTab === "stats" && (
        <SkeletonRegion loading={showStats} className="space-y-6">
          {perfError ? (
            <ErrorBox onRetry={retryStats} />
          ) : showStats ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <Skeleton className="h-72" />
              <Skeleton className="h-72" />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <SeasonalChart data={seasonalData} loading={false} />
              <RoomPerformance data={roomPerformance} loading={false} />
            </div>
          )}

          {insError ? (
            <ErrorBox onRetry={retryStats} />
          ) : showIns ? (
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
              <p className="text-sm text-muted">No key insights yet. Needs more booking data.</p>
            </div>
          )}
        </SkeletonRegion>
      )}
    </div>
  )
}
