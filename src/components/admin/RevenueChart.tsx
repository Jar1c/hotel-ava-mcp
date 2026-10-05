import { useRef, useState } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import type { RevenuePoint } from "@/services/api"

const compactPeso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
})

const dayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "Asia/Manila",
})

const W = 600
const H = 160
const PAD_Y = 10

/** Evenly spaced unique indices for the x-axis — up to `count` labels. */
function axisIndices(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i)
  const step = (length - 1) / (count - 1)
  return [...new Set(Array.from({ length: count }, (_, i) => Math.round(i * step)))]
}

/**
 * Paid-revenue line: one 1.5px maroon line over gray gridlines, hover tooltip
 * (date + peso amount), 7d/30d segmented toggle. Empty window → "No revenue yet."
 */
export default function RevenueChart({ points }: { points?: RevenuePoint[] }) {
  const [range, setRange] = useState<7 | 30>(30)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgWrapRef = useRef<HTMLDivElement>(null)

  const all = points ?? []
  const data = all.slice(-range)
  const total = data.reduce((sum, p) => sum + p.amount, 0)
  const max = Math.max(0, ...data.map((p) => p.amount))

  const yFor = (v: number) => PAD_Y + (1 - (max > 0 ? v / max : 0)) * (H - 2 * PAD_Y)
  const xFor = (i: number) => (data.length > 1 ? (i / (data.length - 1)) * W : W / 2)
  const lineCoords = data
    .map((p, i) => `${xFor(i).toFixed(1)},${yFor(p.amount).toFixed(1)}`)
    .join(" ")

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const wrap = svgWrapRef.current
    if (!wrap || !data.length) return
    const rect = wrap.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    setHoverIdx(Math.round(ratio * (data.length - 1)))
  }

  const xTicks = axisIndices(data.length, data.length > 10 ? 5 : data.length)
  const hover = hoverIdx !== null ? data[hoverIdx] : null
  const hoverLeftPct = hoverIdx !== null && data.length > 1
    ? (hoverIdx / (data.length - 1)) * 100
    : 50

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-[#1a1d26]">Paid revenue</p>
        <div
          role="group"
          aria-label="Chart range"
          className="flex items-center rounded-[6px] border border-[#e5e7eb] p-0.5"
        >
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "cursor-pointer rounded-[5px] px-2.5 py-1 text-[13px] font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50",
                range === r
                  ? "bg-[#82285f] font-semibold text-white"
                  : "text-[#6b7280] hover:text-[#1a1d26]",
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {total <= 0 || !data.length ? (
        <p className="py-12 text-center text-[14px] text-[#6b7280]">No revenue yet.</p>
      ) : (
        <div>
          <div className="relative flex gap-2">
            <div
              className="flex w-14 shrink-0 flex-col justify-between text-right text-[13px] text-[#9ca3af] tabular-nums"
              style={{ height: H }}
            >
              <span>{compactPeso.format(max)}</span>
              <span>{compactPeso.format(max / 2)}</span>
              <span>{compactPeso.format(0)}</span>
            </div>
            <div
              ref={svgWrapRef}
              className="relative flex-1"
              onMouseMove={onMove}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="h-[160px] w-full"
                aria-hidden="true"
              >
                {[0, 0.5, 1].map((f) => {
                  const y = PAD_Y + f * (H - 2 * PAD_Y)
                  return (
                    <line
                      key={f}
                      x1={0}
                      x2={W}
                      y1={y}
                      y2={y}
                      stroke="#e5e7eb"
                      strokeWidth={1}
                      vectorEffect="non-scaling-stroke"
                    />
                  )
                })}
                <polyline
                  points={lineCoords}
                  fill="none"
                  stroke="#82285f"
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              {/* Hover crosshair + tooltip (date + Intl peso amount) */}
              {hover && (
                <>
                  <span
                    className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#82285f]/30"
                    style={{ left: `${hoverLeftPct}%` }}
                  />
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[6px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 shadow-sm"
                    style={{ left: `${hoverLeftPct}%`, top: yFor(hover.amount) - 6 }}
                  >
                    <p className="whitespace-nowrap text-[13px] font-medium text-[#1a1d26] tabular-nums">
                      {formatCurrency(hover.amount)}
                    </p>
                    <p className="whitespace-nowrap text-[13px] text-[#9ca3af] tabular-nums">
                      {dayLabel.format(new Date(hover.date))}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between pl-16 text-[13px] text-[#9ca3af] tabular-nums">
            {xTicks.map((i) => (
              <span key={i}>{dayLabel.format(new Date(data[i].date))}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}