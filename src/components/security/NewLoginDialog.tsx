import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldAlert, MonitorSmartphone } from "lucide-react"
import LoadingDots from "@/components/LoadingDots"
import type { NotificationData } from "@/services/api"

interface NewLoginDialogProps {
  notif: NotificationData | null
  onClose: () => void
  onTrust: (notif: NotificationData) => Promise<void>
  onSecureAccount: (notif: NotificationData) => void
}

/**
 * Security alert shown when a sign-in was detected from an unknown device.
 * "Yes, this was me" trusts the device so it never asks again; "No" takes the
 * user to the password-change screen.
 */
export default function NewLoginDialog({ notif, onClose, onTrust, onSecureAccount }: NewLoginDialogProps) {
  const [busy, setBusy] = useState(false)

  const handleTrust = async () => {
    if (!notif || busy) return
    setBusy(true)
    try {
      await onTrust(notif)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!notif} onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="!rounded-[16px] !max-w-[400px] !p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <div className="flex justify-center mb-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "color-mix(in srgb, #A4423A 12%, transparent)" }}
            >
              <ShieldAlert className="h-6 w-6 text-[#A4423A]" />
            </div>
          </div>
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-semibold text-ink">Was this you?</DialogTitle>
            <DialogDescription className="text-sm text-muted mt-2 leading-relaxed">
              {notif?.message}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-hairline bg-surface-soft px-3.5 py-3">
            <MonitorSmartphone className="size-4 text-muted mt-0.5 shrink-0" />
            <p className="text-xs text-muted leading-relaxed">
              If this wasn't you, change your password now — anyone with your password can see your
              bookings and personal details.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 px-6 pb-6">
          <Button
            onClick={handleTrust}
            disabled={busy}
            className="w-full !rounded-[10px] h-11 font-medium"
            style={{ backgroundColor: "var(--color-primary)", color: "#FBF9F4" }}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <LoadingDots size="sm" />
                Saving...
              </span>
            ) : (
              "Yes, this was me"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => notif && onSecureAccount(notif)}
            disabled={busy}
            className="w-full !rounded-[10px] h-11 border-hairline text-ink font-medium hover:bg-gray-50"
          >
            No, secure my account
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
