import { useState, useEffect, useMemo, useCallback } from "react"
import { cn, formatCurrency } from "@/lib/utils"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { useToast } from "@/contexts/ToastContext"
import { ApiError } from "@/services/api"
import type {
  DiscountOfferData,
  DiscountOfferStatus,
  DiscountSuggestion,
  DiscountRules,
  DiscountAuditEntry,
} from "@/services/adminService"
import {
  getDiscountOffers,
  getDiscountOffersFresh,
  getDiscountSuggestions,
  getDiscountRules,
  getDiscountAudit,
  setDiscountOfferStatus,
  applyDiscountSuggestion,
} from "@/services/adminService"
import type { DiscountRoom } from "@/lib/discountEngine"

interface DiscountOffersProps {
  /** Optional seed from the host page; the component keeps its own copy. */
  offers?: DiscountOfferData[]
  /** Used by the host page; kept for call-site compatibility. */
  rooms?: DiscountRoom[]
  loading?: boolean
}

const DEFAULT_RULES: DiscountRules = { maxPercent: 50, minPrice: 500 }

const STATUS_LABEL: Record<DiscountOfferStatus, string> = {
  live: "Live",
  scheduled: "Scheduled",
  off: "Off",
  expired: "Expired",
}

const STATUS_ORDER: Record<DiscountOfferStatus, number> = {
  live: 0,
  scheduled: 1,
  off: 2,
  expired: 3,
}

const ACTION_VERB: Record<DiscountAuditEntry["action"], string> = {
  create: "created",
  activate: "activated",
  deactivate: "deactivated",
}

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })

const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const monthLabel = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", { month: "short", year: "numeric" })

const offerName = (o: DiscountOfferData) =>
  o.name ||
  `${new Date(`${o.validFrom.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", { month: "long" })} promo`

const isEnabled = (o: DiscountOfferData) =>
  o.enabled ?? (o.status === "live" || o.status === "scheduled")

const errorMessage = (err: unknown) =>
  err instanceof ApiError && err.message ? err.message : "Couldn't save. Try again."

interface OfferGroup {
  key: string
  name: string
  validFrom: string
  validTo: string
  offers: DiscountOfferData[]
  status: DiscountOfferStatus
  percentRange: [number, number]
  roomTypes: string[]
  enabled: boolean
}

function groupOffers(offers: DiscountOfferData[]): OfferGroup[] {
  const map = new Map<string, DiscountOfferData[]>()
  for (const o of offers) {
    const key = `${offerName(o)}|${o.validFrom}|${o.validTo}`
    const list = map.get(key)
    if (list) list.push(o)
    else map.set(key, [o])
  }
  const groups: OfferGroup[] = Array.from(map.entries()).map(([key, list]) => {
    const first = list[0]
    const pcts = list.map((o) => o.discountPercent)
    const statuses = list.map((o) => o.status)
    const status: DiscountOfferStatus =
      statuses.includes("live")
        ? "live"
        : statuses.includes("scheduled")
          ? "scheduled"
          : statuses.every((s) => s === "expired")
            ? "expired"
            : "off"
    return {
      key,
      name: offerName(first),
      validFrom: first.validFrom,
      validTo: first.validTo,
      offers: list.sort((a, b) => a.roomType.localeCompare(b.roomType)),
      status,
      percentRange: [Math.min(...pcts), Math.max(...pcts)],
      roomTypes: list.map((o) => o.roomType),
      // Partially enabled counts as on: guests see the room types that are
      // switched on, so the promo toggle must read ON (clicking it then turns
      // the whole promo off in one batch).
      enabled: list.some(isEnabled),
    }
  })
  return groups.sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
    if (byStatus !== 0) return byStatus
    return a.validFrom.localeCompare(b.validFrom)
  })
}

function StatusBadge({ status }: { status: DiscountOfferStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[4px] px-2 py-1 text-[13px] font-semibold",
        status === "live"
          ? "bg-[#82285f]/10 text-[#82285f]"
          : "bg-[#f0f1f3] text-[#5c6070]",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export default function DiscountOffers({ offers: initialOffers, loading }: DiscountOffersProps) {
  const [offers, setOffers] = useState<DiscountOfferData[]>(initialOffers ?? [])
  const [suggestions, setSuggestions] = useState<DiscountSuggestion[]>([])
  const [rules, setRules] = useState<DiscountRules>(DEFAULT_RULES)
  const [audit, setAudit] = useState<DiscountAuditEntry[]>([])
  const [ready, setReady] = useState(false)

  const [statusFilter, setStatusFilter] = useState<"all" | DiscountOfferStatus>("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [monthFilter, setMonthFilter] = useState("all")

  const [editKey, setEditKey] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const [dialog, setDialog] = useState<{ kind: "approve" | "dismiss"; suggestion: DiscountSuggestion } | null>(null)
  const [dialogBusy, setDialogBusy] = useState(false)

  const { toast } = useToast()

  const loadAll = useCallback(async () => {
    const [offerList, suggestionList, auditList, rulesData] = await Promise.all([
      getDiscountOffers(),
      getDiscountSuggestions(),
      getDiscountAudit(),
      getDiscountRules(),
    ])
    setOffers(offerList)
    setSuggestions(suggestionList)
    setAudit(auditList)
    setRules(rulesData)
  }, [])

  const refreshOffers = useCallback(async () => {
    const [offerList, suggestionList, auditList] = await Promise.all([
      getDiscountOffersFresh(),
      getDiscountSuggestions(),
      getDiscountAudit(),
    ])
    setOffers(offerList)
    setSuggestions(suggestionList)
    setAudit(auditList)
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

  const groups = useMemo(() => groupOffers(offers), [offers])
  const pendingSuggestions = useMemo(
    () => suggestions.filter((s) => s.state === "pending"),
    [suggestions],
  )

  const typeOptions = useMemo(
    () => Array.from(new Set(offers.map((o) => o.roomType))).sort(),
    [offers],
  )
  const monthOptions = useMemo(() => {
    const keys = Array.from(new Set(offers.map((o) => o.validFrom.slice(0, 7)))).sort()
    return keys
  }, [offers])

  const filteredGroups = useMemo(
    () =>
      groups.filter((g) => {
        if (statusFilter !== "all" && g.status !== statusFilter) return false
        if (typeFilter !== "all" && !g.offers.some((o) => o.roomType === typeFilter)) return false
        if (monthFilter !== "all" && !g.validFrom.startsWith(monthFilter)) return false
        return true
      }),
    [groups, statusFilter, typeFilter, monthFilter],
  )

  const handleToggle = async (group: OfferGroup) => {
    const next = !group.enabled
    setTogglingKey(group.key)
    setOffers((prev) =>
      prev.map((o) =>
        group.offers.some((g) => g.id === o.id)
          ? {
              ...o,
              enabled: next,
              status: next
                ? o.status === "expired"
                  ? o.status
                  : new Date(`${o.validTo.slice(0, 10)}T23:59:59`) < new Date()
                    ? "expired"
                    : new Date(`${o.validFrom.slice(0, 10)}T00:00:00`) > new Date()
                      ? "scheduled"
                      : "live"
                : "off",
            }
          : o,
      ),
    )
    try {
      await setDiscountOfferStatus({ ids: group.offers.map((o) => o.id), enabled: next })
      await refreshOffers()
      toast({
        title: next ? "Promo activated" : "Promo turned off",
        description: next
          ? `${group.name} applies automatically during its dates.`
          : `${group.name} is hidden from guests.`,
        variant: "success",
      })
    } catch (err) {
      await refreshOffers()
      toast({ title: "Couldn't save", description: errorMessage(err), variant: "error" })
    } finally {
      setTogglingKey(null)
    }
  }

  const beginEdit = (group: OfferGroup) => {
    setEditKey(group.key)
    setDraft(Object.fromEntries(group.offers.map((o) => [o.id, o.discountPercent])))
  }

  const validateDraft = (o: DiscountOfferData, percent: number): string | null => {
    if (!Number.isFinite(percent) || percent < 1 || percent > rules.maxPercent) {
      return `Discount must be 1% to ${rules.maxPercent}%`
    }
    const discounted = Math.round(o.baseRate * (1 - percent / 100))
    if (o.baseRate && discounted < rules.minPrice) {
      return `${o.roomType} would drop to ${formatCurrency(discounted)}, below the ${formatCurrency(rules.minPrice)} minimum`
    }
    return null
  }

  const saveEdit = async (group: OfferGroup) => {
    for (const o of group.offers) {
      const percent = Math.round(draft[o.id] ?? o.discountPercent)
      const problem = validateDraft(o, percent)
      if (problem) {
        toast({ title: "Invalid discount", description: problem, variant: "error" })
        return
      }
    }
    setSaving(true)
    try {
      for (const o of group.offers) {
        const percent = Math.round(draft[o.id] ?? o.discountPercent)
        if (percent === o.discountPercent) continue
        await setDiscountOfferStatus({
          id: o.id,
          enabled: isEnabled(o),
          discountPercent: percent,
        })
      }
      setEditKey(null)
      await refreshOffers()
      toast({ title: "Discounts updated", description: group.name, variant: "success" })
    } catch (err) {
      await refreshOffers()
      toast({ title: "Couldn't save discount", description: errorMessage(err), variant: "error" })
    } finally {
      setSaving(false)
    }
  }

  const runDialogAction = async () => {
    if (!dialog) return
    setDialogBusy(true)
    try {
      await applyDiscountSuggestion(dialog.suggestion.event, dialog.kind)
      await refreshOffers()
      toast({
        title: dialog.kind === "approve" ? "Promo approved" : "Promo dismissed",
        description:
          dialog.kind === "approve"
            ? `${dialog.suggestion.event} offers were created.`
            : `${dialog.suggestion.event} was removed from suggestions.`,
        variant: "success",
      })
      setDialog(null)
    } catch (err) {
      toast({
        title: dialog.kind === "approve" ? "Couldn't approve" : "Couldn't dismiss",
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
        <div className="h-64 skeleton rounded-[8px]" />
      </div>
    )
  }

  const selectClass =
    "h-9 rounded-[6px] border border-[#e2e4e8] bg-white px-2 text-[13px] text-foreground focus:border-[#82285f] focus:outline-none cursor-pointer"

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

      {/* Scheduled Offers */}
      <div className="rounded-[8px] border border-[#e2e4e8] bg-white">
        <div className="flex flex-col gap-3 px-6 py-4 border-b border-[#e2e4e8]">
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">Scheduled Offers</h3>
            <p className="text-[13px] text-muted mt-0.5">One switch per promo. Live offers apply automatically during their dates.</p>
          </div>
          {offers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className={selectClass}
              >
                <option value="all">All statuses</option>
                <option value="live">Live</option>
                <option value="scheduled">Scheduled</option>
                <option value="off">Off</option>
                <option value="expired">Expired</option>
              </select>
              <select
                aria-label="Filter by room type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All room types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                aria-label="Filter by month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All months</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{monthLabel(`${m}-01`)}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {offers.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[13px] text-muted">No offers yet. Approve a suggestion above to create one.</p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-[13px] text-muted">No offers match these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#e2e4e8] text-[13px] font-semibold text-muted">
                  <th className="px-6 py-3 font-semibold">Promo</th>
                  <th className="px-3 py-3 font-semibold">Dates</th>
                  <th className="px-3 py-3 font-semibold">Room types</th>
                  <th className="px-3 py-3 font-semibold">Discount</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              {filteredGroups.map((group) => {
                const editing = editKey === group.key
                const busy = togglingKey === group.key
                const percentLabel =
                  group.percentRange[0] === group.percentRange[1]
                    ? `${group.percentRange[0]}%`
                    : `${group.percentRange[0]}-${group.percentRange[1]}%`
                return (
                  <tbody key={group.key} className="border-b border-[#e2e4e8] last:border-b-0">
                    <tr className="text-[13px] text-foreground">
                      <td className="px-6 py-3 font-semibold">{group.name}</td>
                      <td className="px-3 py-3 text-muted whitespace-nowrap">
                        {shortDate(group.validFrom)} to {longDate(group.validTo)}
                      </td>
                      <td className="px-3 py-3 text-muted">{group.roomTypes.join(", ")}</td>
                      <td className="px-3 py-3 font-semibold">{percentLabel} off</td>
                      <td className="px-3 py-3"><StatusBadge status={group.status} /></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={group.enabled}
                            aria-label={`${group.enabled ? "Turn off" : "Activate"} ${group.name}`}
                            disabled={busy}
                            onClick={() => handleToggle(group)}
                            className={cn(
                              "relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer disabled:cursor-wait",
                              group.enabled ? "bg-[#82285f]" : "bg-[#d6d8dd]",
                            )}
                          >
                            <span
                              className={cn(
                                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                                group.enabled ? "left-[22px]" : "left-0.5",
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => (editing ? setEditKey(null) : beginEdit(group))}
                            className="rounded-[6px] border border-[#e2e4e8] px-3 py-1.5 text-[13px] font-medium text-muted hover:border-[#82285f]/40 hover:text-[#82285f] transition-colors cursor-pointer"
                          >
                            {editing ? "Cancel" : "Edit"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {editing && (
                      <tr>
                        <td colSpan={6} className="bg-[#f8f9fb] px-6 py-4">
                          <div className="flex flex-col gap-3">
                            <p className="text-[13px] font-semibold text-foreground">
                              Discount by room type (1 to {rules.maxPercent}%, minimum {formatCurrency(rules.minPrice)} rate)
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {group.offers.map((o) => {
                                const pct = draft[o.id] ?? o.discountPercent
                                const problem = validateDraft(o, pct)
                                return (
                                  <div
                                    key={o.id}
                                    className="flex items-center justify-between gap-3 rounded-[6px] border border-[#e2e4e8] bg-white px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[13px] font-semibold text-foreground">{o.roomType}</p>
                                      <p className={cn("text-[13px]", problem ? "text-[#A4423A]" : "text-muted")}>
                                        {problem
                                          ? problem
                                          : `${formatCurrency(Math.round(o.baseRate * (1 - pct / 100)))} from ${formatCurrency(o.baseRate)}`}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                      <input
                                        aria-label={`Discount percent for ${o.roomType}`}
                                        type="number"
                                        min={1}
                                        max={rules.maxPercent}
                                        step={1}
                                        value={pct}
                                        onChange={(e) =>
                                          setDraft((prev) => ({ ...prev, [o.id]: Number(e.target.value) }))
                                        }
                                        className={cn(
                                          "w-16 rounded-[6px] border bg-white px-2 py-1.5 text-right text-[13px] text-foreground focus:outline-none",
                                          problem ? "border-[#A4423A]" : "border-[#e2e4e8] focus:border-[#82285f]",
                                        )}
                                      />
                                      <span className="text-[13px] text-muted">%</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => saveEdit(group)}
                                className="rounded-[6px] bg-[#455d58] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#374d48] disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                {saving ? "Saving..." : "Save changes"}
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => setEditKey(null)}
                                className="rounded-[6px] border border-[#e2e4e8] px-3 py-1.5 text-[13px] font-medium text-muted hover:text-foreground disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}

        {audit.length > 0 && (
          <div className="border-t border-[#e2e4e8] px-6 py-4">
            <p className="text-[13px] font-semibold text-foreground mb-2">Recent activity</p>
            <ul className="flex flex-col gap-1">
              {audit.slice(0, 5).map((entry, i) => (
                <li key={`${entry.offer_id}-${entry.action}-${i}`} className="text-[13px] text-muted">
                  {new Date(entry.created_at).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {entry.actor_email || "admin"} {ACTION_VERB[entry.action]} {entry.promo} ({entry.room_type}, {entry.discount_percent}%)
                </li>
              ))}
            </ul>
          </div>
        )}
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
            : `Dismiss ${dialog?.suggestion.event ?? ""}?`
        }
        description={
          dialog?.kind === "approve"
            ? `Creates ${dialog.suggestion.roomTypes.length} offer${dialog.suggestion.roomTypes.length === 1 ? "" : "s"} for ${shortDate(dialog.suggestion.validFrom)} to ${longDate(dialog.suggestion.validTo)}. Guests only see the discount when the dates are live, and you can switch it off anytime.`
            : "Hides this suggestion and removes any existing approval for it. No offers are created."
        }
        confirmLabel={dialog?.kind === "approve" ? "Approve" : "Dismiss"}
        cancelLabel="Cancel"
        onConfirm={runDialogAction}
      />
    </div>
  )
}
