import { useState, useEffect } from "react"
import { TrendingDown, TrendingUp, Minus, Tag, Check, Sparkles } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import { useToast } from "@/contexts/ToastContext"
import {
  getRoomDemand,
  createDiscountOffer,
  getDiscountOffers,
  getDiscountOffersFresh,
  setDiscountOfferStatus,
  type RoomDemandData,
  type DiscountOfferData,
} from "@/services/adminService"
import { Skeleton } from "@/components/ui/skeleton"

const TREND_CONFIG = {
  up: { icon: TrendingUp, label: "Rising", color: "text-emerald-600", bg: "bg-emerald-50" },
  down: { icon: TrendingDown, label: "Declining", color: "text-red-600", bg: "bg-red-50" },
  stable: { icon: Minus, label: "Stable", color: "text-gray-500", bg: "bg-gray-50" },
} as const

// Local calendar day (Manila) — toISOString() is UTC, which is *yesterday*
// between midnight and 8 AM here and pushed the offer window a day off.
const isoDayLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function futureWindow(): { from: string; to: string } {
  const now = new Date()
  const from = isoDayLocal(now)
  const end = new Date(now.getTime() + 30 * 86400000)
  return { from, to: isoDayLocal(end) }
}

// "2026-11-15" → "Nov 15"
const fmtDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })

export default function RoomDemandInsights() {
  const { toast } = useToast()
  const [data, setData] = useState<RoomDemandData[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [existingOffers, setExistingOffers] = useState<DiscountOfferData[]>([])

  useEffect(() => {
    Promise.all([getRoomDemand(), getDiscountOffers()]).then(([rows, offers]) => {
      setData(rows)
      setExistingOffers(offers)
      setLoading(false)
    })
  }, [])

  const findOffer = (roomType: string): DiscountOfferData | undefined => {
    const today = isoDayLocal(new Date())
    const in30Days = isoDayLocal(new Date(Date.now() + 30 * 86400000))
    return existingOffers.find(
      (o) =>
        o.roomType === roomType &&
        o.enabled &&
        o.validFrom <= in30Days &&
        o.validTo >= today,
    )
  }

  const hasExistingOffer = (roomType: string): boolean => !!findOffer(roomType)

  const handleApply = async (row: RoomDemandData) => {
    if (!row.suggestedDiscount) return
    setApplying(row.roomType)
    try {
      const w = futureWindow()
      // Use the AI-recommended window when the backend provided one.
      const validTo = row.suggestedUntil ?? w.to
      let created = await createDiscountOffer({
        roomType: row.roomType,
        validFrom: w.from,
        validTo,
        name: `AI boost: ${row.roomType}`,
        discountPercent: row.suggestedDiscount,
      })
      // If the backend returned a disabled offer (idempotent same-window), re-enable it
      if (!created.enabled) {
        await setDiscountOfferStatus({ id: created.id, enabled: true })
        created = { ...created, enabled: true }
      }
      setExistingOffers((prev) => {
        const idx = prev.findIndex((o) => o.id === created.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = created
          return next
        }
        return [...prev, created]
      })
      // Re-sync with the backend so the tab reflects the DB truth in
      // real time (the server may have reused/re-enabled an existing offer).
      getDiscountOffersFresh().then(setExistingOffers).catch(() => {})
      toast({
        title: "Discount applied",
        description: `${row.suggestedDiscount}% discount applied to ${row.roomType}${row.suggestedUntil ? ` until ${fmtDay(row.suggestedUntil)}` : ""}`,
        variant: "success",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to apply discount"
      toast({ title: "Failed to apply", description: msg, variant: "error" })
    } finally {
      setApplying(null)
    }
  }

  const handleCancel = async (roomType: string) => {
    const offer = findOffer(roomType)
    if (!offer) return
    setCancelling(roomType)
    try {
      await setDiscountOfferStatus({ id: offer.id, enabled: false })
      setExistingOffers((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, enabled: false } : o)),
      )
      getDiscountOffersFresh().then(setExistingOffers).catch(() => {})
      toast({
        title: "Discount cancelled",
        description: `Discount for ${roomType} has been cancelled`,
        variant: "success",
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel discount"
      toast({ title: "Failed to cancel", description: msg, variant: "error" })
    } finally {
      setCancelling(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-2.5 w-36 mt-1" />
            </div>
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="rounded-[8px] bg-[#f8f9fb] p-3 space-y-2">
              <Skeleton className="h-3 w-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-full rounded-[8px]" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="text-center py-16 text-[#6b7280] text-[13px]">
        No room demand data available yet.
      </div>
    )
  }

  const needsBoost = data.filter((r) => r.suggestedDiscount && !hasExistingOffer(r.roomType))

  // Rooms the AI flagged keep their spot even after the admin applies the
  // discount — the order is decided once from the loaded demand rows.
  const sortedData = [...data].sort((a, b) => {
    const aFlagged = a.suggestedDiscount ? 0 : 1
    const bFlagged = b.suggestedDiscount ? 0 : 1
    return aFlagged - bFlagged
  })

  return (
    <div className="space-y-6">
      {needsBoost.length > 0 && (
        <div className="rounded-[12px] border border-[#82285f]/20 bg-[#82285f]/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="h-4 w-4 text-[#82285f]" />
            <span className="text-[13px] font-bold text-[#82285f]">
              {needsBoost.length} room type{needsBoost.length !== 1 ? "s" : ""} need{needsBoost.length === 1 ? "s" : ""} a boost
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
        {sortedData.map((row) => {
          const trend = TREND_CONFIG[row.trend]
          const TrendIcon = trend.icon
          const offer = findOffer(row.roomType)
          const isApplied = !!offer
          const showSuggestion = row.suggestedDiscount && !isApplied

          return (
            <div
              key={row.roomType}
              className={cn(
                "flex flex-col rounded-[12px] border p-4 transition-shadow",
                showSuggestion
                  ? "border-[#82285f]/30 shadow-[0_0_0_1px_rgba(130,40,95,0.08)]"
                  : "border-[#e5e7eb] bg-white",
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-[14px] font-bold text-[#1a1d26]">{row.roomType}</h3>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", trend.bg, trend.color)}>
                  <TrendIcon className="h-3 w-3" />
                  {trend.label}
                </span>
              </div>

              {/* What the AI sees — its plain-language read on this room type */}
              {row.reason && (
                <div className="mb-3 flex items-start gap-1.5">
                  <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#82285f]" />
                  <p className="text-[11px] italic leading-relaxed text-[#6b7280]">{row.reason}</p>
                </div>
              )}

              <div className="mb-3 flex items-center justify-between text-[11px]">
                <span className="text-[#6b7280]">Rate</span>
                <span className="font-semibold text-[#1a1d26]">{formatCurrency(row.baseRate)}/night</span>
              </div>

              {isApplied ? (
                <div className="flex flex-1 flex-col rounded-[8px] bg-emerald-50 px-3 py-2">
                  <div className="flex items-center justify-between text-[12px] font-semibold text-emerald-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      Discount applied
                    </span>
                    {offer && <span className="font-bold">{offer.discountPercent}% off</span>}
                  </div>
                  {offer && (
                    <div className="mt-0.5 mb-2 text-[11px] text-emerald-700/80">
                      {formatCurrency(offer.discountedRate)}/night · until {fmtDay(offer.validTo)}
                    </div>
                  )}
                  <button
                    onClick={() => handleCancel(row.roomType)}
                    disabled={cancelling === row.roomType}
                    className="mt-auto w-full rounded-[6px] border border-emerald-200 px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50 cursor-pointer"
                  >
                    {cancelling === row.roomType ? "Cancelling..." : "Cancel Discount"}
                  </button>
                </div>
              ) : showSuggestion ? (
                <div className="flex flex-1 flex-col rounded-[8px] bg-[#82285f]/5 p-3">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="text-[18px] font-bold text-[#82285f]">{row.suggestedDiscount}% off</span>
                    <span className="text-[13px] font-bold text-[#1a1d26]">{formatCurrency(row.discountedRate)}</span>
                  </div>
                  {row.suggestedUntil && (
                    <div className="mb-2 text-[11px] text-[#6b7280]">
                      AI recommends {row.suggestedDays} days · until {fmtDay(row.suggestedUntil)}
                    </div>
                  )}
                  <button
                    onClick={() => handleApply(row)}
                    disabled={applying === row.roomType}
                    className="mt-auto w-full rounded-[8px] bg-[#82285f] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#6b1f4d] disabled:opacity-50"
                  >
                    {applying === row.roomType ? "Applying..." : "Apply Discount"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 items-center rounded-[8px] bg-gray-50 px-3 py-2 text-[11px] text-[#6b7280]">
                  No discount needed
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
