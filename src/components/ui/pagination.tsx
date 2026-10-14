import { ChevronLeft, ChevronRight } from "lucide-react"

type PaginationProps = {
  /** 1-based current page. */
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  className?: string
}

type PageItem = number | "gap"

function buildPages(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  const wanted = new Set<number>([1, pageCount, page])
  for (let distance = 1; distance <= 2; distance += 1) {
    wanted.add(page - distance)
    wanted.add(page + distance)
  }
  const items: PageItem[] = []
  let previous = 0
  for (const p of [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)) {
    if (previous && p - previous > 1) items.push("gap")
    items.push(p)
    previous = p
  }
  return items
}

/**
 * Previous / numbered pages / Next controls for long lists (reviews).
 * Hidden when everything fits on a single page.
 */
export function Pagination({ page, pageCount, onPageChange, className = "" }: PaginationProps) {
  if (pageCount <= 1) return null

  const go = (next: number) => {
    if (next >= 1 && next <= pageCount && next !== page) onPageChange(next)
  }

  const shell =
    "inline-flex h-8 items-center justify-center rounded-[6px] border px-2.5 text-[12px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
  const step = "border-hairline bg-white text-muted hover:border-primary hover:text-primary"
  const number =
    "h-8 min-w-8 px-2 border text-[12px] font-medium rounded-[6px] transition-colors cursor-pointer"

  return (
    <nav aria-label="Reviews pagination" className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => go(page - 1)}
        disabled={page <= 1}
        className={`${shell} ${step}`}
      >
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        Previous
      </button>

      {buildPages(page, pageCount).map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-[12px] text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-current={item === page ? "page" : undefined}
            onClick={() => go(item)}
            className={`${number} ${
              item === page
                ? "border-primary bg-primary text-canvas"
                : "border-hairline bg-white text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => go(page + 1)}
        disabled={page >= pageCount}
        className={`${shell} ${step}`}
      >
        Next
        <ChevronRight className="ml-1 h-3.5 w-3.5" />
      </button>
    </nav>
  )
}

export default Pagination
