import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import type { OccupancyData } from "@/services/adminService"

interface OccupancyChartProps {
  data: OccupancyData[]
  loading?: boolean
}

export default function OccupancyChart({ data, loading }: OccupancyChartProps) {
  if (loading) {
    return (
      <div className="rounded-[6px] bg-white p-5 border border-[#e2e4e8] animate-pulse">
        <div className="h-4 w-32 bg-[#f0f1f3] rounded mb-4" />
        <div className="h-64 bg-[#f0f1f3] rounded" />
      </div>
    )
  }
  return (
    <div className="rounded-[6px] bg-white p-5 border border-[#e2e4e8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-[#1a1d26]">Occupancy Rate</h3>
        <button className="text-[#b0b3b8] hover:text-[#6b7280] transition-colors">
          <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="occupancyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#82285f" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#82285f" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "Lato, sans-serif" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#9ca3af", fontFamily: "Lato, sans-serif" }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e4e8",
                borderRadius: "5px",
                fontSize: "12px",
                fontFamily: "Lato, sans-serif",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              formatter={(value) => [`${value}%`, "Occupancy"]}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#82285f"
              strokeWidth={2}
              fill="url(#occupancyGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
