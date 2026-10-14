import { useLayoutEffect, useRef } from "react"
import { TriangleAlert } from "lucide-react"

/**
 * Capstone disclaimer — only rendered on *.vercel.app (the public deploy),
 * never on localhost/local development.
 *
 * Rendered as a fixed top bar so it stays visible on every page and at every
 * scroll position. Its measured height is published as the `--capstone-h`
 * CSS variable so the sticky header (and the admin shell) can offset
 * themselves below it; an invisible spacer keeps content from hiding under
 * the bar.
 */
const ON_VERCEL =
  typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")

export default function CapstoneNotice() {
  const barRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const root = document.documentElement
    const setHeight = () =>
      root.style.setProperty("--capstone-h", `${el.offsetHeight}px`)
    setHeight()
    const observer = new ResizeObserver(setHeight)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.removeProperty("--capstone-h")
    }
  }, [])

  if (!ON_VERCEL) return null

  return (
    <>
      <div
        ref={barRef}
        className="fixed top-0 left-0 right-0 z-[120] w-full bg-[#1a1d26] px-4 py-1.5 text-center"
      >
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-white/85 sm:text-xs">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>
            <span className="font-semibold text-amber-300">Not the official Hotel Ava website.</span>{" "}
            This site is a school capstone demo only — do not make real bookings or payments here.
          </span>
        </p>
      </div>
      <div aria-hidden className="h-[var(--capstone-h,0px)]" />
    </>
  )
}
