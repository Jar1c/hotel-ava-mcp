import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { verifyApi, ApiError, type VerifyBookingData } from "@/services/api"
import ReceiptDialog, { type ReceiptData } from "@/components/ReceiptDialog"
import { formatPaymentMethod } from "@/lib/payment"
import { QrCode, Camera, CheckCircle, XCircle, Upload } from "lucide-react"
import jsQR from "jsqr"

type Result =
  | { kind: "idle" }
  | { kind: "found"; data: VerifyBookingData }
  | { kind: "invalid" }
  | { kind: "unreadable" }
  | { kind: "error"; message: string }

type CameraState = "off" | "on" | "unsupported" | "denied"

type DetectSource = HTMLVideoElement | HTMLImageElement
type Detector = { detect(source: DetectSource): Promise<Array<{ rawValue: string }>> }
type BarcodeCtor = new (opts: { formats: string[] }) => Detector

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** QR payload → booking id: full UUID, /verify/<id> link, or #ABC12345 code. */
function extractCode(raw: string): string {
  const s = raw.trim()
  const uuid = s.match(UUID_RE)
  if (uuid) return uuid[0]
  const link = s.match(/verify\/([A-Za-z0-9-]{6,})/)
  if (link) return link[1]
  return s.replace(/^#/, "")
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime())
    ? String(iso)
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/**
 * Read the QR out of an uploaded photo/screenshot. Returns null when the image
 * holds no readable QR code — that is the "invalid QR" case. Native decoder
 * first (handles photos best), jsQR pixel fallback for every other browser.
 */
async function decodeQrFromImage(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()

    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeCtor }).BarcodeDetector
    if (Ctor) {
      try {
        const codes = await new Ctor({ formats: ["qr_code"] }).detect(img)
        const native = codes[0]?.rawValue
        if (native) return native
      } catch {
        // Native decoder declined the image — fall through to jsQR.
      }
    }

    const width = img.naturalWidth
    const height = img.naturalHeight
    if (!width || !height) return null
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(img, 0, 0)
    const pixels = ctx.getImageData(0, 0, width, height)
    return jsQR(pixels.data, width, height)?.data ?? null
  } catch {
    // Corrupt or unsupported file — nothing to decode.
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function paymentNote(status: string): string {
  if (status === "pending") return "Awaiting payment"
  if (status === "confirmed" || status === "completed" || status === "checked-out") return "Paid"
  if (status === "cancelled") return "Cancelled"
  return "—"
}

function nightsBetween(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 1
  const ms =
    Date.parse(`${checkOut.slice(0, 10)}T00:00:00`) - Date.parse(`${checkIn.slice(0, 10)}T00:00:00`)
  const nights = Math.round(ms / 86_400_000)
  return Number.isFinite(nights) && nights > 0 ? nights : 1
}

/** Scan result → the shared receipt shape (mirrors BookingsTable's mapping). */
function receiptFor(d: VerifyBookingData): ReceiptData {
  const isDay = d.stay_type === "day"
  const nights = nightsBetween(d.check_in, d.check_out)
  const roomName = d.room_name
  return {
    reference: d.reference,
    fullReference: d.id,
    issuedAt: d.created_at || null,
    guestName: d.guest_name,
    guestEmail: d.email,
    guestPhone: d.phone,
    roomName,
    roomDetail: d.room_type && d.room_type !== roomName ? d.room_type : undefined,
    checkInLabel: formatDate(d.check_in),
    checkOutLabel: isDay ? undefined : formatDate(d.check_out),
    stayLabel: isDay
      ? `Day use${d.duration ? ` · ${d.duration} hours` : ""}${d.start_time ? ` from ${d.start_time}` : ""}`
      : `${nights} night${nights === 1 ? "" : "s"}`,
    guests: d.guests,
    total: Number(d.total_price) || 0,
    // The verify payload carries no room rate, so no rate/discount line.
    gross: null,
    itemLabel: isDay
      ? `${roomName} · day use`
      : `${roomName} × ${nights} night${nights === 1 ? "" : "s"}`,
    paymentMethod: formatPaymentMethod(d.payment_method || "", "Not set"),
    paymentStatus: paymentNote(d.status),
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function VerifyQrDialog({ open, onOpenChange }: Props) {
  const [value, setValue] = useState("")
  const [result, setResult] = useState<Result>({ kind: "idle" })
  const [busy, setBusy] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [cam, setCam] = useState<CameraState>("off")
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    for (const track of streamRef.current?.getTracks() ?? []) track.stop()
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCam((prev) => (prev === "on" ? "off" : prev))
  }, [])

  const verifyCode = useCallback(async (raw: string) => {
    const code = extractCode(raw)
    if (!code) return
    setBusy(true)
    setResult({ kind: "idle" })
    try {
      const data = await verifyApi.get(code)
      setResult({ kind: "found", data })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setResult({ kind: "invalid" })
      } else {
        setResult({ kind: "error", message: err instanceof Error ? err.message : "Verification failed" })
      }
    } finally {
      setBusy(false)
    }
  }, [])

  const startCamera = useCallback(async () => {
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeCtor }).BarcodeDetector
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) {
      setCam("unsupported")
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      streamRef.current = stream
      setCam("on")
    } catch {
      setCam("denied")
    }
  }, [])

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      if (!file.type.startsWith("image/")) {
        setResult({ kind: "unreadable" })
        return
      }
      setBusy(true)
      setResult({ kind: "idle" })
      const raw = await decodeQrFromImage(file)
      if (!raw) {
        setResult({ kind: "unreadable" })
        setBusy(false)
        return
      }
      setValue(raw)
      await verifyCode(raw) // owns the busy flag from here on
    },
    [verifyCode],
  )

  // Closing the dialog must release the camera
  useEffect(() => {
    if (!open) stopCamera()
  }, [open, stopCamera])

  // Live QR loop while the camera runs (BarcodeDetector is Chrome/Edge built-in)
  useEffect(() => {
    if (cam !== "on") return
    const video = videoRef.current
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeCtor }).BarcodeDetector
    if (!video || !Ctor) return

    let cancelled = false
    const detector = new Ctor({ formats: ["qr_code"] })
    video.srcObject = streamRef.current
    void video.play().catch(() => {})

    const tick = async () => {
      if (cancelled) return
      try {
        const codes = await detector.detect(video)
        const first = codes[0]
        if (first?.rawValue) {
          const raw = first.rawValue
          stopCamera()
          setValue(raw)
          await verifyCode(raw)
          return
        }
      } catch {
        // Frame not ready yet — keep scanning.
      }
      if (!cancelled) rafRef.current = requestAnimationFrame(() => void tick())
    }
    rafRef.current = requestAnimationFrame(() => void tick())

    return () => {
      cancelled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [cam, stopCamera, verifyCode])

  const stayLabel = (d: VerifyBookingData) =>
    d.stay_type === "day"
      ? `${formatDate(d.check_in)}${d.start_time ? ` · ${d.start_time}` : ""}`
      : `${formatDate(d.check_in)} → ${formatDate(d.check_out)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!rounded-[16px] !max-w-[440px] !p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e2e4e8]">
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-[#82285f]" />
            Verify guest QR code
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          {/* Camera */}
          <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-[10px] bg-[#0f1115]">
            {cam === "on" ? (
              <>
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                <div className="pointer-events-none absolute inset-6 rounded-[8px] border-2 border-white/60" />
              </>
            ) : (
              <div className="px-5 text-center">
                <Camera className="h-6 w-6 text-white/70 mx-auto" />
                <p className="mt-2 text-xs text-white/70">
                  {cam === "unsupported"
                    ? "Camera scanning isn't supported in this browser — enter the code below."
                    : cam === "denied"
                      ? "Camera access was blocked. Allow it in your browser, or enter the code below."
                      : "Point the camera at the guest's QR code."}
                </p>
                {(cam === "off" || cam === "denied") && (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="mt-3 cursor-pointer text-xs font-semibold text-white underline"
                  >
                    {cam === "denied" ? "Try again" : "Start camera"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Upload — verify from a saved QR image instead of a live scan */}
          <label
            className={`flex items-center justify-center gap-2 rounded-[8px] border border-dashed border-[#c9ccd3] bg-white px-3 py-2.5 text-xs font-semibold text-muted transition-colors ${
              busy
                ? "pointer-events-none opacity-60"
                : "cursor-pointer hover:border-[#82285f] hover:text-[#82285f]"
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload QR image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                void handleFile(file)
              }}
            />
          </label>

          {/* Manual entry — also how you verify when the camera is unavailable */}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void verifyCode(value)
            }}
          >
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Paste the QR link or type #6D8ED17E"
              className="min-w-0 flex-1 rounded-[8px] border border-[#e2e4e8] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[#82285f]"
            />
            <Button type="submit" disabled={busy || !value.trim()} className="!rounded-[8px]">
              {busy ? "…" : "Verify"}
            </Button>
          </form>

          {/* Result */}
          {result.kind === "found" && (
            <div className="rounded-[10px] border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-800">Booking found</p>
                <span className="ml-auto rounded-full border border-emerald-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  {result.data.status}
                </span>
              </div>
              <dl className="mt-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-emerald-700">Guest</dt>
                  <dd className="text-right font-semibold text-emerald-950">{result.data.guest_name || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-emerald-700">Room</dt>
                  <dd className="text-right font-semibold text-emerald-950">{result.data.room_name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-emerald-700">Guests</dt>
                  <dd className="text-right font-semibold text-emerald-950">
                    {result.data.guests ?? 1} {Number(result.data.guests ?? 1) === 1 ? "guest" : "guests"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-emerald-700">Stay</dt>
                  <dd className="text-right font-semibold text-emerald-950">{stayLabel(result.data)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-emerald-700">Reference</dt>
                  <dd className="font-mono font-semibold text-emerald-950">#{result.data.reference}</dd>
                </div>
              </dl>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReceiptOpen(true)}
                className="mt-3 w-full !rounded-[8px] gap-2"
              >
                View Receipt
              </Button>
            </div>
          )}

          {result.kind === "invalid" && (
            <div className="flex items-start gap-2 rounded-[10px] border border-rose-200 bg-rose-50 p-4">
              <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-bold text-rose-800">No booking matches this code</p>
                <p className="mt-1 text-xs text-rose-700">
                  Ask the guest to reopen My Bookings and show the QR code again.
                </p>
              </div>
            </div>
          )}

          {result.kind === "unreadable" && (
            <div className="flex items-start gap-2 rounded-[10px] border border-rose-200 bg-rose-50 p-4">
              <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-bold text-rose-800">Invalid QR code</p>
                <p className="mt-1 text-xs text-rose-700">
                  We couldn't read a QR code from that image. Try a sharper photo — or paste the
                  booking code below.
                </p>
              </div>
            </div>
          )}

          {result.kind === "error" && (
            <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 p-4">
              <XCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-bold text-amber-800">Couldn't verify</p>
                <p className="mt-1 text-xs text-amber-700">{result.message}</p>
              </div>
            </div>
          )}

          {result.kind === "idle" && !busy && (
            <p className="text-center text-xs text-muted">
              Scan, upload, or enter the booking code to verify a guest.
            </p>
          )}
        </div>

        {/* Official receipt for the verified booking */}
        {result.kind === "found" && (
          <ReceiptDialog
            open={receiptOpen}
            onClose={() => setReceiptOpen(false)}
            data={receiptFor(result.data)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
