import { useEffect, useState } from "react"
import { useParams, Link } from "react-router"
import { CheckCircle, XCircle, CalendarDays, User, BedDouble, Clock } from "lucide-react"
import { verifyApi, ApiError, type VerifyBookingData } from "@/services/api"
import LoadingDots from "@/components/LoadingDots"

type Phase = "loading" | "ok" | "missing" | "error"

function formatDate(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-hairline/60 last:border-0">
      <span className="mt-0.5 text-muted shrink-0">{icon}</span>
      <span className="w-24 shrink-0 typo-body-sm text-muted">{label}</span>
      <span className="typo-body-sm font-semibold text-ink text-right ml-auto break-words">{value}</span>
    </div>
  )
}

function statusLook(status: string) {
  switch (status) {
    case "confirmed":
      return { icon: <CheckCircle className="h-10 w-10" />, title: "Booking Verified", sub: "Valid for check-in", tone: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    case "pending":
      return { icon: <Clock className="h-10 w-10" />, title: "Booking Found", sub: "Still awaiting confirmation", tone: "text-amber-600", chip: "bg-amber-50 text-amber-700 border-amber-200" }
    case "cancelled":
      return { icon: <XCircle className="h-10 w-10" />, title: "Booking Cancelled", sub: "Not valid for check-in", tone: "text-rose-600", chip: "bg-rose-50 text-rose-700 border-rose-200" }
    default:
      return { icon: <CheckCircle className="h-10 w-10" />, title: "Booking Found", sub: "Status on file", tone: "text-primary", chip: "bg-primary/10 text-primary border-primary/30" }
  }
}

export default function VerifyBooking() {
  const { id } = useParams<{ id: string }>()
  const [phase, setPhase] = useState<Phase>("loading")
  const [data, setData] = useState<VerifyBookingData | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    if (!id) {
      setPhase("missing")
      return
    }
    setPhase("loading")
    setData(null)
    verifyApi
      .get(id)
      .then((booking) => {
        if (active) {
          setData(booking)
          setPhase("ok")
        }
      })
      .catch((err: unknown) => {
        if (!active) return
        setPhase(err instanceof ApiError && err.status === 404 ? "missing" : "error")
      })
    return () => {
      active = false
    }
  }, [id, attempt])

  const look = data ? statusLook(data.status) : null

  return (
    <div className="px-base py-section">
      <div className="max-w-[520px] mx-auto">
        <div className="text-center mb-lg">
          <p className="typo-caption font-display font-semibold uppercase tracking-[0.2em] text-primary">Hotel Ava</p>
          <h1 className="typo-display-md text-ink mt-xs">Booking Verification</h1>
          <p className="typo-body-sm text-muted mt-xs">Malate · Manila · Philippines</p>
        </div>

        <div className="bg-white border border-hairline rounded-[16px] overflow-hidden shadow-card-hover">
          {phase === "loading" && (
            <div className="py-section flex flex-col items-center gap-base">
              <LoadingDots />
              <p className="typo-body-sm text-muted">Checking booking…</p>
            </div>
          )}

          {phase === "missing" && (
            <div className="py-xl px-lg text-center">
              <XCircle className="h-10 w-10 text-rose-600 mx-auto" />
              <h2 className="typo-display-sm text-ink mt-sm">Invalid QR code</h2>
              <p className="typo-body-sm text-muted mt-xs">
                No booking matches this code. Ask the guest to open{" "}
                <span className="font-semibold text-ink">My Bookings</span> and show the QR code again.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="py-xl px-lg text-center">
              <XCircle className="h-10 w-10 text-amber-600 mx-auto" />
              <h2 className="typo-display-sm text-ink mt-sm">Couldn't verify right now</h2>
              <p className="typo-body-sm text-muted mt-xs">Something went wrong on our end — please try again.</p>
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="typo-button-sm mt-base bg-ink text-on-primary rounded-full px-6 py-2 hover:bg-primary-active transition-colors cursor-pointer"
              >
                Try again
              </button>
            </div>
          )}

          {phase === "ok" && data && look && (
            <>
              <div className={`px-lg py-lg border-b border-hairline text-center ${data.status === "cancelled" ? "bg-rose-50" : data.status === "confirmed" ? "bg-emerald-50" : "bg-amber-50"}`}>
                <span className={look.tone}>{look.icon}</span>
                <h2 className="typo-display-sm text-ink mt-xs">{look.title}</h2>
                <p className="typo-body-sm text-muted mt-xs">{look.sub}</p>
              </div>

              <div className="px-lg py-base">
                <Row icon={<BedDouble className="h-4 w-4" />} label="Reference" value={`#${data.reference}`} />
                <Row icon={<User className="h-4 w-4" />} label="Guest" value={data.guest_name || "—"} />
                <Row icon={<BedDouble className="h-4 w-4" />} label="Room" value={`${data.room_name}${data.room_type ? ` · ${data.room_type}` : ""}`} />
                <Row
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Stay"
                  value={
                    data.stay_type === "day"
                      ? `${formatDate(data.check_in)} · ${data.start_time || "—"}${data.duration ? ` (${data.duration}h)` : ""}`
                      : `${formatDate(data.check_in)} → ${formatDate(data.check_out)}`
                  }
                />
                <Row icon={<User className="h-4 w-4" />} label="Guests" value={String(data.guests ?? 1)} />
                <div className="flex items-center justify-between pt-3">
                  <span className="typo-body-sm text-muted">Status</span>
                  <span className={`typo-body-sm font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full border ${look.chip}`}>
                    {data.status}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="typo-caption-sm text-muted text-center mt-base">
          Verified live from Hotel Ava's booking system ·{" "}
          <Link to="/" className="text-primary hover:underline">hotelava.ph</Link>
        </p>
      </div>
    </div>
  )
}
