import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router"
import { Star, Pencil, Trash2, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import ReviewModal from "@/components/ReviewModal"
import { reviewsApi, ApiError, type MyReview } from "@/services/api"
import { useToast } from "@/contexts/ToastContext"

const ROOM_FALLBACK =
  "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=300&fit=crop"

function formatDate(iso?: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Mirrors the server-side average for a review that was just removed locally */
function averageOf(list: MyReview[]): number {
  const given = list.map((r) => Number(r.rating) || 0).filter(Boolean)
  if (!given.length) return 0
  return Math.round((given.reduce((a, b) => a + b, 0) / given.length) * 10) / 10
}

function Stars({ value, className = "h-3.5 w-3.5" }: { value: number; className?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className={`${className} ${v <= value ? "fill-star-rating text-star-rating" : "text-[#D5DADF]"}`}
        />
      ))}
    </div>
  )
}

const actionClass =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-hairline bg-white px-3 py-1.5 typo-caption-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary"

export default function MyReviews() {
  const [reviews, setReviews] = useState<MyReview[]>([])
  const [average, setAverage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [editing, setEditing] = useState<MyReview | null>(null)
  const [deleting, setDeleting] = useState<MyReview | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setLoadError("")
      const res = await reviewsApi.mine()
      setReviews(res.reviews)
      setAverage(res.average)
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "We couldn't load your reviews. Please try again.",
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const retry = () => {
    setLoading(true)
    void load()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeletingBusy(true)
    try {
      await reviewsApi.remove(deleting.id)
      const next = reviews.filter((r) => r.id !== deleting.id)
      setReviews(next)
      setAverage(averageOf(next))
      toast({ title: "Review deleted", description: "Your review has been removed." })
      setDeleting(null)
    } catch (err) {
      toast({
        title: "Couldn't delete your review",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setDeletingBusy(false)
    }
  }

  return (
    <div className="px-base py-section">
      <div className="max-w-[720px] mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink">My Reviews</h1>
            <p className="typo-body-sm text-muted mt-1">
              {loading
                ? "Loading your reviews…"
                : reviews.length === 0
                  ? "Reviews you write after a stay show up here."
                  : `${reviews.length} review${reviews.length === 1 ? "" : "s"} · ${average} average`}
            </p>
          </div>
          {!loading && reviews.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-[10px] border border-hairline bg-white px-3 py-2">
              <Star className="h-4 w-4 fill-star-rating text-star-rating" />
              <span className="font-display text-lg font-semibold text-ink leading-none">
                {average}
              </span>
              <span className="typo-caption-sm text-muted">your average</span>
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-[12px] border border-hairline bg-white p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="h-16 w-20 rounded-[8px] bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-gray-100" />
                    <div className="h-3 w-1/4 rounded bg-gray-100" />
                    <div className="h-3 w-20 rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-[12px] border border-dashed border-hairline p-8 text-center">
            <p className="typo-body-sm font-medium text-ink">Something went wrong</p>
            <p className="typo-caption-sm text-muted mt-1">{loadError}</p>
            <Button variant="outline" onClick={retry} className="mt-4 !rounded-[8px]">
              Try again
            </Button>
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-hairline p-8 text-center">
            <Star className="h-6 w-6 mx-auto mb-3 text-[#D5DADF]" />
            <p className="typo-body-sm font-medium text-ink">No reviews yet</p>
            <p className="typo-caption-sm text-muted mt-1 max-w-sm mx-auto">
              Once a stay is finished you can rate it from My Bookings — your review helps other
              guests decide.
            </p>
            <Link to="/my-bookings" className="inline-block mt-4">
              <Button className="!rounded-[8px] text-sm font-semibold" style={{ backgroundColor: "#82285f", color: "#FBF9F4" }}>
                <CalendarDays className="mr-2 h-4 w-4" />
                Go to My Bookings
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <article key={r.id} className="rounded-[12px] border border-hairline bg-white p-4">
                {/* Room + rating */}
                <div className="flex gap-3">
                  {r.room_id ? (
                    <Link
                      to={`/rooms/${r.room_id}`}
                      className="h-16 w-20 shrink-0 overflow-hidden rounded-[8px] border border-hairline"
                    >
                      <img
                        src={r.room_image || ROOM_FALLBACK}
                        alt={r.room_name}
                        loading="lazy"
                        onError={(e) => {
                          const el = e.currentTarget
                          el.onerror = null
                          el.src = ROOM_FALLBACK
                        }}
                        className="h-full w-full object-cover"
                      />
                    </Link>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="typo-body-sm font-semibold text-ink truncate">{r.room_name}</p>
                        <p className="typo-caption-sm text-muted truncate">
                          {r.room_type}
                          {r.check_in ? ` · Stayed ${formatDate(r.check_in)}` : ""}
                        </p>
                      </div>
                      <span className="typo-caption-sm shrink-0 text-muted">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Stars value={r.rating} />
                      <span className="typo-caption-sm font-semibold text-ink">
                        {r.rating}.0
                      </span>
                    </div>
                  </div>
                </div>

                {r.comment && (
                  <p className="typo-body-sm mt-3 leading-relaxed text-body">{r.comment}</p>
                )}

                {/* Photos */}
                {r.images.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {r.images.map((src, i) => (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setLightbox({ images: r.images, index: i })}
                        className="h-16 w-16 cursor-pointer overflow-hidden rounded-[6px] border border-hairline transition-opacity hover:opacity-90"
                      >
                        <img
                          src={src}
                          alt={`Your photo ${i + 1}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* The hotel replied */}
                {r.admin_reply && (
                  <div className="mt-3 rounded-[8px] border-l-4 border-primary bg-surface-soft px-3 py-2">
                    <p className="typo-caption-sm font-semibold text-primary">
                      Hotel Ava replied
                      {r.admin_replied_at ? ` · ${formatDate(r.admin_replied_at)}` : ""}
                    </p>
                    <p className="typo-body-sm mt-0.5 whitespace-pre-line text-body">
                      {r.admin_reply}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-hairline pt-3">
                  {r.room_id && (
                    <Link
                      to={`/rooms/${r.room_id}`}
                      className={`${actionClass} ml-auto no-underline`}
                    >
                      View room
                    </Link>
                  )}
                  <button type="button" onClick={() => setEditing(r)} className={actionClass}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(r)}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] border border-[#A4423A]/40 bg-white px-3 py-1.5 typo-caption-sm font-semibold text-[#A4423A] transition-colors hover:bg-[#A4423A]/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Edit an existing review */}
      {editing && (
        <ReviewModal
          open
          onClose={() => setEditing(null)}
          bookingId={editing.booking_id || ""}
          roomName={editing.room_name}
          roomImage={editing.room_image}
          onSaved={() => void load()}
          editing={{
            id: editing.id,
            rating: editing.rating,
            comment: editing.comment,
            images: editing.images,
          }}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open && !deletingBusy) setDeleting(null) }}
        title="Delete this review?"
        description={`Your ${deleting?.rating ?? ""}-star review of ${deleting?.room_name ?? "this room"} will be removed. You can write a new one afterwards.`}
        confirmLabel="Delete review"
        loading={deletingBusy}
        onConfirm={() => void handleDelete()}
      />

      {/* Photo lightbox */}
      {lightbox && (
        <Dialog open onOpenChange={(next) => { if (!next) setLightbox(null) }}>
          <DialogContent className="!max-w-[760px] !rounded-[16px] border-hairline bg-black/90 p-0 ring-0">
            <div className="relative flex items-center justify-center p-3">
              <img
                src={lightbox.images[lightbox.index]}
                alt={`Your review photo ${lightbox.index + 1}`}
                className="max-h-[75vh] w-auto max-w-full rounded-[8px] object-contain"
              />
              {lightbox.images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() =>
                      setLightbox({
                        images: lightbox.images,
                        index:
                          (lightbox.index - 1 + lightbox.images.length) % lightbox.images.length,
                      })
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink transition-colors hover:bg-white cursor-pointer"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() =>
                      setLightbox({
                        images: lightbox.images,
                        index: (lightbox.index + 1) % lightbox.images.length,
                      })
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-ink transition-colors hover:bg-white cursor-pointer"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white">
                    {lightbox.index + 1} / {lightbox.images.length}
                  </span>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
