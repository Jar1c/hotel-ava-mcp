import { useState, useEffect, useMemo, type ReactNode } from "react"
import { Star, Trash2, MessageSquareText, Inbox, ChevronRight, X } from "lucide-react"
import { getDiceBearUrl } from "@/lib/dicebear"
import {
  reviewsApi,
  type AdminReviewsResponse,
  type AdminReview,
} from "@/services/api"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { Pagination } from "@/components/ui/pagination"
import { useToast } from "@/contexts/ToastContext"

const REVIEW_PAGE_SIZE = 10

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function Stars({ value, size = "h-3.5 w-3.5" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((v) => (
        <Star
          key={v}
          className={`${size} ${v <= value ? "fill-star-rating text-star-rating" : "text-[#D5DADF]"}`}
        />
      ))}
    </span>
  )
}

const ratingFilters = [
  { label: "All", value: 0 },
  { label: "5★", value: 5 },
  { label: "4★", value: 4 },
  { label: "3★", value: 3 },
  { label: "2★", value: 2 },
  { label: "1★", value: 1 },
]

type TabId = "rooms" | "reviews"

const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: "rooms", label: "Ratings by room", icon: <Star className="h-4 w-4" /> },
  { id: "reviews", label: "All reviews", icon: <MessageSquareText className="h-4 w-4" /> },
]

export default function Reviews() {
  const [data, setData] = useState<AdminReviewsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [roomFilter, setRoomFilter] = useState("")
  const [ratingFilter, setRatingFilter] = useState(0)
  const [activeTab, setActiveTab] = useState<TabId>("rooms")
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [replyTarget, setReplyTarget] = useState<AdminReview | null>(null)
  const [replyDraft, setReplyDraft] = useState("")
  const [replySaving, setReplySaving] = useState(false)
  const { toast } = useToast()

  const load = (roomId?: string) => {
    setLoading(true)
    reviewsApi
      .getAll(roomId)
      .then(setData)
      .catch(() => {
        setData(null)
        toast({
          title: "Couldn't load reviews",
          description: "Make sure migrate-add-reviews.sql has been run in Supabase.",
          variant: "error",
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changeRoom = (roomId: string) => {
    setRoomFilter(roomId)
    setPage(1)
    load(roomId || undefined)
  }

  // Click a room row → jump to that room's reviews list.
  const openRoomReviews = (roomId: string) => {
    setRatingFilter(0)
    changeRoom(roomId)
    setActiveTab("reviews")
  }

  const pickRating = (value: number) => {
    setRatingFilter(value)
    setPage(1)
  }

  const visibleReviews = useMemo(() => {
    const rows = data?.reviews ?? []
    if (!ratingFilter) return rows
    return rows.filter((r) => r.rating === ratingFilter)
  }, [data, ratingFilter])

  const pageCount = Math.max(1, Math.ceil(visibleReviews.length / REVIEW_PAGE_SIZE))
  // Clamp instead of trusting page, so shrinking lists (filter/delete) stay valid.
  const safePage = Math.min(page, pageCount)
  const pagedReviews = visibleReviews.slice(
    (safePage - 1) * REVIEW_PAGE_SIZE,
    safePage * REVIEW_PAGE_SIZE,
  )

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await reviewsApi.remove(deleteTarget.id)
      setData((prev) =>
        prev ? { ...prev, reviews: prev.reviews.filter((r) => r.id !== deleteTarget.id) } : prev,
      )
      toast({ title: "Review deleted", description: "The review was removed.", variant: "success" })
    } catch {
      toast({ title: "Delete failed", description: "Please try again.", variant: "error" })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const startReply = (review: AdminReview) => {
    setReplyTarget(review)
    setReplyDraft(review.admin_reply || "")
  }

  const saveReply = async () => {
    if (!replyTarget) return
    const text = replyDraft.trim()
    if (!text) return
    setReplySaving(true)
    try {
      const updated = await reviewsApi.reply(replyTarget.id, text)
      setData((prev) =>
        prev
          ? {
              ...prev,
              reviews: prev.reviews.map((r) =>
                r.id === updated.id
                  ? { ...r, admin_reply: updated.admin_reply, admin_replied_at: updated.admin_replied_at }
                  : r,
              ),
            }
          : prev,
      )
      toast({
        title: "Reply posted",
        description: "Your reply is now visible on the room page.",
        variant: "success",
      })
      setReplyTarget(null)
      setReplyDraft("")
    } catch (err) {
      toast({
        title: "Couldn't post the reply",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setReplySaving(false)
    }
  }

  const removeReply = async (review: AdminReview) => {
    try {
      await reviewsApi.removeReply(review.id)
      setData((prev) =>
        prev
          ? {
              ...prev,
              reviews: prev.reviews.map((r) =>
                r.id === review.id ? { ...r, admin_reply: "", admin_replied_at: null } : r,
              ),
            }
          : prev,
      )
      toast({ title: "Reply removed", variant: "success" })
    } catch (err) {
      toast({
        title: "Couldn't remove the reply",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      })
    }
  }

  const stats = data?.stats ?? []
  const totals = data?.totals ?? { reviews: 0, average: 0 }
  const ratedRooms = stats.filter((s) => s.reviews > 0)
  const activeRoomName = stats.find((s) => s.room_id === roomFilter)?.room_name ?? "this room"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Reviews</h1>
        <p className="text-sm text-muted">What guests are saying — per room and overall.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading && !data ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse" />
          ))
        ) : (
          <>
            <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-5">
              <p className="text-[12px] text-muted font-medium">Overall Rating</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-display text-2xl font-bold text-ink">
                  {totals.average || "—"}
                </span>
                <Stars value={Math.round(totals.average)} />
              </div>
            </div>
            <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-5">
              <p className="text-[12px] text-muted font-medium">Total Reviews</p>
              <p className="font-display text-2xl font-bold text-ink mt-1">{totals.reviews}</p>
            </div>
            <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-5">
              <p className="text-[12px] text-muted font-medium">Rooms With Reviews</p>
              <p className="font-display text-2xl font-bold text-ink mt-1">
                {ratedRooms.length} / {stats.length}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-[#e2e4e8]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors duration-200 cursor-pointer ${
              activeTab === t.id ? "text-[#82285f]" : "text-[#7A7A70] hover:text-[#1a1d26]"
            }`}
          >
            {t.icon}
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#82285f]" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Ratings by room ─────────────────────────────── */}
      {activeTab === "rooms" && (
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e4e8] flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display text-lg font-semibold text-foreground">Ratings by room</h3>
          <select
            value={roomFilter}
            onChange={(e) => changeRoom(e.target.value)}
            className="rounded-[5px] border border-[#e2e4e8] bg-white px-3 py-1.5 text-[13px] text-ink focus:outline-none focus:border-[#82285f]"
          >
            <option value="">All rooms</option>
            {stats.map((s) => (
              <option key={s.room_id} value={s.room_id}>
                {s.room_name}
              </option>
            ))}
          </select>
        </div>
        <div className="divide-y divide-[#e2e4e8]">
          {loading && !data ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 px-5 animate-pulse bg-[#f0f1f3]" />
            ))
          ) : stats.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No rooms found.</p>
          ) : (
            stats
              .filter((s) => !roomFilter || s.room_id === roomFilter)
              .map((s) => (
                <button
                  key={s.room_id}
                  onClick={() => openRoomReviews(s.room_id)}
                  title={`See reviews for ${s.room_name}`}
                  className="w-full px-5 py-3 flex items-center justify-between gap-4 text-left cursor-pointer transition-colors hover:bg-[#f6f2f7]"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{s.room_name}</p>
                    <p className="text-[11px] text-muted">{s.room_type}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.reviews > 0 ? (
                      <>
                        <Stars value={Math.round(s.rating ?? 0)} />
                        <span className="text-[13px] font-semibold text-ink">{s.rating}</span>
                        <span className="text-[12px] text-muted">
                          {s.reviews} {s.reviews === 1 ? "review" : "reviews"}
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-muted">No reviews yet</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-[#D5DADF]" />
                  </div>
                </button>
              ))
          )}
        </div>
      </div>
      )}

      {/* ── Tab: All reviews ─────────────────────────────────── */}
      {activeTab === "reviews" && (
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h3 className="font-display text-lg font-semibold text-foreground">
            <MessageSquareText className="inline h-4 w-4 mr-1.5 -mt-0.5" />
            All reviews
          </h3>
          <div className="flex items-center gap-1">
            {ratingFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => pickRating(f.value)}
                className={`rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
                  ratingFilter === f.value
                    ? "bg-[#82285f] text-white"
                    : "bg-white border border-[#e2e4e8] text-[#6b7280] hover:bg-[#f5f6f8]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {roomFilter && (
          <div className="mb-3 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-[#82285f]/40 bg-[#f6f2f7] px-2.5 py-1 text-[12px] font-medium text-[#82285f]">
              Only: {activeRoomName}
              <button
                onClick={() => changeRoom("")}
                title="Show all rooms"
                className="cursor-pointer opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
            <button
              onClick={() => setActiveTab("rooms")}
              className="cursor-pointer text-[12px] text-muted transition-colors hover:text-ink"
            >
              ← Back to ratings by room
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse" />
            ))}
          </div>
        ) : visibleReviews.length === 0 ? (
          <div className="bg-white rounded-[6px] border border-[#e2e4e8] py-12 text-center">
            <Inbox className="h-8 w-8 mx-auto mb-2 text-[#D5DADF]" />
            <p className="text-sm font-medium text-ink">No reviews here yet</p>
            <p className="text-[12px] text-muted mt-1">
              Reviews appear once guests finish a stay and rate it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pagedReviews.map((r) => (
              <div key={r.id} className="bg-white rounded-[6px] border border-[#e2e4e8] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <img
                        src={
                          r.guest_avatar ||
                          getDiceBearUrl("adventurer", r.guest_email || r.guest_name, 64)
                        }
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                          const el = e.currentTarget
                          el.onerror = null
                          el.src = getDiceBearUrl("adventurer", r.guest_email || r.guest_name, 64)
                        }}
                        className="h-8 w-8 shrink-0 rounded-full border border-[#e2e4e8] object-cover"
                      />
                      <span className="text-[14px] font-semibold text-ink">{r.guest_name}</span>
                      <span className="text-[12px] text-muted">{r.guest_email}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Stars value={r.rating} />
                      <span className="text-[12px] text-muted">
                        {r.room_name} · {formatDate(r.created_at)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(r)}
                    className="shrink-0 rounded-[5px] border border-[#e2e4e8] p-1.5 text-[#6b7280] hover:text-[#A4423A] hover:border-[#A4423A]/40 transition-colors cursor-pointer"
                    title="Delete review"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                {r.comment ? (
                  <p className="text-[13px] text-[#4A4A45] leading-relaxed mt-3">{r.comment}</p>
                ) : (
                  <p className="text-[13px] text-muted italic mt-3">No comment left.</p>
                )}

                {/* Guest photos — open full size in a new tab */}
                {r.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.images.map((src) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        title="Open full size"
                        className="h-16 w-16 overflow-hidden rounded-[5px] border border-[#e2e4e8]"
                      >
                        <img
                          src={src}
                          alt="Review photo"
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {/* Admin reply / feedback */}
                <div className="mt-3">
                  {replyTarget?.id === r.id ? (
                    <div className="rounded-[5px] border border-[#e2e4e8] p-3">
                      <label
                        htmlFor={`reply-${r.id}`}
                        className="text-[12px] font-semibold text-ink"
                      >
                        Your reply to {r.guest_name}{" "}
                        <span className="font-normal text-muted">
                          — shown under the review, max 500 characters
                        </span>
                      </label>
                      <textarea
                        id={`reply-${r.id}`}
                        value={replyDraft}
                        maxLength={500}
                        rows={3}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Thank the guest, or say what you'll improve…"
                        className="mt-1.5 w-full resize-none rounded-[5px] border border-[#e2e4e8] bg-white px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:border-[#82285f] focus:outline-none"
                      />
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[12px] tabular-nums text-muted">
                          {replyDraft.length}/500
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setReplyTarget(null)
                              setReplyDraft("")
                            }}
                            disabled={replySaving}
                            className="cursor-pointer rounded-[5px] border border-[#e2e4e8] px-3 py-1 text-[12px] text-muted transition-colors hover:text-ink disabled:opacity-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void saveReply()}
                            disabled={replySaving || !replyDraft.trim()}
                            className="cursor-pointer rounded-[5px] px-3 py-1 text-[12px] font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ backgroundColor: "#82285f" }}
                          >
                            {replySaving ? "Saving…" : "Post reply"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {r.admin_reply && (
                          <div className="rounded-[5px] border border-[#e2e4e8] bg-[#F7F8FA] px-3.5 py-2.5">
                            <p className="text-[12px] font-semibold text-ink">
                              Hotel Ava replied
                              {r.admin_replied_at && (
                                <span className="font-normal text-muted">
                                  {" "}· {formatDate(r.admin_replied_at)}
                                </span>
                              )}
                            </p>
                            <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[#4A4A45]">
                              {r.admin_reply}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          onClick={() => startReply(r)}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-[5px] border border-[#e2e4e8] px-2.5 py-1.5 text-[12px] text-[#6b7280] transition-colors hover:border-[#82285f]/40 hover:text-[#82285f]"
                        >
                          <MessageSquareText className="h-3.5 w-3.5" />
                          {r.admin_reply ? "Edit" : "Reply"}
                        </button>
                        {r.admin_reply && (
                          <button
                            onClick={() => void removeReply(r)}
                            className="cursor-pointer text-[12px] text-muted transition-colors hover:text-[#A4423A]"
                          >
                            Remove reply
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination
          page={safePage}
          pageCount={pageCount}
          onPageChange={setPage}
          className="mt-4"
        />
      </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Delete Review"
        description={`Remove ${deleteTarget?.guest_name}'s review of ${deleteTarget?.room_name}? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Keep Review"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
