import { useState, useEffect, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { useToast } from "@/contexts/ToastContext"
import { ApiError } from "@/services/api"
import type { DiscountSuggestion } from "@/services/adminService"
import {
  getDiscountSuggestions,
  applyDiscountSuggestion,
} from "@/services/adminService"

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

  const approvedSuggestions = useMemo(
    () => suggestions.filter((s) => s.state === "approved"),
    [suggestions],
  )

  const runDialogAction = async () => {
    if (!dialog) return
    setDialogBusy(true)
    // "cancel" reuses the dismiss endpoint — the backend also turns off the
    // offers the promo created, so the discount stops applying immediately.
    const action = dialog.kind === "approve" ? "approve" : "dismiss"
    try {
      await applyDiscountSuggestion(dialog.suggestion.event, action)
      // Update local state directly - no re-fetch needed
      setSuggestions((prev) =>
        prev.map((s) =>
          s.event === dialog.suggestion.event
            ? { ...s, state: dialog.kind === "approve" ? "approved" : "dismissed" }
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
              ? `${dialog.suggestion.event} offers were turned off.`
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
      <div className="flex flex-col gap-4">
        <div className="h-40 skeleton rounded-[8px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* AI Holiday Suggestions */}
      <div className="rounded-[8px] border border-[#e2e4e8] bg-white">
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-[#e2e4e8]">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">AI Holiday Suggestions</h3>
            <p className="text-[13px] text-muted mt-0.5">Promos for holidays and local events. Approve to create offers, or dismiss to hide them.</p>
          </div>
          {pendingSuggestions.length > 0 && (
            <span className="shrink-0 rounded-[4px] bg-[#82285f]/10 px-2.5 py-1 text-[13px] font-semibold text-[#82285f]">
              {pendingSuggestions.length} pending
            </span>
          )}
        </div>

        {pendingSuggestions.length > 0 ? (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {pendingSuggestions.map((s) => (
                <div key={s.event} className="flex flex-col gap-2 rounded-[8px] border border-[#e2e4e8] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-bold text-foreground">{s.event}</span>
                    <span
                      className={cn(
                        "shrink-0 rounded-[4px] px-2 py-1 text-[13px] font-semibold",
                        s.phase === "live"
                          ? "bg-[#82285f]/10 text-[#82285f]"
                          : "bg-[#f0f1f3] text-[#5c6070]",
                      )}
                    >
                      {s.phase === "live" ? "Live now" : `in ${s.daysUntilStart} days`}
                    </span>
                  </div>

                  <p className="text-[13px] text-muted">
                    {shortDate(s.validFrom)} to {longDate(s.validTo)}
                    {" · "}
                    {s.roomTypes.length} room type{s.roomTypes.length === 1 ? "" : "s"}
                    {" · "}
                    {s.percentRange[0]}-{s.percentRange[1]}% off
                  </p>

                  <p className="text-[13px] text-[#4a4f59]">
                    {s.roomTypes.map((r) => `${r.roomType} ${r.percent}%`).join(" · ")}
                  </p>

                  <p className="text-[13px] text-muted">{s.reasoning}</p>
                  {s.estimatedImpact && (
                    <p className="text-[13px] text-muted">
                      <span className="font-semibold text-foreground">Estimate:</span> {s.estimatedImpact}
                    </p>
                  )}

                  <div className="mt-1 flex items-center gap-2 pt-3 border-t border-[#e2e4e8]">
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "approve", suggestion: s })}
                      className="rounded-[6px] bg-[#82285f] px-3 py-1.5 text-[13px] font-semibold text-[#FBF9F4] hover:bg-[#6d2050] transition-colors cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "dismiss", suggestion: s })}
                      className="rounded-[6px] border border-[#e2e4e8] px-3 py-1.5 text-[13px] font-medium text-muted hover:border-[#c9ccd3] hover:text-foreground transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-[13px] text-muted">No pending promo suggestions right now.</p>
          </div>
        )}
      </div>

      {/* Approved holiday promos — previously invisible after approve, which
          left admins with no way to turn a holiday promo off. */}
      {approvedSuggestions.length > 0 && (
        <div className="rounded-[8px] border border-[#e2e4e8] bg-white">
          <div className="px-6 py-4 border-b border-[#e2e4e8]">
            <h3 className="text-[14px] font-semibold text-foreground">Approved holiday promos</h3>
            <p className="text-[12px] text-muted mt-0.5">
              Live on their dates below. Cancelling turns off the offers this promo created.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
            {approvedSuggestions.map((s) => (
              <div key={s.event} className="rounded-[8px] border border-[#e2e4e8] p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-[14px] font-semibold text-foreground">{s.event}</h4>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      s.phase === "live"
                        ? "bg-[#82285f]/10 text-[#82285f]"
                        : "bg-[#f0f1f3] text-[#5c6070]",
                    )}
                  >
                    {s.phase === "live" ? "Live now" : `in ${s.daysUntilStart} days`}
                  </span>
                </div>

                <p className="text-[13px] text-muted">
                  {shortDate(s.validFrom)} to {longDate(s.validTo)}
                  {" · "}
                  {s.roomTypes.length} room type{s.roomTypes.length === 1 ? "" : "s"}
                  {" · "}
                  {s.percentRange[0]}-{s.percentRange[1]}% off
                </p>

                <p className="text-[13px] text-[#4a4f59]">
                  {s.roomTypes.map((r) => `${r.roomType} ${r.percent}%`).join(" · ")}
                </p>

                <div className="flex items-center gap-2 pt-3 border-t border-[#e2e4e8]">
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: "cancel", suggestion: s })}
                    className="rounded-[6px] border border-[#e2e4e8] px-3 py-1.5 text-[13px] font-medium text-muted hover:border-[#c9ccd3] hover:text-foreground transition-colors cursor-pointer"
                  >
                    Cancel promo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              ? "Turns off the offers this promo created and hides it from suggestions. Guests stop seeing the discount immediately."
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
