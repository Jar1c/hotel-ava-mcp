import { useState, useEffect, useMemo, useCallback } from "react"
import { Check, Tag } from "lucide-react"
import { cn } from "@/lib/utils"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { useToast } from "@/contexts/ToastContext"
import { ApiError } from "@/services/api"
import type { DiscountSuggestion } from "@/services/adminService"
import {
  getDiscountSuggestions,
  applyDiscountSuggestion,
} from "@/services/adminService"
import { Skeleton } from "@/components/ui/skeleton"

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })

const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const errorMessage = (err: unknown) =>
  err instanceof ApiError && err.message ? err.message : "Couldn't save. Try again."

interface DiscountOffersProps {
  offers?: unknown[]
  rooms?: unknown[]
  loading?: boolean
}

export default function DiscountOffers({ loading }: DiscountOffersProps) {
  const [suggestions, setSuggestions] = useState<DiscountSuggestion[]>([])
  const [ready, setReady] = useState(false)

  const [dialog, setDialog] = useState<{ kind: "approve" | "dismiss" | "cancel"; suggestion: DiscountSuggestion } | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)

  const { toast } = useToast()

  const loadAll = useCallback(async () => {
    const suggestionList = await getDiscountSuggestions()
    setSuggestions(suggestionList)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadAll()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [loadAll])

  const pendingSuggestions = useMemo(
    () => suggestions.filter((s) => s.state === "pending"),
    [suggestions],
  )

  // One list, original order: approving flips the card in place instead of
  // moving it to a separate section further down the page.
  const visibleSuggestions = useMemo(
    () => suggestions.filter((s) => s.state !== "dismissed"),
    [suggestions],
  )

  const runDialogAction = async () => {
    if (!dialog) return
    setDialogBusy(true)
    // "cancel" turns off the offers the promo created but returns the
    // suggestion to pending, so the card stays visible and can be re-approved.
    const action = dialog.kind === "approve" ? "approve" : dialog.kind === "cancel" ? "cancel" : "dismiss"
    try {
      await applyDiscountSuggestion(dialog.suggestion.event, action)
      // Update local state directly - no re-fetch needed
      setSuggestions((prev) =>
        prev.map((s) =>
          s.event === dialog.suggestion.event
            ? {
                ...s,
                state:
                  dialog.kind === "approve" ? "approved" : dialog.kind === "cancel" ? "pending" : "dismissed",
              }
            : s,
        ),
      )
      toast({
        title:
          dialog.kind === "approve"
            ? "Promo approved"
            : dialog.kind === "cancel"
              ? "Promo cancelled"
              : "Promo dismissed",
        description:
          dialog.kind === "approve"
            ? `${dialog.suggestion.event} offers were created.`
            : dialog.kind === "cancel"
              ? `${dialog.suggestion.event} offers were turned off and it is pending again.`
              : `${dialog.suggestion.event} was removed from suggestions.`,
        variant: "success",
      })
      setDialog(null)
    } catch (err) {
      toast({
        title:
          dialog.kind === "approve"
            ? "Couldn't approve"
            : dialog.kind === "cancel"
              ? "Couldn't cancel"
              : "Couldn't dismiss",
        description: errorMessage(err),
        variant: "error",
      })
    } finally {
      setDialogBusy(false)
    }
  }

  if (loading || !ready) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-start justify-between mb-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mb-3 space-y-2">
              <Skeleton className="h-3 w-44" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="mb-3 h-3 w-full" />
            <div className="flex items-center gap-2 rounded-[8px] bg-[#f8f9fb] p-3">
              <Skeleton className="h-8 flex-1 rounded-[8px]" />
              <Skeleton className="h-8 w-20 rounded-[8px]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!visibleSuggestions.length) {
    return (
      <div className="py-16 text-center text-[13px] text-[#6b7280]">
        No promo suggestions right now.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pendingSuggestions.length > 0 && (
        <div className="rounded-[12px] border border-[#82285f]/20 bg-[#82285f]/5 p-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#82285f]" />
            <span className="text-[13px] font-bold text-[#82285f]">
              {pendingSuggestions.length} promo suggestion{pendingSuggestions.length !== 1 ? "s" : ""} waiting for approval
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {visibleSuggestions.map((s) => {
          const approved = s.state === "approved"
          return (
            <div
              key={s.event}
              className={cn(
                "rounded-[12px] border p-4 transition-shadow",
                approved
                  ? "border-[#e5e7eb] bg-white"
                  : "border-[#82285f]/30 shadow-[0_0_0_1px_rgba(130,40,95,0.08)]",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-[14px] font-bold text-[#1a1d26]">{s.event}</h3>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    s.phase === "live" ? "bg-[#82285f]/10 text-[#82285f]" : "bg-gray-100 text-gray-600",
                  )}
                >
                  {s.phase === "live" ? "Live now" : `in ${s.daysUntilStart} days`}
                </span>
              </div>

              <div className="mb-3 space-y-1 text-[11px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6b7280]">Dates</span>
                  <span className="text-right font-semibold text-[#1a1d26]">
                    {shortDate(s.validFrom)} to {longDate(s.validTo)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#6b7280]">Discount</span>
                  <span className="font-bold text-[#82285f]">
                    {s.percentRange[0]}-{s.percentRange[1]}% off
                  </span>
                </div>
              </div>

              <p className="mb-3 text-[11px] leading-relaxed text-[#4a4f59]">
                {s.roomTypes.map((r) => `${r.roomType} ${r.percent}%`).join(" · ")}
              </p>

              {approved ? (
                <div className="rounded-[8px] bg-emerald-50 px-3 py-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
                    <Check className="h-3.5 w-3.5" />
                    Promo approved
                  </div>
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: "cancel", suggestion: s })}
                    disabled={dialogBusy}
                    className="mt-2 w-full cursor-pointer rounded-[6px] border border-emerald-200 px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  >
                    Cancel promo
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-[8px] bg-[#82285f]/5 p-3">
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: "approve", suggestion: s })}
                    disabled={dialogBusy}
                    className="flex-1 cursor-pointer rounded-[8px] bg-[#82285f] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#6b1f4d] disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: "dismiss", suggestion: s })}
                    disabled={dialogBusy}
                    className="cursor-pointer rounded-[8px] border border-[#e2e4e8] bg-white px-3 py-2 text-[12px] font-medium text-[#6b7280] transition-colors hover:border-[#c9ccd3] hover:text-[#1a1d26] disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !dialogBusy) setDialog(null)
        }}
        variant="default"
        title={
          dialog?.kind === "approve"
            ? `Approve ${dialog.suggestion.event}?`
            : dialog?.kind === "cancel"
              ? `Cancel ${dialog.suggestion.event} promo?`
              : `Dismiss ${dialog?.suggestion.event ?? ""}?`
        }
        description={
          dialog?.kind === "approve"
            ? `Creates ${dialog.suggestion.roomTypes.length} offer${dialog.suggestion.roomTypes.length === 1 ? "" : "s"} for ${shortDate(dialog.suggestion.validFrom)} to ${longDate(dialog.suggestion.validTo)}. Guests only see the discount when the dates are live, and you can switch it off anytime.`
            : dialog?.kind === "cancel"
              ? "Turns off the offers this promo created. Guests stop seeing the discount immediately, and the suggestion goes back to pending so you can approve it again."
              : "Hides this suggestion and removes any existing approval for it. No offers are created."
        }
        confirmLabel={dialog?.kind === "approve" ? "Approve" : dialog?.kind === "cancel" ? "Cancel promo" : "Dismiss"}
        cancelLabel="Cancel"
        loading={dialogBusy}
        loadingLabel={dialog?.kind === "approve" ? "Approving..." : dialog?.kind === "cancel" ? "Cancelling..." : "Dismissing..."}
        onConfirm={runDialogAction}
      />
    </div>
  )
}
