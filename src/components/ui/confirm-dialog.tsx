import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"
import LoadingDots from "@/components/LoadingDots"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Plain string, or rich content (e.g. a cancellation-policy list). */
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "default"
  loading?: boolean
  /** Optional text-style overrides for the description (merged over defaults). */
  descriptionClassName?: string
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  descriptionClassName,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent className="!rounded-[16px] !max-w-[400px] !p-0 overflow-hidden">
        <div className="p-6 pb-4">
          {variant === "danger" && (
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}>
                <AlertTriangle className="h-6 w-6 text-ink" />
              </div>
            </div>
          )}
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-semibold text-ink">{title}</DialogTitle>
            {typeof description === "string" ? (
              <DialogDescription className={cn("text-sm text-muted mt-2 leading-relaxed", descriptionClassName)}>{description}</DialogDescription>
            ) : (
              <div className={cn("text-sm text-muted mt-2 leading-relaxed text-left", descriptionClassName)}>{description}</div>
            )}
          </DialogHeader>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1 !rounded-[10px] h-11 border-hairline text-ink font-medium hover:bg-gray-50"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 !rounded-[10px] h-11 font-medium"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "#FBF9F4",
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingDots size="sm" />
                Cancelling...
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
