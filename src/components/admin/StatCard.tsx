import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  icon: ReactNode
  trend?: string
  trendValue?: string
  trendUp?: boolean
  className?: string
}

export default function StatCard({ label, value, icon, trend, trendValue, trendUp, className }: StatCardProps) {
  return (
    <div className={cn("rounded-[6px] bg-white p-5 border border-[#e2e4e8] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex size-10 items-center justify-center rounded-[5px] bg-[#f5f6f8] text-[#6b7280]">
          {icon}
        </div>
        <button className="text-[#b0b3b8] hover:text-[#6b7280] transition-colors">
          <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>
      </div>
      <p className="text-[11px] font-semibold text-[#9ca3af] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[24px] font-bold text-[#1a1d26] font-display leading-tight mb-1">{value}</p>
      {(trend || trendValue) && (
        <div className="flex items-center gap-2 mt-2">
          {trendValue && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold",
              trendUp ? "bg-[#3D6B4F]/10 text-[#3D6B4F]" : "bg-[#A4423A]/10 text-[#A4423A]"
            )}>
              <svg className="size-2.5" viewBox="0 0 12 12" fill="none">
                {trendUp ? (
                  <path d="M6 2L10 7H2L6 2Z" fill="currentColor" />
                ) : (
                  <path d="M6 10L2 5H10L6 10Z" fill="currentColor" />
                )}
              </svg>
              {trendValue}
            </span>
          )}
          {trend && (
            <span className="text-[10px] text-[#9ca3af]">{trend}</span>
          )}
        </div>
      )}
    </div>
  )
}
