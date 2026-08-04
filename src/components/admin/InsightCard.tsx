import type { ReactNode } from "react"

interface InsightCardProps {
  icon: ReactNode
  label: string
  value: string
  detail: string
}

export default function InsightCard({ icon, label, value, detail }: InsightCardProps) {
  return (
    <div
      className="bg-white rounded-[6px] border border-[#e2e4e8] p-4 hover:shadow-card-hover transition-shadow duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-[6px] bg-[#f0f1f3] flex items-center justify-center text-[#82285f]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted uppercase tracking-wide font-medium">{label}</p>
          <p className="font-display text-base font-semibold text-foreground mt-0.5 truncate">{value}</p>
          <p className="text-sm text-muted mt-0.5">{detail}</p>
        </div>
      </div>
    </div>
  )
}
