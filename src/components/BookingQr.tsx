import { useRef, useState } from "react"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import { Check, Copy, Download } from "lucide-react"
import { qrLogoSettings } from "@/lib/qrLogo"

interface BookingQrProps {
  bookingId: string
  /** "Valid from Oct 4, 2:00 PM" — shown while the stay hasn't started yet. */
  validFrom?: string
  /** When set, the QR is grayed out and this message replaces the instructions. */
  inactiveMessage?: string
  /** "Oct 4, 2020 · 2:00 PM" — rendered under the card while the booking is live. */
  checkInLabel?: string
  checkOutLabel?: string
  /** QR edge length in px (default 188). */
  size?: number
  /** Hides the "Your Check-in QR" heading and the front-desk line. */
  hideTitle?: boolean
  className?: string
}

/**
 * Guest-facing check-in QR — the visual focus of the Booking Details modal.
 * Centered tinted card: heading → QR → status line → booking ID (copy) →
 * Save QR code → check-in/check-out lines. The SVG is for display; the hidden
 * 512px canvas backs the download so the saved PNG stays sharp on a phone.
 */
export default function BookingQr({
  bookingId,
  validFrom,
  inactiveMessage,
  checkInLabel,
  checkOutLabel,
  size = 188,
  hideTitle = false,
  className = "",
}: BookingQrProps) {
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const value = `${window.location.origin}/verify/${bookingId}`
  const reference = bookingId.slice(0, 8).toUpperCase()
  const inactive = Boolean(inactiveMessage)

  const handleSave = () => {
    const canvas = canvasWrapRef.current?.querySelector("canvas")
    if (!canvas) return
    const link = document.createElement("a")
    link.href = canvas.toDataURL("image/png")
    link.download = `HotelAva-QR-${reference}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`#${reference}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — the ID stays selectable */
    }
  }

  return (
    <div className={`rounded-[12px] border border-primary/10 bg-primary/5 p-5 text-center ${className}`}>
      {!hideTitle && <p className="text-[15px] font-semibold text-ink">Your Check-in QR</p>}

      <div className={`inline-flex rounded-[10px] border border-hairline bg-white p-2.5 ${hideTitle ? "" : "mt-4"}`}>
        <QRCodeSVG
          value={value}
          size={size}
          level="H"
          imageSettings={qrLogoSettings(size)}
          className={inactive ? "opacity-40 grayscale" : undefined}
        />
      </div>

      {(!hideTitle || validFrom || inactive) && (
        <div className="mt-4 space-y-1.5">
          {inactive ? (
            <p className="text-sm text-ink/70">{inactiveMessage}</p>
          ) : (
            <>
              {validFrom && <p className="text-sm font-semibold text-ink">{validFrom}</p>}
              {!hideTitle && <p className="text-sm text-ink/70">Show this at the front desk</p>}
            </>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-center gap-1.5">
        <span className="font-mono text-sm font-bold text-ink select-all">#{reference}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Booking ID copied" : "Copy booking ID"}
          title={copied ? "Copied" : "Copy booking ID"}
          className="cursor-pointer text-muted transition-colors hover:text-primary"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {!inactive && (
        <button
          type="button"
          onClick={handleSave}
          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Save QR code
        </button>
      )}

      {(checkInLabel || checkOutLabel) && (
        <div className="mt-4 space-y-1 border-t border-primary/10 pt-3 text-[13px] text-ink/70">
          {checkInLabel && (
            <p>
              Check-in: <span className="font-medium text-ink">{checkInLabel}</span>
            </p>
          )}
          {checkOutLabel && (
            <p>
              Check-out: <span className="font-medium text-ink">{checkOutLabel}</span>
            </p>
          )}
        </div>
      )}

      <div ref={canvasWrapRef} className="hidden" aria-hidden="true">
        <QRCodeCanvas value={value} size={512} level="H" imageSettings={qrLogoSettings(512)} />
      </div>
    </div>
  )
}
