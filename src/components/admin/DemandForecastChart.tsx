import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { seasonalEvents } from "@/data/admin"
import type { ForecastPoint } from "@/services/adminService"

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

  const event = seasonalEvents.find((e) => e.month === label)

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
          <span className="font-medium text-foreground">{entry.value}%</span>
        </div>
      ))}
      {event && (
        <div className="mt-2 pt-2 border-t border-[#e2e4e8]">
          <p className="text-xs font-medium text-[#82285f]">
            {event.impact === "peak" ? "📈" : "📉"} {event.event}
          </p>
        </div>
      )}
    </div>
  )
}

export default function DemandForecastChart({ data, loading }: { data: ForecastPoint[]; loading?: boolean }) {
  if (loading) {
    return (
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6 animate-pulse">
        <div className="h-5 w-40 bg-[#f0f1f3] rounded mb-4" />
        <div className="h-[320px] bg-[#f0f1f3] rounded" />
      </div>
    )
  }
  return (
    <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Demand Forecast</h3>
        <p className="text-sm text-muted mt-1">Predicted occupancy with seasonal events</p>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e8" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#4A4A45" }} stroke="#e2e4e8" />
            <YAxis
              tick={{ fontSize: 12, fill: "#4A4A45" }}
              stroke="#e2e4e8"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
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
            <ReferenceLine y={80} stroke="#82285f" strokeDasharray="6 4" strokeOpacity={0.3} label={{ value: "Peak", fontSize: 10, fill: "#82285f", position: "right" }} />
            {/* Event markers as subtle dots */}
            {seasonalEvents.map((event) => {
              const point = data.find((d) => d.month === event.month)
              if (!point) return null
              return (
                <ReferenceLine
                  key={event.month}
                  x={event.month}
                  stroke={event.impact === "peak" ? "#82285f" : "#455d58"}
                  strokeDasharray="2 4"
                  strokeOpacity={0.2}
                />
              )
            })}
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#82285f"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#82285f", stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
              name="actual"
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#82285f"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={(props) => {
                const { cx, cy, payload } = props
                if (!cx || !cy || !payload) return null
                const event = seasonalEvents.find((e) => e.month === payload.month)
                if (!event) {
                  return (
                    <circle
                      key={`dot-${payload.month}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#82285f"
                      stroke="#fff"
                      strokeWidth={2}
                      opacity={0.6}
                    />
                  )
                }
                return (
                  <g key={`event-${payload.month}`}>
                    <circle cx={cx} cy={cy} r={6} fill={event.impact === "peak" ? "#82285f" : "#455d58"} stroke="#fff" strokeWidth={2} />
                    <circle cx={cx} cy={cy} r={2.5} fill="#fff" />
                  </g>
                )
              }}
              opacity={0.6}
              connectNulls
              name="predicted"
            />
          </LineChart>
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
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#82285f]" />
          Seasonal event (hover chart for details)
        </div>
      </div>
    </div>
  )
}
