import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/** Shopee-style cancellation reasons — "Other" opens a small free-text box. */
export const CANCEL_REASONS = [
  "Changed my plans",
  "Found a better hotel",
  "Booked by mistake",
  "Schedule conflict",
  "Personal or family emergency",
  "Other",
] as const

/** Final stored reason, or null when nothing usable was picked. */
export function composeCancelReason(selected: string, otherText: string): string | null {
  if (!selected) return null
  if (selected === "Other") {
    const text = otherText.trim()
    return text ? `Other: ${text}` : null
  }
  return selected
}

interface CancelReasonPickerProps {
  selected: string
  otherText: string
  error?: boolean
  onSelect: (value: string) => void
  onOtherChange: (value: string) => void
}

/**
 * Compact select dropdown + optional note (shown only for "Other").
 * Shared by the guest and admin cancel dialogs.
 */
export default function CancelReasonPicker({
  selected,
  otherText,
  error = false,
  onSelect,
  onOtherChange,
}: CancelReasonPickerProps) {
  return (
    <div className="text-left">
      <div className="relative">
        <select
          value={selected}
          onChange={(e) => onSelect(e.target.value)}
          aria-label="Reason for cancellation"
          className={cn(
            "w-full cursor-pointer appearance-none rounded-[8px] border border-hairline bg-white",
            "py-2.5 pl-3 pr-9 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary",
            !selected && "text-muted-soft",
            error && !selected && "border-[#dc2626]",
          )}
        >
          <option value="" disabled>
            Select reason…
          </option>
          {CANCEL_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      </div>

      {selected === "Other" && (
        <textarea
          value={otherText}
          onChange={(e) => onOtherChange(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Tell us why…"
          aria-label="Cancellation reason details"
          className={cn(
            "mt-2 w-full resize-none rounded-[8px] border bg-white px-3 py-2 text-[13px] text-ink",
            "placeholder:text-muted-soft focus:outline-none focus:ring-2 focus:ring-primary/15",
            error && !otherText.trim() ? "border-[#dc2626]" : "border-hairline focus:border-primary",
          )}
        />
      )}

      {error && (
        <p className="mt-2 text-[12px] text-[#dc2626]">
          {selected === "Other" ? "Please tell us why." : "Please pick a reason to continue."}
        </p>
      )}
    </div>
  )
}
