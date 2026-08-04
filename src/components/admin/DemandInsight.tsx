import { TrendingDown, Check, X, Brain, Tag } from "lucide-react"
import { useState } from "react"
import type { DemandInsightData } from "@/services/adminService"
import { cn } from "@/lib/utils"

interface DemandInsightProps {
  insight: DemandInsightData
  delay?: number
}

export default function DemandInsight({ insight, delay = 0 }: DemandInsightProps) {
  const [applied, setApplied] = useState(insight.applied)
  const [dismissed, setDismissed] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  if (dismissed) return null

  return (
    <>
      <div
        className={cn(
          "rounded-[6px] border p-5 transition-all duration-300",
          applied
            ? "bg-[#3D6B4F]/5 border-[#3D6B4F]/20"
            : "bg-white border-[#e2e4e8] hover:shadow-card-hover"
        )}
        >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-[6px] bg-[#455d58]/10 text-[#455d58]">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{insight.period}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-[4px] bg-[#455d58]/10 text-[#455d58]">
                    {insight.discountPercent}% Discount
                  </span>
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    {insight.confidence}% confidence
                  </span>
                </div>
              </div>
            </div>

            {/* Predicted occupancy */}
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-display text-2xl font-bold text-foreground">
                {insight.predictedOccupancy}%
              </span>
              <span className="text-xs text-muted">predicted occupancy</span>
            </div>

            {/* Reason */}
            <p className="text-sm text-muted leading-relaxed mb-3">{insight.reason}</p>

            {/* Recommendation */}
            <div className="bg-[#f8f7f4] rounded-[4px] px-3 py-2 border border-[#e2e4e8] mb-2">
              <p className="text-sm font-medium text-foreground">
                Recommendation: {insight.recommendation}
              </p>
            </div>

            {/* Affected rooms + impact */}
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {insight.affectedRooms.join(", ")}
              </span>
              <span className="font-medium text-[#3D6B4F]">{insight.projectedImpact}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {applied ? (
              <div className="flex items-center gap-1.5 text-[#3D6B4F] text-xs font-medium px-3 py-2 bg-[#3D6B4F]/10 rounded-[4px]">
                <Check className="w-3.5 h-3.5" />
                Accepted
              </div>
            ) : (
              <>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-[4px] bg-[#455d58] text-white hover:bg-[#374d48] transition-colors duration-200"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-[4px] border border-[#e2e4e8] text-muted hover:bg-[#f5f6f8] transition-colors duration-200"
                >
                  <X className="w-3.5 h-3.5" />
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[8px] border border-[#e2e4e8] shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#455d58]/10">
                  <Tag className="w-5 h-5 text-[#455d58]" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">Accept Discount</h3>
                  <p className="text-sm text-muted">This will activate the discount offer</p>
                </div>
              </div>

              <div className="bg-[#f8f7f4] rounded-[6px] border border-[#e2e4e8] p-4 mb-4">
                <p className="text-sm font-medium text-foreground mb-1">{insight.period}</p>
                <p className="text-sm text-muted mb-2">{insight.reason}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-[4px] bg-[#455d58]/10 text-[#455d58]">
                    {insight.discountPercent}% off
                  </span>
                  <span className="text-xs text-muted">
                    Applies to: {insight.affectedRooms.join(", ")}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted mb-4">
                This will activate the {insight.discountPercent}% discount for {insight.period}.
                Base rates remain fixed — this is a temporary promotional offer.
                You can deactivate from the Discount Offers section.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#e2e4e8]">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-muted rounded-[4px] border border-[#e2e4e8] hover:bg-[#f5f6f8] transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setApplied(true)
                  setShowConfirm(false)
                }}
                className="px-4 py-2 text-sm font-medium text-white rounded-[4px] bg-[#455d58] hover:bg-[#374d48] transition-colors duration-200"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
