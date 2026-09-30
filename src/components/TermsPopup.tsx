import { useEffect, useRef } from "react"
import { Link } from "react-router"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { LAST_UPDATED, SECTIONS } from "@/data/terms"

interface TermsPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetId?: string | null
}

export default function TermsPopup({ open, onOpenChange, targetId }: TermsPopupProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const container = scrollRef.current
    if (!container) return
    if (!targetId) {
      container.scrollTop = 0
      return
    }
    const el = container.querySelector<HTMLElement>(`[data-section="${targetId}"]`)
    if (el) container.scrollTop = Math.max(0, el.offsetTop - 4)
  }, [open, targetId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!rounded-[16px] !max-w-[36rem] !p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 pr-12">
          <DialogTitle className="text-lg font-semibold text-ink">Terms &amp; Conditions</DialogTitle>
          <DialogDescription className="text-sm text-muted mt-1 leading-relaxed">
            Last updated {LAST_UPDATED}. Read below, then close this to go straight back to your
            booking — you won't lose anything you already filled in.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollRef} className="relative max-h-[55vh] overflow-y-auto border-t border-hairline px-6 py-4">
          <div className="space-y-3">
            {SECTIONS.map((section) => (
              <section
                key={section.id}
                data-section={section.id}
                className="rounded-[12px] border border-hairline bg-canvas p-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {section.icon}
                  </span>
                  <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
                </div>
                <ul className="mt-2.5 space-y-2">
                  {section.points.map((point) => (
                    <li key={point} className="flex gap-2 text-[13px] text-muted leading-relaxed">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/50" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="rounded-[12px] border border-primary/25 bg-primary/5 p-4">
              <p className="text-[13px] text-ink font-semibold">The short version</p>
              <p className="mt-1 text-[13px] text-muted leading-relaxed">
                Cancel at least 24 hours before check-in and everything you paid online comes back
                automatically, within 7–14 banking days. Inside the 24-hour window — or if you simply
                don't show up — the payment is non-refundable. Once you've checked in, changes go
                through the front desk.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hairline px-6 py-4">
          <Link
            to="/terms"
            onClick={() => onOpenChange(false)}
            className="text-sm text-primary hover:underline"
          >
            Open full page
          </Link>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="!rounded-[10px] px-6 py-2 text-sm font-semibold"
            style={{ backgroundColor: "var(--color-primary)", color: "#FBF9F4" }}
          >
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
