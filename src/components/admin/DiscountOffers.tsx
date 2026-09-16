import { useState, useEffect, useMemo } from "react"
import { Tag, Check, X, Brain, Calendar, Sparkles, Shield } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import type { DiscountOfferData } from "@/services/adminService"
import { getActiveDiscounts, getUpcomingDiscounts, type ActiveDiscount, type DiscountRoom } from "@/lib/discountEngine"
import { useDiscountApproval } from "@/hooks/useDiscountApproval"

interface DiscountOffersProps {
  offers: DiscountOfferData[]
  rooms: DiscountRoom[]
  loading?: boolean
}

export default function DiscountOffers({ offers: initialOffers, rooms, loading }: DiscountOffersProps) {
  const [offers, setOffers] = useState(initialOffers)
  const [aiDiscounts, setAiDiscounts] = useState<ActiveDiscount[]>([])
  const [upcomingDiscounts, setUpcomingDiscounts] = useState<(ActiveDiscount & { daysUntilStart: number })[]>([])
  const { approvedKeys, loading: approvalLoading, approve, dismiss } = useDiscountApproval()

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
    await approve(eventRoomTypeKey)
  }

  const handleDismissDiscount = async (eventRoomTypeKey: string) => {
    await dismiss(eventRoomTypeKey)
  }

  const handleToggleOffer = (offerId: string) => {
    setOffers((prev) =>
      prev.map((o) =>
        o.id === offerId
          ? { ...o, status: o.status === "active" ? ("scheduled" as const) : ("active" as const) }
          : o
      )
    )
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
              <h3 className="font-display text-lg font-semibold text-foreground">AI Holiday Suggestions</h3>
              <p className="text-sm text-muted mt-0.5">Smart discounts based on holidays & events</p>
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
            <p className="text-sm text-muted mt-0.5">Toggle each offer individually to activate or dismiss</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e2e4e8]">
                  <th className="text-left px-6 py-3 font-medium text-muted">Room Type</th>
                  <th className="text-right px-6 py-3 font-medium text-muted">Base</th>
                  <th className="text-right px-6 py-3 font-medium text-muted">Discounted</th>
                  <th className="text-right px-6 py-3 font-medium text-muted">Off</th>
                  <th className="text-left px-6 py-3 font-medium text-muted">Valid Period</th>
                  <th className="text-center px-6 py-3 font-medium text-muted">Action</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => {
                  const isActive = offer.status === "active"
                  return (
                    <tr
                      key={offer.id}
                      className={cn(
                        "border-b border-[#e2e4e8]/60 last:border-0 transition-colors",
                        isActive && "bg-[#3D6B4F]/[0.03]"
                      )}
                    >
                      <td className="px-6 py-3 font-medium text-foreground">{offer.roomType}</td>
                      <td className="px-6 py-3 text-right text-muted">{formatCurrency(offer.baseRate)}</td>
                      <td className="px-6 py-3 text-right font-medium text-[#3D6B4F]">
                        {formatCurrency(offer.discountedRate)}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-[#455d58]/10 text-[#455d58]">
                          <Tag className="w-3 h-3" />
                          {offer.discountPercent}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-xs text-muted">
                        {new Date(offer.validFrom).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} –{" "}
                        {new Date(offer.validTo).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <button
                          onClick={() => handleToggleOffer(offer.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-[4px] transition-all duration-200",
                            isActive
                              ? "bg-[#3D6B4F]/10 text-[#3D6B4F] hover:bg-[#3D6B4F]/20"
                              : "bg-[#f0f1f3] text-muted hover:bg-[#e2e4e8]"
                          )}
                        >
                          {isActive ? (
                            <>
                              <Check className="w-3 h-3" />
                              Active
                            </>
                          ) : (
                            <>
                              <X className="w-3 h-3" />
                              Dismiss
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
