import { Info, ShieldCheck } from "lucide-react"
import type { ForecastPoint } from "@/services/adminService"

type Props = {
  data: ForecastPoint[]
  kind: "demand" | "revenue"
}

/** Plain-language quality and limitation notes for the current heuristic forecast. */
export default function ForecastQualityNote({ data, kind }: Props) {
  const actualCount = data.filter((point) => point.actual != null && Number.isFinite(point.actual)).length
  const forecastCount = data.filter((point) => Number.isFinite(point.predicted)).length
  const unit = kind === "demand" ? "months with observed occupancy" : "months with recorded revenue"

  return (
    <section
      aria-label={`${kind === "demand" ? "Demand" : "Revenue"} forecast quality information`}
      className="mt-5 rounded-[10px] border border-[#e2e4e8] bg-[#fbfaf8] p-4"
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#455d58]" aria-hidden="true" />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-foreground">Forecast quality &amp; transparency</h4>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Designed around ISO/IEC 25059 quality concepts: make the method, input coverage, and limitations visible.
            This is an implementation aid, not a claim of standards certification.
          </p>
          <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-semibold text-foreground">Method</p>
              <p className="mt-0.5 text-muted">Historical average adjusted by a fixed seasonal factor; not a trained ML model.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Observed data</p>
              <p className="mt-0.5 text-muted">{actualCount} {unit}; {forecastCount} projected points.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground">Known limitation</p>
              <p className="mt-0.5 text-muted">
                {kind === "demand"
                  ? "Occupancy currently uses booked dates, not room-by-room inventory; treat it as an estimate."
                  : "Revenue is grouped by check-in month and does not account for cancellations in this forecast."}
              </p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            No accuracy score is shown yet because this forecast has not been validated against held-out historical periods.
          </p>
        </div>
      </div>
    </section>
  )
}
