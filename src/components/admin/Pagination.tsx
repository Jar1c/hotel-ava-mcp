import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

function pageWindow(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)

  const pages: (number | "…")[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)

  if (start > 2) pages.push("…")
  for (let p = start; p <= end; p++) pages.push(p)
  if (end < totalPages - 1) pages.push("…")
  pages.push(totalPages)
  return pages
}

export default function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className={cn("flex items-center justify-center gap-1 px-5 py-3 border-t border-[#e2e4e8]", className)}>
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Previous page"
        className="size-8 flex items-center justify-center rounded-[6px] text-[#6b7280] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f0f1f3]"
      >
        <ChevronLeft className="size-4" />
      </button>

      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="size-8 flex items-center justify-center text-[11px] text-[#9ca3af]">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            aria-current={page === p ? "page" : undefined}
            className={cn(
              "min-w-8 h-8 px-2 flex items-center justify-center rounded-[6px] text-[12px] font-semibold transition-colors cursor-pointer",
              page === p
                ? "bg-[#82285f] text-white"
                : "text-[#6b7280] hover:bg-[#f0f1f3]"
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="Next page"
        className="size-8 flex items-center justify-center rounded-[6px] text-[#6b7280] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f0f1f3]"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
