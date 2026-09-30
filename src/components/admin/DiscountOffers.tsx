import { useState, useEffect, useMemo } from "react"
import { Tag, Check, X, Brain, Calendar, Sparkles, Shield, Pencil, Save } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import AiAbout from "@/components/admin/AiAbout"
import type { DiscountOfferData } from "@/services/adminService"
import { setDiscountOfferStatus } from "@/services/adminService"
import { getActiveDiscounts, getUpcomingDiscounts, type ActiveDiscount, type DiscountRoom } from "@/lib/discountEngine"
import { useDiscountApproval } from "@/hooks/useDiscountApproval"
import { useToast } from "@/contexts/ToastContext"

interface DiscountOffersProps {
  offers: DiscountOfferData[]
  rooms: DiscountRoom[]
  loading?: boolean
}

export default function DiscountOffers({ offers: initialOffers, rooms, loading }: DiscountOffersProps) {
  const [offers, setOffers] = useState(initialOffers)
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null)
  const [editPercent, setEditPercent] = useState(10)
  const [savingEdit, setSavingEdit] = useState(false)
  const [aiDiscounts, setAiDiscounts] = useState<ActiveDiscount[]>([])
  const [upcomingDiscounts, setUpcomingDiscounts] = useState<(ActiveDiscount & { daysUntilStart: number })[]>([])
  const { approvedKeys, loading: approvalLoading, approve, dismiss } = useDiscountApproval()
  const { toast } = useToast()

  useEffect(() => {
    setOffers(initialOffers)
  }, [initialOffers])

  useEffect(() => {
    setAiDiscounts(getActiveDiscounts(rooms))
    setUpcomingDiscounts(getUpcomingDiscounts(rooms))
  }, [rooms])

  const consolidatedDiscounts = useMemo(() => {
    const map = new Map<string, ActiveDiscount>()
    for (const d of aiDiscounts) {
      const existing = map.get(d.roomType)
      if (!existing || d.discountPercent > existing.discountPercent) {
        map.set(d.roomType, d)
      }
    }
    return Array.from(map.values())
  }, [aiDiscounts])

  const handleApproveDiscount = async (eventRoomTypeKey: string) => {
    try {
      await approve(eventRoomTypeKey)
      toast({ title: "Promo approved", description: "Holiday discount is now active.", variant: "success" })
    } catch {
      toast({ title: "Couldn't save", description: "Try again.", variant: "error" })
    }
  }

  const handleDismissDiscount = async (eventRoomTypeKey: string) => {
    try {
      await dismiss(eventRoomTypeKey)
      toast({ title: "Promo dismissed", variant: "default" })
    } catch {
      toast({ title: "Couldn't save", description: "Try again.", variant: "error" })
    }
  }

  const handleToggleOffer = async (offerId: string) => {
    const offer = offers.find((o) => o.id === offerId)
    if (!offer) return
    const next = offer.status === "active" ? ("scheduled" as const) : ("active" as const)
    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, status: next } : o))
    )
    try {
      await setDiscountOfferStatus(offerId, next)
      toast({
        title: next === "active" ? "Offer activated" : "Offer deactivated",
        description: offer.roomType,
        variant: "success",
      })
    } catch {
      setOffers((prev) =>
        prev.map((o) => (o.id === offerId ? { ...o, status: offer.status } : o))
      )
      toast({ title: "Couldn't save", description: "Try again.", variant: "error" })
    }
  }

  const beginEditOffer = (offer: DiscountOfferData) => {
    setEditingOfferId(offer.id)
    setEditPercent(offer.discountPercent)
  }

  const handleSaveOfferEdit = async (offer: DiscountOfferData) => {
    const percent = Math.round(editPercent)
    if (!Number.isFinite(percent) || percent < 1 || percent > 80) {
      toast({ title: "Invalid discount", description: "Choose a value from 1% to 80%.", variant: "error" })
      return
    }
    setSavingEdit(true)
    try {
      const persistedStatus = offer.status === "expired" ? "scheduled" : offer.status
      await setDiscountOfferStatus(offer.id, persistedStatus, percent)
      const discountedRate = Math.round(offer.baseRate * (1 - percent / 100))
      setOffers((prev) => prev.map((o) => o.id === offer.id
        ? { ...o, discountPercent: percent, discountedRate, projectedRevenue: o.projectedBookings * discountedRate }
        : o))
      setEditingOfferId(null)
      toast({ title: "Discount updated", description: `${offer.roomType}: ${percent}% off`, variant: "success" })
    } catch {
      toast({ title: "Couldn't save discount", description: "Try again.", variant: "error" })
    } finally {
      setSavingEdit(false)
    }
  }

  if (loading || approvalLoading) {
    return (
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse p-6">
        <div className="h-5 w-36 bg-[#f0f1f3] rounded mb-4" />
        <div className="h-40 bg-[#f0f1f3] rounded" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* AI Holiday Discount Suggestions */}
      <div className="bg-white rounded-[6px] border border-[#e2e4e8]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e4e8]">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-[6px] bg-[#82285f]/10">
              <Brain className="w-4 h-4 text-[#82285f]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-lg font-semibold text-foreground">AI Holiday Suggestions</h3>
                <AiAbout text="AI-generated promo proposals for holidays and local events, based on past demand. Approved promos automatically apply to guest search." />
              </div>
              <p className="text-sm text-muted mt-0.5">Promos for holidays and local events — approve to activate</p>
            </div>
          </div>
          {consolidatedDiscounts.length > 0 && (
            <span className="text-[11px] font-medium text-[#82285f] bg-[#82285f]/10 px-2.5 py-1 rounded-[4px]">
              {consolidatedDiscounts.filter(d => approvedKeys.has(d.eventRoomTypeKey)).length} / {consolidatedDiscounts.length} Approved
            </span>
          )}
        </div>

        {consolidatedDiscounts.length > 0 ? (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {consolidatedDiscounts.map((discount) => {
                const isApproved = approvedKeys.has(discount.eventRoomTypeKey)
                return (
                  <div
                    key={discount.roomType}
                    className={cn(
                      "border rounded-[8px] p-4 transition-colors",
                      isApproved ? "border-[#3D6B4F]/40 bg-[#3D6B4F]/[0.03]" : "border-[#e2e4e8] hover:border-[#82285f]/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-bold text-foreground">{discount.roomType}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-[4px] bg-[#A4423A]/10 text-[#A4423A]">
                        <Tag className="w-3 h-3" />
                        {discount.discountPercent}% OFF
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Sparkles className="w-3 h-3 text-[#82285f]" />
                      <span className="text-[11px] font-medium text-[#82285f]">{discount.event}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Calendar className="w-3 h-3 text-muted" />
                      <span className="text-[11px] text-muted">
                        {new Date(discount.validFrom).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} –{" "}
                        {new Date(discount.validTo).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[15px] font-bold text-[#A4423A]">
                        {formatCurrency(discount.discountedPrice)}
                      </span>
                      <span className="text-[11px] text-muted line-through">
                        {formatCurrency(Math.round(discount.discountedPrice / (1 - discount.discountPercent / 100)))}
                      </span>
                      <span className="text-[10px] text-muted">/night</span>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#e2e4e8]">
                      {isApproved ? (
                        <>
                          <Shield className="w-3.5 h-3.5 text-[#3D6B4F]" />
                          <span className="text-[11px] font-medium text-[#3D6B4F]">Approved</span>
                          <button
                            onClick={() => handleDismissDiscount(discount.eventRoomTypeKey)}
                            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-[4px] bg-[#f0f1f3] text-muted hover:bg-[#e2e4e8] transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApproveDiscount(discount.eventRoomTypeKey)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-[4px] bg-[#3D6B4F]/10 text-[#3D6B4F] hover:bg-[#3D6B4F]/20 transition-colors"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleDismissDiscount(discount.eventRoomTypeKey)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-[4px] bg-[#f0f1f3] text-muted hover:bg-[#e2e4e8] transition-colors"
                          >
                            <X className="w-3 h-3" />
                            Dismiss
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : upcomingDiscounts.length > 0 ? (
          <div className="p-6">
            <p className="text-[12px] text-muted mb-3">No active promos right now. Upcoming:</p>
            <div className="space-y-2">
              {upcomingDiscounts.slice(0, 3).map((discount, i) => (
                <div
                  key={`up-${discount.roomId}-${i}`}
                  className="flex items-center justify-between p-3 bg-[#f5f6f8] rounded-[6px]"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#82285f]" />
                    <span className="text-[12px] font-medium text-foreground">{discount.event}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-muted">{discount.roomType}</span>
                    <span className="text-[11px] font-bold text-[#82285f]">{discount.discountPercent}% OFF</span>
                    <span className="text-[10px] text-muted">in {discount.daysUntilStart} days</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-[12px] text-muted">No holiday promos at this time.</p>
          </div>
        )}
      </div>

      {/* Scheduled Discount Offers */}
      {offers.length > 0 && (
        <div className="bg-white rounded-[6px] border border-[#e2e4e8]">
          <div className="px-6 py-4 border-b border-[#e2e4e8]">
            <h3 className="font-display text-lg font-semibold text-foreground">Scheduled Offers</h3>
            <p className="text-sm text-muted mt-0.5">Price cuts for slow months — activate when you're ready</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {offers.map((offer) => {
                const isActive = offer.status === "active"
                const editing = editingOfferId === offer.id
                return (
                  <div
                    key={offer.id}
                    className={cn(
                      "border rounded-[8px] p-4 transition-colors",
                      isActive
                        ? "border-[#3D6B4F]/40 bg-[#3D6B4F]/[0.03]"
                        : "border-[#e2e4e8] hover:border-[#82285f]/30"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-bold text-foreground">{offer.roomType}</span>
                      {editing ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            aria-label={`Discount percent for ${offer.roomType}`}
                            type="number"
                            min={1}
                            max={80}
                            step={1}
                            value={editPercent}
                            onChange={(event) => setEditPercent(Number(event.target.value))}
                            className="w-16 rounded-[4px] border border-[#e2e4e8] px-2 py-1 text-right text-xs text-foreground focus:border-[#82285f] focus:outline-none"
                          />
                          <span className="text-xs text-muted">%</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-[4px] bg-[#A4423A]/10 text-[#A4423A]">
                          <Tag className="w-3 h-3" />
                          {offer.discountPercent}% OFF
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mb-3">
                      <Calendar className="w-3 h-3 text-muted" />
                      <span className="text-[11px] text-muted">
                        {new Date(offer.validFrom).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} –{" "}
                        {new Date(offer.validTo).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-[15px] font-bold text-[#A4423A]">{formatCurrency(offer.discountedRate)}</span>
                      <span className="text-[11px] text-muted line-through">{formatCurrency(offer.baseRate)}</span>
                      <span className="text-[10px] text-muted">/night</span>
                    </div>

                    <p className={cn("mt-1 text-[11px] font-medium", isActive ? "text-[#3D6B4F]" : "text-muted")}>
                      {isActive ? "Live — guests see this on the Rooms page" : "Off — activate to show it to guests"}
                    </p>

                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#e2e4e8]">
                      {editing ? (
                        <>
                          <button type="button" onClick={() => handleSaveOfferEdit(offer)} disabled={savingEdit} className="inline-flex items-center gap-1 rounded-[4px] bg-[#455d58] px-2.5 py-1.5 text-xs font-medium text-white hover:bg-[#374d48] disabled:opacity-50">
                            <Save className="h-3 w-3" /> Save
                          </button>
                          <button type="button" onClick={() => setEditingOfferId(null)} disabled={savingEdit} aria-label="Cancel editing" className="rounded-[4px] border border-[#e2e4e8] p-1.5 text-muted hover:bg-[#f5f6f8] disabled:opacity-50"><X className="h-3 w-3" /></button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => beginEditOffer(offer)} className="inline-flex items-center gap-1 rounded-[4px] border border-[#e2e4e8] px-2.5 py-1.5 text-xs font-medium text-muted hover:border-[#82285f]/40 hover:text-[#82285f]">
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                          <button onClick={() => handleToggleOffer(offer.id)} className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[4px] transition-all duration-200",
                            isActive ? "bg-[#3D6B4F]/10 text-[#3D6B4F] hover:bg-[#3D6B4F]/20" : "bg-[#f0f1f3] text-muted hover:bg-[#e2e4e8]"
                          )}>
                            {isActive ? <><Check className="w-3 h-3" /> Deactivate</> : <><Tag className="w-3 h-3" /> Activate</>}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
