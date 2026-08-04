import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import type { MonthlyRevenue } from "@/services/adminService"

interface RevenueChartProps {
  data: MonthlyRevenue[]
  loading?: boolean
}

export default function RevenueChart({ data, loading }: RevenueChartProps) {
  if (loading) {
    return (
      <div className="rounded-[6px] bg-white p-5 border border-[#e2e4e8] animate-pulse">
        <div className="h-4 w-40 bg-[#f0f1f3] rounded mb-4" />
        <div className="h-64 bg-[#f0f1f3] rounded" />
      </div>
    )
  }

  return (
    <div className="rounded-[6px] bg-white p-5 border border-[#e2e4e8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-[#1a1d26]">Monthly Sales Performance</h3>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-[4px] bg-[#3D6B4F]/10 px-2 py-0.5 text-[10px] font-semibold text-[#3D6B4F]">
            <svg className="size-2.5" viewBox="0 0 12 12" fill="none">
              <path d="M6 2L10 7H2L6 2Z" fill="currentColor" />
            </svg>
            13.5%
          </span>
          <button className="rounded-[5px] border border-[#e2e4e8] px-2.5 py-1 text-[10px] font-medium text-[#6b7280] hover:bg-[#f5f6f8] transition-colors">
            Income ▾
          </button>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              cursor={{ fill: "rgba(130,40,95,0.04)" }}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e4e8",
                borderRadius: "5px",
                fontSize: "12px",
                fontFamily: "Lato, sans-serif",
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              }}
              formatter={(value) => [`₱${Number(value).toLocaleString()}`, "Revenue"]}
            />
            <Bar
              dataKey="revenue"
              fill="#82285f"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
