import { Link } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import { LAST_UPDATED, SECTIONS } from "@/data/terms"

export default function Privacy() {
  const { isAuthenticated } = useAuth()
  const section = SECTIONS.find((s) => s.id === "privacy")

  return (
    <div className="bg-canvas min-h-screen">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="typo-caption-sm font-semibold uppercase tracking-wider text-primary">
          Hotel Ava
        </p>
        <h1 className="typo-display-lg text-ink mt-1">Privacy Policy</h1>
        <p className="typo-body-sm text-muted mt-2">
          Last updated {LAST_UPDATED}. How we collect, use, and protect your information.
        </p>

        {section && (
          <section className="mt-8 rounded-[12px] border border-hairline bg-white p-5 sm:p-6">
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
        )}

        <p className="mt-6 typo-body-sm text-muted leading-relaxed">
          Booking, cancellation, and refund policies are covered in our{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms &amp; Conditions
          </Link>
          .
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 typo-caption-sm text-muted">
          <Link to="/" className="text-primary hover:underline">Back to home</Link>
          <Link to="/terms" className="text-primary hover:underline">Terms &amp; Conditions</Link>
          <Link to="/rooms" className="text-primary hover:underline">Browse rooms</Link>
          {isAuthenticated ? (
            <Link to="/settings" className="text-primary hover:underline">Account settings</Link>
          ) : (
            <Link to="/register" className="text-primary hover:underline">Create an account</Link>
          )}
        </div>
      </div>
    </div>
  )
}
