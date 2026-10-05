import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useNavigate } from "react-router"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import BookingQr from "@/components/BookingQr"
import { API_BASE } from "@/lib/apiBase"
import { userBookingsApi, type UserBookingData } from "@/services/api"
import { formatPaymentMethod } from "@/lib/payment"
import { OVERNIGHT_CHECK_IN, OVERNIGHT_CHECK_OUT } from "@/lib/stayWindow"

const PRIMARY = "#82285f"
const CONFETTI_COLORS = ["#82285f", "#9ca3af", "#d1d5db"]
const POLL_MS = 3000
const POLL_MAX_ATTEMPTS = 20

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "Awaiting payment",
  partial: "Partially paid — balance due at the hotel",
  paid: "Paid",
  refunded: "Refunded",
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  })
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

function ConfettiEffect({ onDone }: { onDone: () => void }) {
  const [pieces] = useState(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
    })),
  )

  useEffect(() => {
    const t = window.setTimeout(onDone, 3200)
    return () => window.clearTimeout(t)
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden pointer-events-none" aria-hidden="true">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            borderRadius: p.id % 2 ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
  muted,
}: {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-ink/70">{label}</span>
      <span
        className={`tabular-nums ${mono ? "font-mono select-text " : ""}${muted ? "text-ink/70" : "text-ink"} font-medium text-right`}
      >
        {value}
      </span>
    </div>
  )
}

export default function BookingConfirmation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [booking, setBooking] = useState<UserBookingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [confetti, setConfetti] = useState(false)
  const [pollTimedOut, setPollTimedOut] = useState(false)
  const pollRef = useRef<number | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // One-shot on mount: finalize the payment server-side, then load as owner.
  useEffect(() => {
    if (!id || id === "success") {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        await fetch(`${API_BASE}/bookings/confirm/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      } catch {
        // network blip — the owner GET below decides what to render
      }
      try {
        const data = await userBookingsApi.getOne(id)
        if (!cancelled) setBooking(data)
      } catch (err) {
        console.error("Booking confirmation error:", err)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const refreshOnce = useCallback(async (): Promise<string | null> => {
    if (!id || id === "success") return null
    try {
      const data = await userBookingsApi.getOne(id)
      setBooking(data)
      return data.status
    } catch {
      return null
    }
  }, [id])

  // Pending → poll the owner endpoint. Cleanup on unmount; pause while the
  // tab is hidden and resume (with an immediate tick) when it comes back.
  const pending = booking?.status === "pending" && !!id && id !== "success"
  useEffect(() => {
    if (!pending) return
    let attempts = 0
    const tick = async () => {
      if (document.hidden) return
      attempts += 1
      const status = await refreshOnce()
      if (status && status !== "pending") {
        stopPoll()
        return
      }
      if (attempts >= POLL_MAX_ATTEMPTS) {
        stopPoll()
        setPollTimedOut(true)
      }
    }
    const start = () => {
      stopPoll()
      pollRef.current = window.setInterval(() => {
        void tick()
      }, POLL_MS)
    }
    const onVisibility = () => {
      if (document.hidden) {
        stopPoll()
      } else {
        start()
        void tick()
      }
    }
    if (!document.hidden) {
      start()
      void tick()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stopPoll()
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [pending, refreshOnce, stopPoll])

  // Confetti: confirmed state, once per booking, skipped for reduced motion.
  const confirmed = booking?.status === "confirmed"
  useEffect(() => {
    if (!confirmed || !id || id === "success") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (sessionStorage.getItem(`hv_confetti:${id}`)) return
    sessionStorage.setItem(`hv_confetti:${id}`, "1")
    setConfetti(true)
  }, [confirmed, id])

  if (loading) {
    return (
      <div className="px-base py-6 lg:py-8 flex flex-col items-center justify-center h-full animate-pulse">
        <div className="max-w-[920px] mx-auto">
          <div className="text-center">
            <div className="h-4 bg-gray-200 rounded w-40 mx-auto mb-sm" />
            <div className="h-4 bg-gray-200 rounded w-72 mx-auto mb-sm" />
            <div className="h-4 bg-gray-200 rounded w-96 max-w-full mx-auto mb-lg" />
          </div>

          <div className="grid gap-lg lg:grid-cols-2 items-start">
            <div className="bg-white border border-hairline rounded-[12px] p-lg">
              <div className="rounded-[12px] border border-hairline bg-gray-100 p-2.5 flex justify-center">
                <div className="h-40 w-40 bg-gray-200 rounded-[8px]" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-24 mx-auto mt-md" />
              <div className="h-4 bg-gray-200 rounded w-28 mx-auto mt-sm" />
            </div>

            <div className="space-y-lg">
              <div className="bg-white border border-hairline rounded-[12px] p-lg">
                <div className="h-5 bg-gray-200 rounded w-40 mb-md" />
                <div className="space-y-sm">
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-1/2 ml-auto" />
                </div>
              </div>
              <div className="flex gap-sm">
                <div className="h-10 bg-gray-200 rounded-[12px] w-44" />
                <div className="h-10 bg-gray-100 rounded-[12px] w-36" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-base py-section">
        <div className="max-w-[920px] mx-auto text-center">
          <h1 className="text-base font-semibold text-ink mb-sm">Confirmation Failed</h1>
          <p className="text-sm text-muted mb-lg">
            We couldn't confirm your booking. Please contact support or try again.
          </p>
          <div className="flex flex-col sm:flex-row gap-sm justify-center">
            <Button
              onClick={() => navigate(0)}
              className="!rounded-[12px] px-lg bg-primary text-primary-foreground hover:bg-primary-active"
            >
              Retry
            </Button>
            <Button
              onClick={() => navigate("/")}
              className="!rounded-[12px] px-lg bg-primary text-primary-foreground hover:bg-primary-active"
            >
              Back to Home
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/my-bookings")}
              className="!rounded-[12px] px-lg"
            >
              View My Bookings
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const isDay = booking?.stay_type === "day"
  const checkInLabel = booking?.check_in
    ? isDay
      ? `${fmtDate(booking.check_in)}${booking.start_time ? ` · ${booking.start_time}` : ""}`
      : `${fmtDate(booking.check_in)} · ${OVERNIGHT_CHECK_IN}`
    : ""
  // Day-use stores check_out as check_in + 1 day (range math) — the guest
  // experience is same-day, so the label always uses the check-in date.
  const checkOutLabel = booking?.check_out
    ? isDay
      ? `${fmtDate(booking.check_in)}${fmtTime(booking.end_time) ? ` · ${fmtTime(booking.end_time)}` : ""}`
      : `${fmtDate(booking.check_out)} · ${OVERNIGHT_CHECK_OUT}`
    : ""

  const rawMethod = booking?.payment_method || ""
  const methodLabel =
    rawMethod && !rawMethod.startsWith("awaiting:") && !rawMethod.startsWith("extend:")
      ? formatPaymentMethod(rawMethod)
      : ""

  const hasBreakdown =
    booking && (booking.adults != null || booking.children != null || booking.pets != null)
  const guestParts = hasBreakdown
    ? [
        booking!.adults && booking!.adults > 0
          ? `${booking!.adults} adult${booking!.adults === 1 ? "" : "s"}`
          : null,
        booking!.children && booking!.children > 0
          ? `${booking!.children} ${booking!.children === 1 ? "child" : "children"}`
          : null,
        booking!.pets && booking!.pets > 0
          ? `${booking!.pets} ${booking!.pets === 1 ? "pet" : "pets"}`
          : null,
      ].filter(Boolean)
    : []
  const guestsLabel = guestParts.length > 0 ? guestParts.join(" · ") : String(booking?.guests ?? 1)

  const paymentLabel = booking?.payment_status
    ? PAYMENT_LABEL[booking.payment_status] ?? booking.payment_status
    : ""
  const paidAmount = Math.max(0, booking?.amount_paid ?? 0)
  const balance =
    booking && booking.payment_mode === "downpayment"
      ? Math.max(0, (booking.total_price || 0) - (booking.amount_paid ?? 0))
      : 0

  return (
    <div className="px-base py-6 lg:py-8 flex flex-col items-center justify-center h-full cursor-default select-none">
      {confetti && <ConfettiEffect onDone={() => setConfetti(false)} />}
      <div className="max-w-[920px] mx-auto">
        <div className="text-center">
          <h1 className="text-base font-semibold text-ink mb-sm">Booking confirmed</h1>
          <p className="text-sm text-ink/70 mb-lg">
            Your reservation at Hotel Ava has been confirmed.
            <br />Save this QR code and present it at the front desk upon arrival.
          </p>
        </div>

        <div className="grid gap-lg lg:grid-cols-2 items-start">
          {booking && id && id !== "success" && (
            <div className="bg-white border border-hairline rounded-[12px] p-lg text-left">
              {booking.status === "pending" ? (
                <div className="flex items-center gap-sm py-sm">
                  <span
                    className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-hairline border-t-primary"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-muted" role="status">
                    Verifying your payment…
                  </p>
                </div>
              ) : booking.qr_data ? (
                <BookingQr bookingId={booking.qr_data} size={168} hideTitle />
              ) : (
                <p className="text-sm text-muted">
                  Your QR code will appear here and in My Bookings once your payment is
                  confirmed.
                </p>
              )}
              {pollTimedOut && (
                <p className="text-[13px] text-muted mt-sm">
                  Payment is still processing — you can track it in My Bookings.
                </p>
              )}
            </div>
          )}

          <div className="space-y-lg">
            {booking && (
              <div className="bg-white border border-hairline rounded-[12px] p-lg text-left">
                <h2 className="text-base font-semibold text-ink mb-sm">Booking Details</h2>
                <div className="space-y-sm">
                  {booking.room_name && <DetailRow label="Room" value={booking.room_name} />}
                  {checkInLabel && <DetailRow label="Check-in" value={checkInLabel} />}
                  {checkOutLabel && <DetailRow label="Check-out" value={checkOutLabel} />}
                  {hasBreakdown || booking.guests ? (
                    <DetailRow label="Guests" value={guestsLabel} />
                  ) : null}
                  {paymentLabel && (
                    <DetailRow
                      label="Payment"
                      value={paymentLabel}
                      muted={booking.payment_status !== "paid"}
                    />
                  )}
                  {methodLabel && <DetailRow label="Payment method" value={methodLabel} />}
                  {booking.payment_intent && (
                    <DetailRow label="Payment reference" value={booking.payment_intent} mono />
                  )}
                  {paidAmount > 0 && (
                    <>
                      <div className="tabular-nums flex justify-between font-semibold pt-sm border-t border-hairline">
                        <span className="text-sm text-ink">
                          {booking.payment_mode === "downpayment"
                            ? "Paid Now (50%)"
                            : "Total Paid"}
                        </span>
                        <span className="text-sm" style={{ color: PRIMARY }}>
                          ₱{paidAmount.toLocaleString()}
                        </span>
                      </div>
                      {balance > 0 && (
                        <div className="tabular-nums flex justify-between text-sm">
                          <span className="text-ink/70">Balance due at the hotel</span>
                          <span className="text-ink">₱{balance.toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-sm justify-start">
              <Button
                onClick={() => navigate("/my-bookings")}
                className="!rounded-[12px] px-lg bg-primary text-primary-foreground hover:bg-primary-active"
              >
                View my bookings
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="!rounded-[12px] px-lg"
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
