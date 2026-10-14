import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react"
import { useNavigate } from "react-router"
import type { RecommendationsData, Insight } from "@/services/api"
import { SkeletonLine } from "@/components/ui/skeleton"
import { cn, formatCurrency } from "@/lib/utils"

type Props = {
  recommendations: RecommendationsData | null
  insights: Insight[]
  loading: boolean
}

/** Below this many upcoming bookings the forecast is thin — noted, not hidden. */
const MIN_WINDOW_BOOKINGS = 5
const SLIDE_MS = 5000
/** Horizontal travel (px) with the mouse held down that flips one slide. */
const DRAG_PX = 90
const DRAG_COOLDOWN_MS = 400

const SLIDES = [
  { title: "Smart Forecast", to: "/admin/ai?tab=forecast" },
  { title: "AI Discount Ideas", to: "/admin/ai?tab=discounts" },
  { title: "Hotel Stats", to: "/admin/ai?tab=stats" },
] as const

/**
 * Performance-row AI card: one slot that auto-rotates through the smart
 * forecast, discount ideas, and hotel stats — dot indicators jump to a slide.
 * Rotation pauses on hover; press-and-drag moves between slides (drag left =
 * next, drag right = back). Slides cross-fade with an ease-in-out shift: the
 * outgoing one leaves while the incoming one arrives, never an instant swap.
 */
export default function DashboardInsightsRotator({ recommendations, insights, loading }: Props) {
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const dragFrom = useRef<number | null>(null)
  const dragLock = useRef(0)

  const advance = useCallback((delta: number) => {
    setSlide((s) => (s + delta + SLIDES.length) % SLIDES.length)
  }, [])

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => advance(1), SLIDE_MS)
    return () => clearInterval(id)
  }, [paused, advance])

  const onDragStart = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragFrom.current = e.clientX
  }

  const onDragMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (dragFrom.current === null) return
    const now = Date.now()
    if (now < dragLock.current) return
    const dx = e.clientX - dragFrom.current
    if (Math.abs(dx) >= DRAG_PX) {
      advance(dx < 0 ? 1 : -1)
      dragLock.current = now + DRAG_COOLDOWN_MS
      dragFrom.current = e.clientX
    }
  }

  const onDragEnd = () => {
    dragFrom.current = null
  }

  if (loading || !recommendations) {
    return (
      <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-5 md:col-span-2">
        <SkeletonLine className="mb-4 h-4 w-40" />
        <div className="space-y-3">
          <SkeletonLine className="h-5 w-64" />
          <SkeletonLine className="h-5 w-52" />
        </div>
      </div>
    )
  }

  const hasForecast = recommendations.confidence > 0
  const thinForecast = hasForecast &&
    (recommendations.forecastBookings ?? 0) < MIN_WINDOW_BOOKINGS

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false)
        onDragEnd()
      }}
      onMouseDown={onDragStart}
      onMouseMove={onDragMove}
      onMouseUp={onDragEnd}
      className="flex select-none flex-col rounded-[8px] border border-[#e5e7eb] bg-white p-5 md:col-span-2"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="text-[14px] font-semibold text-[#1a1d26]">AI Insights</h2>
          <span className="truncate text-[13px] text-[#9ca3af]">{SLIDES[slide].title}</span>
        </div>
        <button
          type="button"
          onClick={() => navigate(SLIDES[slide].to)}
          className="shrink-0 cursor-pointer rounded text-[13px] font-medium text-[#82285f] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50"
        >
          Open AI Assistant
        </button>
      </div>

      <div className="relative min-h-[164px] flex-1">
        {SLIDES.map((_, i) => {
          const active = i === slide
          const rel = ((i - slide) + SLIDES.length) % SLIDES.length
          const x = active ? 0 : rel === 1 ? 16 : -16
          return (
            <div
              key={i}
              aria-hidden={!active}
              className={cn(
                "absolute inset-0 transition-[opacity,transform] duration-[380ms] ease-in-out",
                active ? "opacity-100" : "pointer-events-none opacity-0",
              )}
              style={{ transform: `translateX(${x}px)` }}
            >
              {i === 0 &&
                (hasForecast ? (
                  <div className="space-y-3">
                    <p className="text-[14px] text-[#4a4f59]">
                      <span className="font-medium text-[#1a1d26]">Occupancy forecast:</span>{" "}
                      <span className="tabular-nums">{recommendations.next30DaysOccupancy}%</span>{" "}
                      projected for the next 30 days
                    </p>
                    <p className="text-[14px] text-[#4a4f59]">
                      <span className="font-medium text-[#1a1d26]">Revenue projection:</span>{" "}
                      <span className="tabular-nums">{formatCurrency(recommendations.projectedRevenue)}</span>{" "}
                      expected for the next 30 days
                    </p>
                    {thinForecast && (
                      <p className="text-[13px] text-[#9ca3af]">
                        Low confidence — based on {recommendations.forecastBookings} upcoming booking
                        {(recommendations.forecastBookings ?? 0) === 1 ? "" : "s"} (needs {MIN_WINDOW_BOOKINGS}).
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[14px] text-[#6b7280]">No forecast data yet.</p>
                ))}

              {i === 1 && (
                <div className="flex h-full items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#1a1d26]">Discount ideas</p>
                    <p className="mt-0.5 text-[13px] text-[#6b7280]">
                      {recommendations.bestDiscountPeriod ?? "No price cuts needed right now."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/admin/ai?tab=discounts")}
                    className="shrink-0 cursor-pointer rounded-[8px] bg-[#82285f] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#6d204f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50 focus-visible:ring-offset-2"
                  >
                    Review
                  </button>
                </div>
              )}

              {i === 2 &&
                (insights.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {insights.slice(0, 4).map((ins) => (
                      <button
                        key={ins.label}
                        type="button"
                        onClick={() => navigate("/admin/ai?tab=stats")}
                        className="cursor-pointer rounded-[6px] p-2 text-left transition-colors hover:bg-[#f5f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50"
                      >
                        <p className="truncate text-[12px] text-[#6b7280]">{ins.label}</p>
                        <p className="truncate text-[17px] font-semibold tabular-nums text-[#1a1d26]">
                          {ins.value}
                        </p>
                        {ins.detail && <p className="truncate text-[12px] text-[#9ca3af]">{ins.detail}</p>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[14px] text-[#6b7280]">No key insights yet. Needs more booking data.</p>
                ))}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            type="button"
            aria-label={`Show ${s.title}`}
            onClick={() => setSlide(i)}
            className={cn(
              "h-1.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50",
              i === slide ? "w-5 bg-[#82285f]" : "w-1.5 bg-[#d5dadf] hover:bg-[#9ca3af]",
            )}
          />
        ))}
      </div>
    </div>
  )
}
