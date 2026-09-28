import { useRef } from "react"
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react"
import { Download } from "lucide-react"

interface BookingQrProps {
  bookingId: string
  className?: string
}

/**
 * Guest-facing check-in QR — what the guest shows at the front desk.
 * The SVG is for display; the hidden 512px canvas backs the "Save QR code"
 * download so the saved PNG stays sharp when opened on a phone.
 */
export default function BookingQr({ bookingId, className = "" }: BookingQrProps) {
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const value = `${window.location.origin}/verify/${bookingId}`
  const reference = bookingId.slice(0, 8).toUpperCase()

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

  return (
    <div className={`flex items-center gap-4 rounded-[10px] bg-gray-50 p-4 ${className}`}>
      <div className="shrink-0 rounded-[8px] border border-gray-200 bg-white p-2">
        <QRCodeSVG value={value} size={104} level="M" />
      </div>
      <div className="min-w-0">
        <p className="font-mono text-sm font-bold text-ink">#{reference}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Show this QR code at the front desk so staff can confirm it's your booking.
        </p>
        <button
          type="button"
          onClick={handleSave}
          className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Save QR code
        </button>
      </div>
      <div ref={canvasWrapRef} className="hidden" aria-hidden="true">
        <QRCodeCanvas value={value} size={512} level="M" />
      </div>
    </div>
  )
}
