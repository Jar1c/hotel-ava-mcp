import { Info, ShieldCheck, CheckCircle2, Clock, AlertTriangle } from "lucide-react"
import type { ForecastPoint } from "@/services/adminService"
import type { ForecastAccuracyData, ForecastAccuracyMetrics } from "@/services/api"

type Props = {
  data: ForecastPoint[]
  kind: "demand" | "revenue"
  accuracy?: ForecastAccuracyData | null
}

/** ISO/IEC 25059 data quality dimensions for analytics, mapped to forecast metrics. */
function accuracyGrade(metrics: ForecastAccuracyMetrics | null | undefined): { label: string; color: string; icon: React.ReactNode } {
  if (!metrics) return { label: "Insufficient data", color: "text-muted", icon: <Clock className="h-4 w-4" /> }
  if (metrics.sampleSize < 3) return { label: "Insufficient data", color: "text-muted", icon: <Clock className="h-4 w-4" /> }

  // Grade on accuracyPct = 100 − SMAPE; stated scale: ≥90 Excellent, ≥80 Good, ≥70 Fair.
  const pct = metrics.accuracyPct
  if (pct != null && Number.isFinite(pct)) {
    if (pct >= 90) return { label: "Excellent", color: "text-[#3D6B4F]", icon: <CheckCircle2 className="h-4 w-4" /> }
    if (pct >= 80) return { label: "Good", color: "text-[#455d58]", icon: <CheckCircle2 className="h-4 w-4" /> }
    if (pct >= 70) return { label: "Fair", color: "text-[#82285f]", icon: <AlertTriangle className="h-4 w-4" /> }
    return { label: "Needs review", color: "text-[#A4423A]", icon: <AlertTriangle className="h-4 w-4" /> }
  }

  // Fallback: MAPE scale for older cached responses without accuracyPct
  const mape = metrics.mape
  if (mape != null) {
    if (mape < 10) return { label: "Excellent", color: "text-[#3D6B4F]", icon: <CheckCircle2 className="h-4 w-4" /> }
    if (mape < 20) return { label: "Good", color: "text-[#455d58]", icon: <CheckCircle2 className="h-4 w-4" /> }
    if (mape < 30) return { label: "Fair", color: "text-[#82285f]", icon: <AlertTriangle className="h-4 w-4" /> }
  }
  return { label: "Needs review", color: "text-[#A4423A]", icon: <AlertTriangle className="h-4 w-4" /> }
}

function formatMetric(value: number | null | undefined, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toFixed(decimals)
}

export default function ForecastQualityNote({ data, kind, accuracy }: Props) {
  const actualCount = data.filter((point) => point.actual != null && Number.isFinite(point.actual)).length
  const forecastCount = data.filter((point) => Number.isFinite(point.predicted)).length
  const unit = kind === "demand" ? "months with observed occupancy" : "months with recorded revenue"

  const metrics = kind === "demand" ? accuracy?.occupancy : accuracy?.revenue
  const grade = accuracyGrade(metrics)

  return (
    <section
      aria-label={`${kind === "demand" ? "Demand" : "Revenue"} forecast quality information`}
      className="mt-5 rounded-[10px] border border-[#e2e4e8] bg-[#fbfaf8] p-4"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#455d58]" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">Forecast quality &amp; transparency</h4>
            <span className={`flex items-center gap-1 text-xs font-medium ${grade.color}`}>
              {grade.icon}
              {grade.label}
              {metrics?.accuracyPct != null && Number.isFinite(metrics.accuracyPct)
                ? ` · ${formatMetric(metrics.accuracyPct)}%`
                : ""}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            ISO/IEC 25059 data quality for analytics: accuracy, completeness, precision, credibility, and currentness.
            This is an implementation aid, not a claim of standards certification.
          </p>

          {/* ISO 25059 dimensions grid */}
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-semibold text-foreground">Accuracy</p>
              <p className="mt-0.5 text-muted">
                MAE {formatMetric(metrics?.mae)} · RMSE {formatMetric(metrics?.rmse)} · MAPE {formatMetric(metrics?.mape)}% · R² {formatMetric(metrics?.r2, 2)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted/70">
                Accuracy {formatMetric(metrics?.accuracyPct)}% (100 − SMAPE) · Bias {formatMetric(metrics?.bias)}
                {metrics?.bias != null && metrics.bias > 0 ? " (over-forecast)" : metrics?.bias != null && metrics.bias < 0 ? " (under-forecast)" : ""}
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Completeness</p>
              <p className="mt-0.5 text-muted">
                {metrics?.sampleSize ?? 0} backtested periods · {formatMetric(metrics?.coveragePct)}% coverage
              </p>
              <p className="mt-0.5 text-[11px] text-muted/70">
                {actualCount} {unit}; {forecastCount} projected points
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Precision</p>
              <p className="mt-0.5 text-muted">
                SMAPE {formatMetric(metrics?.smape)}%
              </p>
              <p className="mt-0.5 text-[11px] text-muted/70">
                Method: {accuracy?.method ?? "rolling-origin backtest, same algorithm as live forecast"}
              </p>
            </div>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            {metrics
              ? `Forecast validated against ${metrics.sampleSize} held-out periods using ${accuracy?.method ?? "the same algorithm as the live forecast"}. Accuracy ${formatMetric(metrics.accuracyPct)}% means predictions are within that margin on average${accuracy?.iso25059?.gradeScale ? ` (grade scale: ${accuracy.iso25059.gradeScale})` : ""}.`
              : "No accuracy score available yet — needs at least 2 months of historical data to backtest."}
          </p>
        </div>
      </div>
    </section>
  )
}