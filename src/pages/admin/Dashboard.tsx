import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router"
import { ChevronRight, QrCode } from "lucide-react"
import StatCard from "@/components/admin/StatCard"
import DashboardAiCard from "@/components/admin/DashboardAiCard"
import RevenueChart from "@/components/admin/RevenueChart"
import VerifyQrDialog from "@/components/admin/VerifyQrDialog"
import { Button } from "@/components/ui/button"
import { SkeletonBlock, SkeletonLine, SkeletonRegion } from "@/components/ui/skeleton"
import { useMinSkeleton } from "@/hooks/useMinSkeleton"
import {
  getAIRecommendations,
  type DashboardSummary,
  type RecommendationsData,
} from "@/services/adminService"
import { dashboardApi } from "@/services/api"
import { getStale, setCache } from "@/lib/cache"
import { cn, formatCurrency } from "@/lib/utils"

type AttentionRow = {
  label: string
  detail: string
  to: string
}

const percentDelta = new Intl.NumberFormat("en-PH", {
  style: "percent",
  signDisplay: "always",
  maximumFractionDigits: 1,
})

const cardClass = "rounded-[8px] border border-[#e5e7eb] bg-white p-5"
const sectionHeading = "text-[14px] font-semibold text-[#1a1d26] mb-4"

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [recommendations, setRecommendations] = useState<RecommendationsData | null>(null)
  const [error, setError] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const hasDataRef = useRef(false)

  const load = useCallback(async () => {
    // Paint instantly from the local cache — the network refresh replaces it
    // below (and "Updated {time}" tells the user how fresh it really is).
    if (!hasDataRef.current) {
      const staleSummary = getStale<DashboardSummary>("dash-summary-v3")
      if (staleSummary) {
        setSummary(staleSummary)
        hasDataRef.current = true
        setError(false)
      }
      const staleReco = getStale<RecommendationsData>("analytics-recommendations")
      if (staleReco) setRecommendations(staleReco)
    }

    try {
      // Direct fetch (no SWR) so "Updated {time}" reflects this poll, not a
      // cache read from up to a minute ago. The successful payload is stored
      // so the next visit can paint instantly from stale-while-revalidate.
      const s = await dashboardApi.getSummary()
      setCache("dash-summary-v3", s)
      setSummary(s)
      hasDataRef.current = true
      setError(false)
    } catch {
      // First load failed → explicit error state. A failed background refresh
      // keeps the last good numbers on screen instead of flashing an error.
      if (!hasDataRef.current) setError(true)
    }

    // AI insights load independently — never block the summary paint.
    // (The endpoint falls back to a 200 payload on its own errors.)
    getAIRecommendations()
      .then((r) => setRecommendations(r))
      .catch(() => { /* keep whatever is on screen; the next tick retries */ })
  }, [])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "hidden") void load()
    }
    void tick()
    const id = setInterval(tick, 60000)
    const onVisible = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [load, retryToken])

  const retry = () => {
    setError(false)
    setRetryToken((t) => t + 1)
  }

  // Skeletons show instantly and stay at least 500ms (anti-flicker), then
  // the sections below fade in via .content-fade.
  const showSkeleton = useMinSkeleton(!summary && !error)

  const bookingsWord = (n: number) => `${n} booking${n === 1 ? "" : "s"}`
  const attention: AttentionRow[] = summary
    ? [
        {
          label: "Unpaid",
          detail: bookingsWord(summary.pendingUnpaid),
          to: "/admin/bookings?view=unpaid",
        },
        {
          label: "Extend requests",
          detail: bookingsWord(summary.pendingExtendRequests),
          to: "/admin/bookings?view=extending",
        },
        {
          label: "Refunds to process",
          detail: `${bookingsWord(summary.pendingRefunds)}, ${formatCurrency(summary.pendingRefundsAmount ?? 0)}`,
          to: "/admin/bookings?view=refunds",
        },
      ].filter((row) => !row.detail.startsWith("0 "))
    : []

  const arrivals = summary?.arrivals ?? []
  const prevSameDays = summary?.prevMonthSameDaysRevenue ?? 0
  const showDelta = prevSameDays > 0
  const delta = showDelta ? ((summary!.monthToDateRevenue ?? 0) - prevSameDays) / prevSameDays : 0
  const hasArrivals = arrivals.length > 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header — scan booking first, then month range + last-updated */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-[16px] font-semibold text-ink">Dashboard</h1>
          <Button
            type="button"
            variant="outline"
            onClick={() => setVerifyOpen(true)}
            className="!rounded-[8px] gap-2"
          >
            <QrCode className="h-4 w-4" />
            Scan booking
          </Button>
        </div>
        <div className="flex items-baseline gap-3">
          {summary?.periodLabel && (
            <p className="text-[13px] text-[#6b7280] tabular-nums">{summary.periodLabel}</p>
          )}
          {summary?.updatedAt && (
            <p className="text-[13px] text-[#9ca3af] tabular-nums">
              Updated {summary.updatedAt}
            </p>
          )}
        </div>
      </div>

      {error && !summary ? (
        <div className={`${cardClass} p-8 text-center`}>
          <p className="text-[14px] font-medium text-[#1a1d26]">Couldn't load summary</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 cursor-pointer rounded-[8px] border border-[#82285f] px-4 py-2 text-[13px] font-semibold text-[#82285f] transition-colors hover:bg-[#82285f]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        </div>
      ) : (
        <SkeletonRegion loading={showSkeleton} className="flex flex-col gap-6">
          {/* Operations — full-width arrivals primary, then a row of three */}
          <section>
            <h2 className={sectionHeading}>Operations</h2>
            {showSkeleton ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Arrivals card — same chrome as the real card, with
                    suggested label, count, and three arrival rows. */}
                <div className="flex min-h-[290px] flex-col rounded-[8px] border border-[#e5e7eb] bg-white p-5 md:col-span-2">
                  <SkeletonLine className="h-3.5 w-24" />
                  <SkeletonLine className="mt-1.5 h-3.5 w-32" />
                  <SkeletonLine className="mt-1.5 h-8 w-16" />
                  <div className="mt-4 min-h-0 flex-1 space-y-3.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <div className="space-y-1.5">
                          <SkeletonLine className="h-4 w-36" />
                          <SkeletonLine className="h-3 w-44" />
                        </div>
                        <SkeletonLine className="h-3.5 w-14" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-4">
                  <SkeletonBlock className="min-h-[86px] flex-1" />
                  <SkeletonBlock className="min-h-[86px] flex-1" />
                  <SkeletonBlock className="min-h-[86px] flex-1" />
                </div>
              </div>
            ) : (
              summary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 content-fade">
                  {/* Primary: arrivals — left, tall, 2px maroon left edge.
                      The whole card IS the link (content sat above the old
                      overlay link and swallowed every click). */}
                  <Link
                    to="/admin/bookings?view=arrivals"
                    aria-label="Open arrivals in Reservations"
                    style={{ borderLeft: "2px solid #82285f" }}
                    className="group flex flex-col rounded-[8px] border border-[#e5e7eb] bg-white p-5 transition-colors hover:border-[#82285f]/40 hover:bg-[#faf7f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50 focus-visible:ring-offset-2 md:col-span-2"
                  >
                    <div className="flex flex-col min-h-0 flex-1">
                      <p className="text-[13px] text-[#6b7280]">Arrivals today</p>
                      <p className="text-[13px] text-[#9ca3af] mb-1.5">Due to check in today</p>
                      <p className="text-[32px] font-semibold leading-none text-[#1a1d26] tabular-nums">
                        {summary.arrivalsToday}
                      </p>
                      {hasArrivals ? (
                        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
                          <ul className="divide-y divide-[#f0f1f3]">
                            {arrivals.map((a) => (
                              <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0">
                                  <p className="truncate text-[14px] font-medium text-[#1a1d26]">
                                    {a.guestName}
                                  </p>
                                  <p className="truncate text-[13px] text-[#6b7280]">
                                    {a.roomName} · {a.time}
                                    {a.late && (
                                      <span className="ml-1.5 inline-flex items-center rounded-[4px] border border-[#e5e7eb] bg-[#f5f6f8] px-1.5 py-px text-[11px] font-medium text-[#6b7280]">
                                        Late
                                      </span>
                                    )}
                                  </p>
                                </div>
                                {/* Same destination as the card link — a span
                                    avoids nesting <a> in <a> (invalid HTML). */}
                                <span className="shrink-0 text-[13px] font-medium text-[#82285f] group-hover:underline">
                                  Check-in
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <p className="mt-3 text-[14px] text-[#6b7280]">No arrivals today.</p>
                      )}
                    </div>
                  </Link>

                  {/* Right column: three stacked secondaries.
                      Unpaid + Extend requests replace Departures/Overdue —
                      booking-ops signals, both already in DashboardSummary. */}
                  <div className="flex flex-col gap-4">
                    <StatCard
                      label="Unpaid"
                      caption="Awaiting payment"
                      value={summary.pendingUnpaid}
                      to="/admin/bookings?view=unpaid"
                      className="min-h-[86px] flex-1"
                    />
                    <StatCard
                      label="In-house"
                      caption="Currently checked in"
                      value={summary.inHouse}
                      to="/admin/bookings?status=in-house"
                      className="min-h-[86px] flex-1"
                    />
                    <StatCard
                      label="Extend requests"
                      caption="Pending stay extensions"
                      value={summary.pendingExtendRequests}
                      to="/admin/bookings?view=extending"
                      className="min-h-[86px] flex-1"
                    />
                  </div>
                </div>
              )
            )}
          </section>

          {/* Needs attention */}
          <section>
            <h2 className={sectionHeading}>Needs attention</h2>
            {showSkeleton ? (
              <div className="rounded-[8px] border border-[#e5e7eb] bg-white">
                <div className="flex items-center justify-between px-5 py-4">
                  <SkeletonLine className="h-4 w-28" />
                  <SkeletonLine className="h-3 w-16" />
                </div>
              </div>
            ) : attention.length > 0 ? (
              <div className="content-fade rounded-[8px] border border-[#e5e7eb] bg-white divide-y divide-[#e5e7eb]">
                {attention.map((row) => (
                  <Link
                    key={row.label}
                    to={row.to}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f5f6f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#82285f]/50"
                  >
                    <span className="text-[14px] text-[#1a1d26]">{row.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] text-[#6b7280] tabular-nums">{row.detail}</span>
                      <ChevronRight className="size-4 text-[#9ca3af]" />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="content-fade rounded-[8px] border border-[#e5e7eb] bg-white px-5 py-6">
                <p className="text-[14px] text-[#6b7280]">Nothing needs attention.</p>
              </div>
            )}
          </section>

          {/* Performance — revenue + occupancy + chart (uniform card heights) */}
          <section>
            <h2 className={sectionHeading}>Performance</h2>
            {showSkeleton ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SkeletonBlock className="h-[132px]" />
                <SkeletonBlock className="h-[132px]" />
                <SkeletonBlock className="h-[271px] md:col-span-2" />
              </div>
            ) : (
              summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 content-fade">
                  <div className={cardClass}>
                    <p className="text-[13px] text-[#6b7280]">Monthly revenue</p>
                    <p className="text-[13px] text-[#9ca3af] mb-1.5">Paid bookings by stay date</p>
                    <p className="text-[24px] font-semibold leading-tight text-[#1a1d26] tabular-nums">
                      {formatCurrency(summary.monthlyRevenue)}
                    </p>
                    {showDelta && (
                      <p
                        className={cn(
                          "mt-2 text-[13px] font-medium tabular-nums",
                          delta >= 0 ? "text-[#82285f]" : "text-[#6b7280]",
                        )}
                      >
                        {percentDelta.format(delta)} vs same days last month
                      </p>
                    )}
                  </div>

                  <div className={cardClass}>
                    <p className="text-[13px] text-[#6b7280]">Occupancy rate</p>
                    <p className="text-[13px] text-[#9ca3af] mb-1.5">In-house rooms / active rooms</p>
                    <p className="text-[24px] font-semibold leading-tight text-[#1a1d26] tabular-nums">
                      {summary.occupancyRate}%
                    </p>
                    {typeof summary.totalRooms === "number" && (
                      <p className="mt-2 text-[13px] text-[#6b7280] tabular-nums">
                        {summary.inHouse} of {summary.totalRooms} rooms
                      </p>
                    )}
                  </div>

                  <div className={`${cardClass} md:col-span-2`}>
                    <RevenueChart points={summary.revenueSeries} />
                  </div>
                </div>
              )
            )}
          </section>

          {/* AI Insights — bottom, plain card */}
          <DashboardAiCard recommendations={recommendations} loading={showSkeleton} />
        </SkeletonRegion>
      )}

      {/* Scan a guest's check-in QR without leaving the dashboard — closing the
          dialog re-reads the summary so arrivals/in-house reflect the stamp. */}
      <VerifyQrDialog
        open={verifyOpen}
        onOpenChange={(open) => {
          setVerifyOpen(open)
          if (!open) void load()
        }}
      />
    </div>
  )
}
