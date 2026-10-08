import { useCallback, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { verifyApi, bookingsApi, ApiError, type VerifyBookingData } from "@/services/api"
import ReceiptDialog, { type ReceiptData } from "@/components/ReceiptDialog"
import { formatPaymentMethod } from "@/lib/payment"
import {
  deriveArrival,
  startMomentLabel,
  arrivalTimeLabel,
  minutesUntilStart,
  canCheckIn,
  stayRangeLabel,
} from "@/lib/arrival"
import { QrCode, Camera, CheckCircle, XCircle, Upload, ArrowLeft, Clock, Copy, Check } from "lucide-react"
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

/** "Maria Santos" — booking name first, then the account's; no account → say so. */
function guestLabel(d: VerifyBookingData): string {
  const name = (d.guest_name || "").trim()
  if (name) return name
  if (!d.user_id) return "Former Guest"
  return (d.email || "").trim() || "Guest"
}

/** "2 adults, 1 child, 1 pet" — falls back to the total for pre-migration bookings. */
function guestsLabel(d: VerifyBookingData): string {
  const parts: string[] = []
  if (d.adults != null) parts.push(`${d.adults} adult${d.adults === 1 ? "" : "s"}`)
  if (d.children) parts.push(`${d.children} ${d.children === 1 ? "child" : "children"}`)
  if (d.pets) parts.push(`${d.pets} pet${d.pets === 1 ? "" : "s"}`)
  if (parts.length > 0) return parts.join(", ")
  const n = Number(d.guests ?? 1)
  return `${n} ${n === 1 ? "guest" : "guests"}`
}

type StatusLine = { text: string; cls: string; Icon: typeof CheckCircle }

/**
 * The one line that says whether check-in may happen right now — it replaces
 * the old "Booking found" heading, the status pill, and the arrival badge.
 */
function statusLine(d: VerifyBookingData, now: Date, owed = 0): StatusLine {
  const state = deriveArrival(d, now)
  const startLabel = startMomentLabel(d)
  const arrivedAt = arrivalTimeLabel(d.checked_in_at)

  if (state === "ended") {
    if (d.status === "cancelled") return { text: "Cancelled", cls: "text-rose-700", Icon: XCircle }
    if (d.status === "checked-out") return { text: "Checked out — stay is over", cls: "text-muted", Icon: XCircle }
    return { text: "Stay is over", cls: "text-muted", Icon: XCircle }
  }
  if (state === "in_house") {
    return {
      text: `In house${arrivedAt ? ` · checked in ${arrivedAt}` : ""}`,
      cls: "text-[#2d5a3e]",
      Icon: CheckCircle,
    }
  }
  if (state === "early") {
    return {
      text: `Checked in early${startLabel ? ` · stay starts ${startLabel}` : ""}`,
      cls: "text-amber-700",
      Icon: Clock,
    }
  }
  if (d.status !== "confirmed") {
    return {
      text: "Not yet. Check-in opens once the booking is confirmed",
      cls: "text-amber-700",
      Icon: Clock,
    }
  }
  const until = minutesUntilStart(d, now)
  if (until !== null && until > 0) {
    return {
      text: `Not yet. Check-in opens ${startLabel || "on the check-in date"}`,
      cls: "text-amber-700",
      Icon: Clock,
    }
  }
  if (owed > 0) {
    return {
      text: `Balance ₱${owed.toLocaleString()} due — collect before check-in`,
      cls: "text-amber-700",
      Icon: Clock,
    }
  }
  if (canCheckIn(d, now)) return { text: "Ready to check in", cls: "text-[#2d5a3e]", Icon: CheckCircle }
  return {
    text: startLabel ? `Not yet. Check-in opens ${startLabel}` : "Check-in unavailable",
    cls: "text-amber-700",
    Icon: Clock,
  }
}

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

function paymentNote(status: string, downpayment = false, balance = 0): string {
  if (status === "pending") return downpayment ? "Awaiting downpayment" : "Awaiting payment"
  if (status === "cancelled") return "Cancelled"
  if (status === "confirmed" || status === "completed" || status === "checked-out") {
    return downpayment ? (balance > 0 ? "Downpayment · balance due" : "Paid in full") : "Paid"
  }
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
  const downpayment = d.payment_mode === "downpayment"
  const total = Number(d.total_price) || 0
  const balance = downpayment ? Math.max(0, total - (d.amount_paid ?? 0)) : 0
  return {
    reference: d.reference,
    fullReference: d.id,
    issuedAt: d.created_at || null,
    guestName: d.guest_name ?? "",
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
    total,
    // The verify payload carries no room rate, so no rate/discount line.
    gross: null,
    itemLabel: isDay
      ? `${roomName} · day use`
      : `${roomName} × ${nights} night${nights === 1 ? "" : "s"}`,
    paymentMethod: formatPaymentMethod(d.payment_method || "", "Not set"),
    paymentStatus: paymentNote(d.status, downpayment, balance),
    paymentMode: downpayment ? "downpayment" : "full",
    amountPaid: downpayment ? Math.max(0, d.amount_paid ?? 0) : Number(d.total_price) || 0,
    balanceDue: balance,
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
  const [settling, setSettling] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  // Arrival is derived from the clock, so keep the clock moving while this
  // dialog is open — an "arrived early" banner flips to "In-house" on its own
  // when the booked time arrives, with nobody refetching anything.
  const [now, setNow] = useState(() => new Date())
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [copied, setCopied] = useState(false)
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

  // After a scan the camera block is replaced by the result card — this puts
  // the scanner back (the code stays so Verify can be pressed again).
  const backToScanner = useCallback(() => {
    setResult({ kind: "idle" })
    setActionError(null)
  }, [])

  const copyReference = useCallback(async (ref: string) => {
    try {
      await navigator.clipboard.writeText(`#${ref}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable — the ID stays selectable */
    }
  }, [])

  const verifyCode = useCallback(async (raw: string) => {
    const code = extractCode(raw)
    if (!code) return
    setBusy(true)
    setActionError(null)
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

  // Re-render every 15s while open so arrival_state flips at the booked time.
  useEffect(() => {
    if (!open) return
    setNow(new Date())
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [open])

  // Front desk stamps the guest's arrival. The stamp alone does NOT start the
  // stay — deriveArrival() decides that from the clock, so an early scan just
  // records "arrived" and turns into "In-house" when the booked time passes.
  const checkInGuest = useCallback(async () => {
    if (result.kind !== "found" || checkingIn) return
    const bid = result.data.id
    setCheckingIn(true)
    setActionError(null)
    try {
      await bookingsApi.checkIn(bid)
      await verifyCode(value || bid)
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Couldn't check the guest in. Please try again.",
      )
    } finally {
      setCheckingIn(false)
    }
  }, [result, checkingIn, value, verifyCode])

  // Front desk collects the outstanding balance (cash / card at the counter).
  // Re-verifies afterwards so the balance line and receipt both update.
  const settleBalance = useCallback(async () => {
    if (result.kind !== "found" || settling) return
    const d = result.data
    const bid = d.id
    setSettling(true)
    setActionError(null)
    try {
      await bookingsApi.settleBalance(bid)
      await verifyCode(value || bid)
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Couldn't record the payment. Please try again.",
      )
    } finally {
      setSettling(false)
    }
  }, [result, settling, value, verifyCode])

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
          {/* Scanner — dropped entirely once a code has been verified, so the
              dialog stays short; the button below brings it back. */}
          {result.kind === "idle" ? (
            <>
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
              aria-label="QR link or booking code"
              className="min-w-0 flex-1 rounded-[8px] border border-[#e2e4e8] bg-white px-3 py-2 text-sm text-ink outline-none focus:border-[#82285f]"
            />
            <Button type="submit" disabled={busy || !value.trim()} className="!rounded-[8px]">
              {busy ? "…" : "Verify"}
            </Button>
          </form>
            </>
          ) : (
            <button
              type="button"
              onClick={backToScanner}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] border border-[#e2e4e8] bg-white px-3 py-2.5 text-xs font-semibold text-muted transition-colors hover:border-[#82285f] hover:text-[#82285f]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to camera
            </button>
          )}

          {/* Result */}
          {result.kind === "found" && (() => {
            const d = result.data
            const state = deriveArrival(d, now)

            // One line of payment truth: paid in full, or what's still due.
            const total = Number(d.total_price) || 0
            const down = d.payment_mode === "downpayment"
            const paid = down || d.status === "pending" ? Math.max(0, d.amount_paid ?? 0) : total
            const balance = Math.max(0, total - paid)
            const pay = {
              balance,
              showSettle: d.status !== "cancelled" && balance > 0,
              text:
                d.status === "cancelled"
                  ? "Cancelled"
                  : balance > 0
                    ? `Balance ₱${balance.toLocaleString()} due`
                    : total > 0
                      ? `Paid in full, ₱${total.toLocaleString()}`
                      : "No payment due",
            }
            const ready = canCheckIn(d, now) && (minutesUntilStart(d, now) ?? 0) <= 0
            const status = statusLine(d, now, pay.showSettle ? pay.balance : 0)

            return (
            <div className="overflow-hidden rounded-[10px] border border-[#e2e4e8] bg-white">
              {d.room_image && (
                <img src={d.room_image} alt={d.room_name} className="h-[140px] w-full object-cover" />
              )}
              <div className="p-4">
              {/* The single status line — ready, or exactly why not */}
              <div className="flex items-center gap-2">
                <status.Icon className={`h-4 w-4 shrink-0 ${status.cls}`} />
                <p className={`text-[13px] font-semibold ${status.cls}`}>{status.text}</p>
              </div>

              {/* Who showed up and where they stay — the loudest line */}
              <p className="mt-3 text-[16px] font-semibold leading-snug text-ink">
                {guestLabel(d)}, {d.room_name}
              </p>
              {d.email && d.email !== guestLabel(d) && (
                <p className="mt-0.5 text-[13px] text-muted">{d.email}</p>
              )}

              <dl className="mt-3 space-y-1.5 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Stay</dt>
                  <dd className="text-right font-semibold text-ink">{stayRangeLabel(d)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Guests</dt>
                  <dd className="text-right font-semibold text-ink">{guestsLabel(d)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Payment</dt>
                  <dd className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-right font-semibold">
                    <span
                      className={
                        d.status !== "cancelled" && pay.balance > 0 ? "text-[#b45309]" : "text-ink"
                      }
                    >
                      {pay.text}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Booking ID</dt>
                  <dd className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-ink select-all">
                      #{d.reference}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyReference(d.reference)}
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
                  </dd>
                </div>
              </dl>

              {actionError && (
                <p className="mt-3 rounded-[6px] border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-700">
                  {actionError}
                </p>
              )}

              {/* Actions — check in is gated by the clock; receipt is a link */}
              <div className="mt-4 space-y-2">
                {pay.showSettle && (
                  <Button
                    type="button"
                    onClick={() => void settleBalance()}
                    disabled={settling}
                    className="w-full !rounded-[8px] gap-2 bg-[#82285f] text-white hover:bg-[#6a1f4d] disabled:bg-[#d6d9de] disabled:text-[#9aa0a6]"
                  >
                    {settling
                      ? "Saving…"
                      : d.status === "pending"
                        ? `Collect ₱${pay.balance.toLocaleString()} & confirm`
                        : `Collect ₱${pay.balance.toLocaleString()}`}
                  </Button>
                )}
                <div className="flex items-center gap-4">
                  {state === "none" && (
                    <Button
                      type="button"
                      onClick={() => void checkInGuest()}
                      disabled={!ready || checkingIn || pay.showSettle}
                      className="flex-1 !rounded-[8px] gap-2 bg-[#3D6B4F] text-white hover:bg-[#2d5a3e] disabled:bg-[#d6d9de] disabled:text-[#9aa0a6]"
                    >
                      {checkingIn ? "Checking in…" : "Check in"}
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    className="cursor-pointer text-xs font-semibold text-[#82285f] hover:underline"
                  >
                    View receipt
                  </button>
                </div>
              </div>
              </div>
            </div>
            )
          })()}

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
