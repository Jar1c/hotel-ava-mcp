import { Link } from "react-router"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  /** One-line 13px gray explanation rendered directly under the label. */
  caption?: string
  /** Deep-link into the matching Reservations filter (renders a real <Link>). */
  to?: string
  className?: string
}

const cardClass =
  "rounded-[8px] bg-white border border-[#e5e7eb] p-5 text-left transition-colors " +
  "hover:border-[#82285f]/40 hover:bg-[#faf7f9] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white"

/**
 * Dashboard summary card: 13px gray label (optional caption beneath), then a
 * 24px semibold tabular number. Plain — no icons, no trend chips, no kebab.
 */
export default function StatCard({ label, value, caption, to, className }: StatCardProps) {
  const inner = (
    <>
      <p className={cn("text-[13px] text-[#6b7280]", caption ? "mb-0.5" : "mb-1.5")}>{label}</p>
      {caption && <p className="text-[13px] text-[#9ca3af] mb-1.5">{caption}</p>}
      <p className="text-[24px] font-semibold leading-tight text-[#1a1d26] tabular-nums">
        {value}
      </p>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={cn(cardClass, "block w-full", className)}>
        {inner}
      </Link>
    )
  }

  return <div className={cn(cardClass, className, "hover:bg-white hover:border-[#e5e7eb]")}>{inner}</div>
}
