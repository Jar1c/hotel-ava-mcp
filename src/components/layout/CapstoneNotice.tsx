import { TriangleAlert } from "lucide-react"

/**
 * Capstone disclaimer — only rendered on *.vercel.app (the public deploy),
 * never on localhost/local development.
 */
const ON_VERCEL =
  typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")

export default function CapstoneNotice() {
  if (!ON_VERCEL) return null

  return (
    <div className="w-full bg-[#1a1d26] px-4 py-1.5 text-center">
      <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-white/85 sm:text-xs">
        <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <span>
          <span className="font-semibold text-amber-300">Not the official Hotel Ava website.</span>{" "}
          This site is a school capstone demo only — do not make real bookings or payments here.
        </span>
      </p>
    </div>
  )
}
