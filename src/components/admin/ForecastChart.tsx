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
import { revenueForecast } from "@/data/admin"
import { formatCurrency } from "@/lib/utils"

export default function ForecastChart() {
  return (
    <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Revenue Forecast</h3>
        <p className="text-sm text-muted mt-1">Actual vs predicted revenue (₱)</p>
      </div>
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={revenueForecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e4e8" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#4A4A45" }} stroke="#e2e4e8" />
            <YAxis
              tick={{ fontSize: 12, fill: "#4A4A45" }}
              stroke="#e2e4e8"
              tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}K`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e4e8",
                borderRadius: "6px",
                fontSize: 13,
                fontFamily: "Lato",
              }}
              formatter={(value) => [formatCurrency(Number(value)), ""]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: "Lato" }}
              formatter={(value) => (value === "actual" ? "Actual" : "Predicted")}
            />
            <ReferenceLine x="Jun" stroke="#DCD5C4" strokeDasharray="3 3" label={{ value: "Today", fontSize: 11, fill: "#7A7A70" }} />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#82285f"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "#82285f", stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="predicted"
              stroke="#82285f"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 3, fill: "#82285f", stroke: "#fff", strokeWidth: 2, opacity: 0.6 }}
              opacity={0.6}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
