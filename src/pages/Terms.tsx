import { useEffect } from "react"
import { Link } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { LAST_UPDATED, SECTIONS } from "@/data/terms"

export default function Terms() {
  const { isAuthenticated } = useAuth()
  // Footer / sign-in links point at /terms#privacy — jump once the section mounts.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div className="bg-canvas min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="typo-caption-sm font-semibold uppercase tracking-wider text-primary">
          Hotel Ava
        </p>
        <h1 className="typo-display-lg text-ink mt-1">Terms & Conditions</h1>
        <p className="typo-body-sm text-muted mt-2">
          Last updated {LAST_UPDATED}. Please read these terms carefully before booking.
        </p>

        <div className="mt-8 space-y-4">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="rounded-[12px] border border-hairline bg-white p-5 sm:p-6"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {section.icon}
                </span>
                <h2 className="typo-title-md text-ink">{section.title}</h2>
              </div>
              <ul className="mt-3 space-y-2.5">
                {section.points.map((point) => (
                  <li key={point} className="flex gap-2.5 typo-body-sm text-muted leading-relaxed">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/50" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-[12px] border border-primary/25 bg-primary/5 p-5">
          <p className="typo-body-sm text-ink font-semibold">The short version</p>
          <p className="typo-body-sm text-muted mt-1 leading-relaxed">
            Cancel at least 24 hours before check-in and everything you paid online comes
            back automatically, within 7–14 banking days. Inside the 24-hour window — or if
            you simply don't show up — the payment is non-refundable. Once you've checked
            in, changes go through the front desk.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 typo-caption-sm text-muted">
          <Link to="/" className="text-primary hover:underline">Back to home</Link>
          <Link to="/rooms" className="text-primary hover:underline">Browse rooms</Link>
          {isAuthenticated ? (
            <Link to="/my-bookings" className="text-primary hover:underline">My Bookings</Link>
          ) : (
            <Link to="/register" className="text-primary hover:underline">Create an account</Link>
          )}
        </div>
      </div>
    </div>
  )
}
