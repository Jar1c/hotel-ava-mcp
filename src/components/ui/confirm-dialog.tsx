import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "default"
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
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!rounded-[16px] !max-w-[400px] !p-0 overflow-hidden">
        <div className="p-6 pb-4">
          {variant === "danger" && (
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-[#A4423A]" />
              </div>
            </div>
          )}
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-semibold text-ink">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted mt-2 leading-relaxed">{description}</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 !rounded-[10px] h-11 border-hairline text-ink font-medium hover:bg-gray-50"
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
            className="flex-1 !rounded-[10px] h-11 font-medium"
            style={{
              backgroundColor: variant === "danger" ? "#A4423A" : "#82285f",
              color: "#FBF9F4",
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
