import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { SeasonalData } from "@/services/adminService"
import { formatCurrency } from "@/lib/utils"

interface SeasonalChartProps {
  data: SeasonalData[]
  loading?: boolean
}

export default function SeasonalChart({ data, loading }: SeasonalChartProps) {
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
        <h3 className="font-display text-lg font-semibold text-foreground">Seasonal Trend</h3>
        <p className="text-sm text-muted mt-1">Monthly booking volume & revenue</p>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e8" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#4A4A45" }} stroke="#e2e4e8" />
            <YAxis tick={{ fontSize: 12, fill: "#4A4A45" }} stroke="#e2e4e8" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e4e8",
                borderRadius: "6px",
                fontSize: 13,
                fontFamily: "Lato",
              }}
              formatter={(value, name) =>
                name === "bookings" ? [value, "Bookings"] : [formatCurrency(Number(value)), "Revenue"]
              }
            />
            <Bar dataKey="bookings" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isPeak ? "#82285f" : "#e2d4de"}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-[#82285f]" />
          Peak season
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[3px] bg-[#e2d4de]" />
          Off-peak
        </div>
      </div>
    </div>
  )
}
