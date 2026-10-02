import { useEffect, useRef, useState } from "react"
import { motion } from "motion/react"
import { Star } from "lucide-react"
import { reviewsApi, type FeaturedReview } from "@/services/api"
import { getStoredAvatar, getGeneratedAvatar, onAvatarError } from "@/lib/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Time for one full pass across half the track — matches the old 40s CSS marquee. */
const HALF_CYCLE_MS = 40000

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= rating ? "fill-star-rating text-star-rating" : "text-hairline"}`}
        />
      ))}
    </span>
  )
}

function ReviewCard({ review, onOpen }: { review: FeaturedReview; onOpen: (r: FeaturedReview) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(review)}
      className="flex-shrink-0 w-[320px] bg-white rounded-[20px] p-xl select-none text-left cursor-pointer transition-shadow hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className="flex items-center gap-3 mb-md">
        <div className="w-11 h-11 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
          <img
            src={getStoredAvatar(review.guest_avatar) || getGeneratedAvatar(review.guest_name)}
            alt=""
            loading="lazy"
            onError={(e) => onAvatarError(e, review.guest_name)}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="typo-title-md text-ink truncate">{review.guest_name}</p>
          <p className="typo-caption-sm text-muted">{formatDate(review.created_at)}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 bg-surface-soft px-2.5 py-1 rounded-full">
          <Star className="h-3.5 w-3.5 fill-star-rating text-star-rating" />
          <span className="typo-caption-sm font-semibold text-ink">{review.rating}</span>
        </div>
      </div>
      <p className="typo-body-sm text-body leading-relaxed line-clamp-3">{review.comment}</p>
    </button>
  )
}

function SkeletonCard() {
  return (
    <div className="flex-shrink-0 w-[320px] bg-white rounded-[20px] p-xl animate-pulse">
      <div className="flex items-center gap-3 mb-md">
        <div className="w-11 h-11 rounded-full bg-surface-soft" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-surface-soft rounded w-28" />
          <div className="h-3 bg-surface-soft rounded w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-surface-soft rounded" />
        <div className="h-3 bg-surface-soft rounded" />
        <div className="h-3 bg-surface-soft rounded w-2/3" />
      </div>
    </div>
  )
}

type MarqueeRowProps = {
  reviews: FeaturedReview[]
  reverse?: boolean
  onOpen: (r: FeaturedReview) => void
}

/**
 * Horizontally scrolling row that stays interactive:
 *  - pauses while hovered / touched / focused
 *  - mouse drag scrubs the track (touch scrolls natively)
 *  - a click only opens the dialog when the pointer barely moved
 */
function MarqueeRow({ reviews, reverse = false, onOpen }: MarqueeRowProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)
  const resumeTimerRef = useRef<number | null>(null)
  const dragRef = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 })

  const items = [...reviews, ...reviews]

  useEffect(() => {
    const el = viewportRef.current
    if (!el || reviews.length < 1) return

    // Seed into the second copy so a decrementing row can wrap at 0 → half.
    if (reverse) el.scrollLeft = el.scrollWidth / 2

    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(now - last, 64)
      last = now
      const half = el.scrollWidth / 2
      if (half > 0) {
        // Normalize manual overscroll so only one duplicated segment shows.
        if (el.scrollLeft > half) el.scrollLeft -= half
        if (!pausedRef.current && !dragRef.current.active) {
          const speed = half / HALF_CYCLE_MS
          if (reverse) {
            el.scrollLeft -= speed * dt
            if (el.scrollLeft <= 0) el.scrollLeft += half
          } else {
            el.scrollLeft += speed * dt
            if (el.scrollLeft >= half) el.scrollLeft -= half
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reviews, reverse])

  const pause = () => {
    pausedRef.current = true
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
  }

  const resume = (delay = 600) => {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = window.setTimeout(() => {
      pausedRef.current = false
      resumeTimerRef.current = null
    }, delay)
  }

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current)
    }
  }, [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current.moved = 0
    dragRef.current.active = false
    if (e.pointerType !== "mouse") return // touch scrolls natively
    dragRef.current = { active: true, startX: e.clientX, startScroll: e.currentTarget.scrollLeft, moved: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
    pause()
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d.active) return
    const dx = e.clientX - d.startX
    d.moved = Math.max(d.moved, Math.abs(dx))
    e.currentTarget.scrollLeft = d.startScroll - dx
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* capture already released */
    }
    resume(400)
  }

  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved > 6) {
      // That "click" ended a drag — don't open the dialog.
      e.preventDefault()
      e.stopPropagation()
      dragRef.current.moved = 0
    }
  }

  return (
    <div
      ref={viewportRef}
      role="region"
      aria-label="Guest reviews"
      className="carousel-row overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing"
      onMouseEnter={pause}
      onMouseLeave={() => resume(0)}
      onTouchStart={pause}
      onTouchEnd={() => resume(1200)}
      onFocus={pause}
      onBlur={() => resume(0)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
    >
      <div className="flex gap-lg py-1" style={{ width: "fit-content" }}>
        {items.map((review, i) => (
          <ReviewCard key={`${review.id}-${i}`} review={review} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

export default function GuestReviews() {
  const [reviews, setReviews] = useState<FeaturedReview[]>([])
  const [summary, setSummary] = useState<{ average: number; count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState<FeaturedReview | null>(null)

  useEffect(() => {
    let cancelled = false
    reviewsApi
      .featured()
      .then((data) => {
        if (!cancelled) {
          setReviews(data.reviews || [])
          setSummary(data.summary || null)
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // API down → hide the section entirely rather than show stale mock quotes.
  if (failed) return null

  const mid = Math.ceil(reviews.length / 2)
  const row1 = reviews.slice(0, mid)
  const row2 = reviews.slice(mid)

  return (
    <section
      className="overflow-hidden py-section"
      style={{ marginLeft: "calc(-50vw + 50%)", marginRight: "calc(-50vw + 50%)" }}
    >
      <div className="max-w-container mx-auto px-base">
        <motion.div
          className="text-center mb-xl"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <div className="flex items-center justify-center gap-2 mb-sm">
            <h2 className="typo-display-lg text-ink">Guest Reviews</h2>
            <span className="inline-flex items-center gap-1 bg-surface-soft px-3 py-1 rounded-full typo-body-sm">
              <Star className="h-4 w-4 fill-star-rating text-star-rating" />
              {summary ? summary.average : "—"}
            </span>
          </div>
          <p className="typo-body-md text-muted max-w-2xl mx-auto">
            {summary
              ? `Rated ${summary.average} out of 5 by ${summary.count} guests who stayed at Hotel Ava Malate. Here's what they say about their visit.`
              : "Real reviews from guests who stayed at Hotel Ava Malate."}
          </p>
        </motion.div>
      </div>

      {loading ? (
        <div className="space-y-lg">
          <div className="overflow-hidden">
            <div className="flex gap-lg" style={{ width: "fit-content" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={`s1-${i}`} />
              ))}
            </div>
          </div>
          <div className="overflow-hidden">
            <div className="flex gap-lg" style={{ width: "fit-content" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={`s2-${i}`} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-lg">
          {row1.length > 0 && <MarqueeRow reviews={row1} onOpen={setActive} />}
          {row2.length > 0 && <MarqueeRow reviews={row2} reverse onOpen={setActive} />}
        </div>
      )}

      {/* Full review on click */}
      <Dialog open={active !== null} onOpenChange={(open) => { if (!open) setActive(null) }}>
        <DialogContent className="sm:max-w-[30rem] rounded-[16px]">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 pr-8">
                  <span className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 shrink-0">
                    <img
                      src={getStoredAvatar(active.guest_avatar) || getGeneratedAvatar(active.guest_name)}
                      alt=""
                      onError={(e) => onAvatarError(e, active.guest_name)}
                      className="w-full h-full object-cover"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block typo-title-md text-ink truncate">{active.guest_name}</span>
                    <span className="block typo-caption-sm text-muted font-normal">
                      {formatDate(active.created_at)}
                      {active.room_name ? ` · ${active.room_name}` : ""}
                    </span>
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-2 mb-3">
                <StarRating rating={active.rating} />
                <span className="typo-caption-sm font-semibold text-ink">{active.rating}.0</span>
              </div>
              <p className="typo-body-sm text-body leading-relaxed whitespace-pre-wrap">{active.comment}</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
