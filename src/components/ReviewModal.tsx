import { useEffect, useRef, useState } from "react"
import { Star, ImagePlus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import LoadingDots from "@/components/LoadingDots"
import { reviewsApi, ApiError } from "@/services/api"
import { useToast } from "@/contexts/ToastContext"
import { MAX_REVIEW_IMAGES, REVIEW_ACCEPT, pickReviewImages } from "@/lib/images"

interface ReviewModalProps {
  open: boolean
  onClose: () => void
  bookingId: string
  roomName: string
  /** Called after a successful save so the list can refresh instantly */
  onSaved?: (rating: number) => void
  /** When set, the modal edits this review instead of creating a new one */
  editing?: {
    id: string
    rating: number
    comment: string
    /** Already-hosted photo URLs carried over from the saved review */
    images: string[]
  }
}

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"]

/** Matches REVIEW_MAX_CHARS on the backend. */
const REVIEW_MAX_CHARS = 250

export default function ReviewModal({ open, onClose, bookingId, roomName, onSaved, editing }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState("")
  const [images, setImages] = useState<File[]>([])
  /** Photos already stored on the review being edited */
  const [keptImages, setKeptImages] = useState<string[]>([])
  const [photoError, setPhotoError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const { toast } = useToast()

  const shown = hovered || rating
  const photoCount = keptImages.length + images.length

  // Object URLs for the thumbnails — revoked whenever the set changes.
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = images.map((file) => URL.createObjectURL(file))
    setPreviews(urls)
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [images])

  // Latest props, without letting parent re-renders wipe what the guest typed.
  const editingRef = useRef(editing)
  useEffect(() => { editingRef.current = editing })

  const editingId = editing?.id ?? null

  // Prefill the form when the modal opens for an existing review.
  useEffect(() => {
    if (!open) return
    const existing = editingRef.current
    setRating(existing?.rating ?? 0)
    setComment(existing?.comment ?? "")
    setKeptImages(existing?.images ?? [])
    setImages([])
    setHovered(0)
    setPhotoError("")
    setError("")
  }, [open, editingId])

  const resetForm = () => {
    setRating(0)
    setHovered(0)
    setComment("")
    setImages([])
    setKeptImages([])
    setPhotoError("")
    setError("")
  }

  const handleClose = () => {
    if (submitting) return
    resetForm()
    onClose()
  }

  const handleFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return
    // Photos kept from the saved review still count toward the 5-photo cap.
    const { files, rejected } = await pickReviewImages(images, list, keptImages.length)
    setImages(files)
    setPhotoError(rejected)
  }

  const handleSubmit = async () => {
    if (rating < 1) {
      setError("Please pick a star rating first.")
      return
    }
    const text = comment.trim()
    if (text.length > REVIEW_MAX_CHARS) {
      setError(`Please keep your review to ${REVIEW_MAX_CHARS} characters or less.`)
      return
    }
    setSubmitting(true)
    setError("")
    setPhotoError("")
    try {
      if (editing) {
        await reviewsApi.update(editing.id, {
          rating,
          comment: text,
          images,
          keepImages: keptImages,
        })
        toast({
          title: "Review updated",
          description: `Your review of ${roomName} was saved.`,
          variant: "default",
        })
      } else {
        await reviewsApi.create({
          booking_id: bookingId,
          rating,
          comment: text,
          images,
        })
        toast({
          title: "Thanks for your review!",
          description: `Your review of ${roomName} is now live.`,
          variant: "default",
        })
      }
      onSaved?.(rating)
      resetForm()
      onClose()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't save your review. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose() }}>
      {/* Focus lands on the comment box — focusing the first star instead would
          preview "1 star" and hide the saved rating when the modal opens. */}
      <DialogContent
        className="!rounded-[16px] !max-w-[460px] bg-white"
        initialFocus={commentRef}
      >
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-ink">
            {editing ? "Edit your review" : "Rate your stay"}
          </DialogTitle>
          <DialogDescription className="typo-body-sm text-muted">
            {editing ? (
              <>
                Update what you shared about{" "}
                <span className="font-semibold text-ink">{roomName}</span>.
              </>
            ) : (
              <>
                How was your stay at{" "}
                <span className="font-semibold text-ink">{roomName}</span>?
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-1">
          {/* Stars */}
          <div className="flex flex-col items-center gap-1.5 py-1">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} star${value > 1 ? "s" : ""}`}
                  onClick={() => { setRating(value); setError("") }}
                  onMouseEnter={() => setHovered(value)}
                  onMouseLeave={() => setHovered(0)}
                  onFocus={() => setHovered(value)}
                  onBlur={() => setHovered(0)}
                  className="transition-transform hover:scale-110 cursor-pointer"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      value <= shown ? "fill-star-rating text-star-rating" : "text-[#D5DADF]"
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="typo-caption-sm text-muted h-4">
              {shown > 0 ? RATING_LABELS[shown] : "Tap a star to rate"}
            </span>
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="review-comment" className="typo-caption-sm font-semibold text-ink">
              Your review <span className="font-normal text-muted">(optional, up to 250 characters)</span>
            </label>
            <textarea
              id="review-comment"
              ref={commentRef}
              value={comment}
              onChange={(e) => { setComment(e.target.value); if (error) setError("") }}
              maxLength={REVIEW_MAX_CHARS}
              rows={4}
              placeholder="Share what you loved, or what we can improve…"
              className="mt-1.5 w-full resize-none rounded-[8px] border border-hairline bg-canvas px-3 py-2.5 typo-body-sm text-ink placeholder:text-muted focus:outline-none focus:border-primary transition-colors"
            />
            <div className="flex justify-between items-center gap-3 mt-1">
              <span className="typo-caption-sm text-[#A4423A]">{error}</span>
              <span
                className={`typo-caption-sm shrink-0 tabular-nums ${
                  comment.length >= REVIEW_MAX_CHARS ? "text-[#A4423A] font-semibold" : "text-muted"
                }`}
              >
                {comment.length}/{REVIEW_MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Photos — Shopee-style, up to MAX_REVIEW_IMAGES */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoCount >= MAX_REVIEW_IMAGES}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-hairline bg-canvas px-3 py-1.5 typo-caption-sm font-semibold text-ink hover:border-primary hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ImagePlus className="h-4 w-4" />
                Add photo
              </button>
              <span
                className={`typo-caption-sm tabular-nums ${
                  photoCount >= MAX_REVIEW_IMAGES ? "text-primary font-semibold" : "text-muted"
                }`}
              >
                {photoCount}/{MAX_REVIEW_IMAGES}
              </span>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept={REVIEW_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files)
                e.target.value = ""
              }}
            />

            {photoError && <p className="typo-caption-sm text-[#A4423A] mt-1.5">{photoError}</p>}

            {photoCount > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {/* Photos already on the review being edited */}
                {keptImages.map((src, index) => (
                  <div
                    key={`kept-${src}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-hairline"
                  >
                    <img src={src} alt={`Saved photo ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setKeptImages((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-ink/70 p-0.5 text-white transition-colors hover:bg-ink cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {/* Newly picked, not uploaded yet */}
                {previews.map((src, index) => (
                  <div
                    key={src}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[6px] border border-hairline"
                  >
                    <img src={src} alt={`Review photo ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute right-0.5 top-0.5 rounded-full bg-ink/70 p-0.5 text-white transition-colors hover:bg-ink cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={submitting}
              className="text-muted hover:text-ink !rounded-[8px] text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || rating < 1}
              className="!rounded-[8px] text-sm font-semibold"
              style={{ backgroundColor: "#82285f", color: "#FBF9F4" }}
            >
              {submitting ? (
                <span className="flex items-center gap-1">
                  <LoadingDots size="sm" className="mr-1" />
                  Saving…
                </span>
              ) : (
                editing ? "Save changes" : "Submit review"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
