import { useCallback, useEffect, useRef, useState } from "react"
import { Clock } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/** Minutes without any mouse / keyboard / scroll / touch activity before the warning. */
const IDLE_MS = 5 * 60 * 1000

const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const

/**
 * Global "Are you still there?" reminder for the guest-facing site (Netflix /
 * YouTube style — a question, never a forced sign-out).
 *
 * After 5 minutes without any real user input the warning pops up and stays
 * up until it is answered. Only the two explicit controls dismiss it — the X
 * button and "Yes, I'm here" — while backdrop clicks, the Esc key and focus
 * changes are ignored, so a stray click can never make it vanish. Answering it
 * restarts the idle clock. It is only mounted inside RootLayout, so admin
 * pages are not affected. Network/polling activity does NOT reset the clock —
 * only real user input does.
 */
export default function InactivityGuard() {
  const [open, setOpen] = useState(false)
  const lastActivity = useRef(Date.now())

  // 1. Track real user activity. Ignored while the warning is open so a stray
  //    mouse move can't re-open it immediately after it closes.
  useEffect(() => {
    const onActivity = () => {
      if (!open) lastActivity.current = Date.now()
    }
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true })
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity)
    }
  }, [open])

  // 2. One ticking clock: opens the warning after IDLE_MS of silence.
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!open && Date.now() - lastActivity.current >= IDLE_MS) setOpen(true)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [open])

  const dismiss = useCallback(() => {
    lastActivity.current = Date.now()
    setOpen(false)
  }, [])

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(next, details) => {
        // Only Dialog.Close (the X) reports reason "close-press" here; the
        // "Yes, I'm here" button calls dismiss() directly. Everything else
        // (outside press, Esc, focus-out) must leave the warning open.
        if (next || details.reason !== "close-press") return
        dismiss()
      }}
    >
      <DialogContent className="!max-w-[400px] !overflow-hidden !rounded-[16px] !p-0">
        <div className="p-6 pb-4 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)" }}
          >
            <Clock className="h-6 w-6 text-ink" />
          </div>
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-semibold text-ink">Are you still there?</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-muted">
              You&apos;ve been inactive for 5 minutes. Tap below to keep browsing Hotel Ava.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          <Button
            onClick={dismiss}
            className="h-11 w-full !rounded-[10px] font-medium"
            style={{ backgroundColor: "var(--color-primary)", color: "#FBF9F4" }}
          >
            Yes, I&apos;m here
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
