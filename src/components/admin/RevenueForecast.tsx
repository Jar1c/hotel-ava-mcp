import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import type { ForecastPoint } from "@/services/adminService"
import { formatCurrency } from "@/lib/utils"

interface TooltipPayloadEntry {
  name: string
  value: number
  dataKey: string
  color: string
  payload: {
    month: string
    actual: number | null
    predicted: number
  }
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadEntry[]; label?: string }) {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-white border border-[#e2e4e8] rounded-[6px] px-4 py-3 shadow-lg" style={{ fontFamily: "Lato" }}>
      <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted">{entry.name === "actual" ? "Actual" : "Predicted"}:</span>
          <span className="font-medium text-foreground">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenueForecast({ data, loading }: { data: ForecastPoint[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6 animate-pulse">
        <div className="h-5 w-36 bg-[#f0f1f3] rounded mb-4" />
        <div className="h-[320px] bg-[#f0f1f3] rounded" />
      </div>
    )
  }
  return (
    <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Revenue Forecast</h3>
        <p className="text-sm text-muted mt-1">Actual vs predicted monthly revenue (₱)</p>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#82285f" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#82285f" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="revenuePredicted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#82285f" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#82285f" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e8" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#4A4A45" }} stroke="#e2e4e8" />
            <YAxis
              tick={{ fontSize: 12, fill: "#4A4A45" }}
              stroke="#e2e4e8"
              tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: "Lato" }}
              formatter={(value) => (value === "actual" ? "Actual" : "Predicted")}
            />
            <ReferenceLine
              x="Jun"
              stroke="#82285f"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{
                value: "Today",
                position: "insideTopRight",
                fontSize: 11,
                fill: "#82285f",
                fontWeight: 600,
              }}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#82285f"
              strokeWidth={2.5}
              fill="url(#revenueActual)"
              dot={{ r: 4, fill: "#82285f", stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
              name="actual"
            />
            <Area
              type="monotone"
              dataKey="predicted"
              stroke="#82285f"
              strokeWidth={2}
              strokeDasharray="6 4"
              fill="url(#revenuePredicted)"
              dot={{ r: 3, fill: "#82285f", stroke: "#fff", strokeWidth: 2, opacity: 0.6 }}
              opacity={0.6}
              connectNulls
              name="predicted"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#82285f]" />
          Solid = Actual
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[#82285f] opacity-60" style={{ borderTop: "2px dashed #82285f" }} />
          Dashed = Predicted
        </div>
      </div>
    </div>
  )
}
