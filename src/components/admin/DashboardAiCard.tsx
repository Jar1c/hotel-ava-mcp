import { useNavigate } from "react-router"
import type { RecommendationsData } from "@/services/adminService"
import { formatCurrency } from "@/lib/utils"

type Props = {
  recommendations: RecommendationsData | null
  loading: boolean
}

/** Below this many bookings the 30-day forecast swings wildly (-99%, 1%…). */
const MIN_FORECAST_BOOKINGS = 10
/** Same idea for the forward window — history can be long but the next 30 days thin. */
const MIN_WINDOW_BOOKINGS = 5

/**
 * Dashboard's AI block: a plain white card, no banner, no badges, no ⓘ icons.
 * Forecasts hide until there is enough history; discount ideas always offer a
 * Review action (approving happens on the AI Assistant discounts tab).
 */
export default function DashboardAiCard({ recommendations, loading }: Props) {
  const navigate = useNavigate()

  if (loading || !recommendations) {
    return (
      <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-5">
        <div className="h-4 w-28 bg-[#f0f1f3] rounded animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="h-5 w-64 bg-[#f0f1f3] rounded animate-pulse" />
          <div className="h-5 w-52 bg-[#f0f1f3] rounded animate-pulse" />
        </div>
      </div>
    )
  }

  const hasForecast =
    (recommendations.bookingsAnalyzed ?? 0) >= MIN_FORECAST_BOOKINGS &&
    (recommendations.forecastBookings ?? 0) >= MIN_WINDOW_BOOKINGS

  return (
    <div className="rounded-[8px] border border-[#e5e7eb] bg-white p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-[14px] font-semibold text-[#1a1d26]">AI Insights</h2>
        <button
          type="button"
          onClick={() => navigate("/admin/ai?tab=forecast")}
          className="text-[13px] font-medium text-[#82285f] hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50"
        >
          Open AI Assistant
        </button>
      </div>

      {hasForecast ? (
        <div className="space-y-3">
          <p className="text-[14px] text-[#4a4f59]">
            <span className="text-[#1a1d26] font-medium">Occupancy forecast:</span>{" "}
            <span className="tabular-nums">{recommendations.next30DaysOccupancy}%</span> projected for the
            next 30 days
          </p>
          <p className="text-[14px] text-[#4a4f59]">
            <span className="text-[#1a1d26] font-medium">Revenue projection:</span>{" "}
            <span className="tabular-nums">{formatCurrency(recommendations.projectedRevenue)}</span>{" "}
            expected for the next 30 days
          </p>
        </div>
      ) : (recommendations.bookingsAnalyzed ?? 0) >= MIN_FORECAST_BOOKINGS ? (
        <p className="text-[14px] text-[#6b7280]">
          Not enough upcoming bookings to forecast yet ({recommendations.forecastBookings ?? 0} of{" "}
          {MIN_WINDOW_BOOKINGS}).
        </p>
      ) : (
        <p className="text-[14px] text-[#6b7280]">Not enough booking history yet.</p>
      )}

      <div className="mt-5 pt-4 border-t border-[#e5e7eb] flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[#1a1d26]">Discount ideas</p>
          <p className="text-[13px] text-[#6b7280] mt-0.5">
            {recommendations.bestDiscountPeriod ?? "No price cuts needed right now."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/admin/ai?tab=discounts")}
          className="shrink-0 rounded-[8px] bg-[#82285f] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#6d204f] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50 focus-visible:ring-offset-2"
        >
          Review
        </button>
      </div>
    </div>
  )
}
