import { useState } from "react"
import { Tag, Check, RotateCcw, Info } from "lucide-react"
import { cn, formatCurrency } from "@/lib/utils"
import type { DiscountOfferData } from "@/services/adminService"

interface DiscountOffersProps {
  offers: DiscountOfferData[]
  loading?: boolean
}

export default function DiscountOffers({ offers: initialOffers, loading }: DiscountOffersProps) {
  const [offers, setOffers] = useState(initialOffers)
  const [hasAccepted, setHasAccepted] = useState(false)

  const handleAcceptAll = () => {
    setOffers((prev) => prev.map((offer) => ({ ...offer, status: "active" as const })))
    setHasAccepted(true)
  }

  const handleReset = () => {
    setOffers((prev) => prev.map((offer) => ({ ...offer, status: "scheduled" as const })))
    setHasAccepted(false)
  }

  const activeOffers = offers.filter((o) => o.status === "active")
  const scheduledOffers = offers.filter((o) => o.status === "scheduled")

  const totalProjectedRevenue = offers.reduce((sum, o) => sum + o.projectedRevenue, 0)

  if (loading) {
    return (
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] animate-pulse p-6">
        <div className="h-5 w-36 bg-[#f0f1f3] rounded mb-4" />
        <div className="h-40 bg-[#f0f1f3] rounded" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[6px] border border-[#e2e4e8]">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#e2e4e8]">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Discount Offers</h3>
          <p className="text-sm text-muted mt-0.5">AI-recommended discounts for low-demand periods</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-[4px] border border-[#e2e4e8] text-muted hover:bg-[#f5f6f8] transition-colors duration-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
          <button
            onClick={handleAcceptAll}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-[4px] bg-[#82285f] text-white hover:bg-[#6b1f4b] transition-colors duration-200"
          >
            <Check className="w-3.5 h-3.5" />
            Activate All
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2 px-6 py-2.5 bg-[#f8f7f4] border-b border-[#e2e4e8]">
        <Info className="w-3.5 h-3.5 text-muted flex-shrink-0" />
        <p className="text-xs text-muted">
          Base rates remain <span className="font-semibold text-foreground">fixed</span>. These are temporary discount offers for specific periods. Use "Reset" to deactivate.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-[#e2e4e8]">
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Active Offers</p>
          <p className="font-display text-xl font-bold text-foreground mt-0.5">{activeOffers.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Scheduled</p>
          <p className="font-display text-xl font-bold text-foreground mt-0.5">{scheduledOffers.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted uppercase tracking-wide">Projected Revenue</p>
          <p className="font-display text-xl font-bold text-[#3D6B4F] mt-0.5">{formatCurrency(totalProjectedRevenue)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e2e4e8]">
              <th className="text-left px-6 py-3 font-medium text-muted">Room Type</th>
              <th className="text-right px-6 py-3 font-medium text-muted">Base Rate</th>
              <th className="text-right px-6 py-3 font-medium text-muted">Discounted</th>
              <th className="text-right px-6 py-3 font-medium text-muted">Off</th>
              <th className="text-left px-6 py-3 font-medium text-muted">Valid Period</th>
              <th className="text-right px-6 py-3 font-medium text-muted">Proj. Bookings</th>
              <th className="text-right px-6 py-3 font-medium text-muted">Proj. Revenue</th>
              <th className="text-center px-6 py-3 font-medium text-muted">Status</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr
                key={offer.id}
                className="border-b border-[#e2e4e8]/60 last:border-0 transition-colors duration-300"
              >
                <td className="px-6 py-3.5 font-medium text-foreground">{offer.roomType}</td>
                <td className="px-6 py-3.5 text-right text-muted">{formatCurrency(offer.baseRate)}</td>
                <td className="px-6 py-3.5 text-right font-medium text-[#3D6B4F]">
                  {formatCurrency(offer.discountedRate)}
                </td>
                <td className="px-6 py-3.5 text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-[#455d58]/10 text-[#455d58]">
                    <Tag className="w-3 h-3" />
                    {offer.discountPercent}% off
                  </span>
                </td>
                <td className="px-6 py-3.5 text-xs text-muted">
                  {new Date(offer.validFrom).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} –{" "}
                  {new Date(offer.validTo).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </td>
                <td className="px-6 py-3.5 text-right text-foreground">{offer.projectedBookings}</td>
                <td className="px-6 py-3.5 text-right font-medium text-foreground">{formatCurrency(offer.projectedRevenue)}</td>
                <td className="px-6 py-3.5 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-[4px]",
                      offer.status === "active"
                        ? "bg-[#3D6B4F]/10 text-[#3D6B4F]"
                        : "bg-[#f0f1f3] text-muted"
                    )}
                  >
                    {offer.status === "active" ? "Active" : "Scheduled"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasAccepted && (
        <div className="flex items-center gap-2 px-6 py-3 bg-[#3D6B4F]/5 border-t border-[#3D6B4F]/15">
          <Check className="w-4 h-4 text-[#3D6B4F]" />
          <p className="text-xs text-[#3D6B4F] font-medium">
            Discount offers activated. Base rates unchanged. Use "Reset" to deactivate all offers.
          </p>
        </div>
      )}
    </div>
  )
}
