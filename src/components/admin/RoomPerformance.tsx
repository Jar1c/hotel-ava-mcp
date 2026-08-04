import type { RoomPerformanceData } from "@/services/adminService"
import { formatCurrency } from "@/lib/utils"

interface RoomPerformanceProps {
  data: RoomPerformanceData[]
  loading?: boolean
}

export default function RoomPerformance({ data, loading }: RoomPerformanceProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6 animate-pulse">
        <div className="h-5 w-40 bg-[#f0f1f3] rounded mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-[#f0f1f3] rounded" />
          ))}
        </div>
      </div>
    )
  }

  const maxRevenue = Math.max(...data.map((r) => r.revenue), 1)

  return (
    <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Room Performance</h3>
        <p className="text-sm text-muted mt-1">Revenue by room type (this month)</p>
      </div>
      <div className="space-y-4">
        {data.map((room, i) => {
          const pct = (room.revenue / maxRevenue) * 100
          return (
            <div
              key={room.room}
              >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-foreground">{room.room}</span>
                <div className="flex items-center gap-3 text-sm text-muted">
                  <span>{room.occupancy}% occ.</span>
                  <span className="font-semibold text-foreground">{formatCurrency(room.revenue)}</span>
                </div>
              </div>
              <div className="h-2.5 bg-[#f0f1f3] rounded-[3px] overflow-hidden">
                <div
                  className="h-full bg-[#82285f] rounded-[3px] transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    animationDelay: `${0.8 + i * 0.1}s`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted">
                <span>{formatCurrency(room.avgPerNight)}/night avg</span>
                <span>{formatCurrency(room.revenue)} total</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
