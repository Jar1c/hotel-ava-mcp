import { useState, useEffect } from "react"
import { useSearchParams } from "react-router"
import { Users } from "lucide-react"
import GuestsTable from "@/components/admin/GuestsTable"
import Staff from "./Staff"
import { getGuests } from "@/services/adminService"
import type { Guest } from "@/data/admin"

type TabKey = "guests" | "staff"

/**
 * Guests page with a Staff tab — staff management lives here instead of a
 * separate sidebar entry, so the admin nav stays: Dashboard, Bookings, Rooms,
 * Guests, Calendar, Reviews, AI, Reports.
 */
export default function Guests() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabKey = searchParams.get("tab") === "staff" ? "staff" : "guests"

  useEffect(() => {
    // The staff tab renders its own table — skip the guest fetch there.
    if (tab !== "guests") return
    let alive = true
    getGuests().then((data) => {
      if (!alive) return
      setGuests(data)
      setLoading(false)
    })
    return () => { alive = false }
  }, [tab])

  const setTab = (next: TabKey) =>
    setSearchParams(next === "staff" ? { tab: "staff" } : {}, { replace: true })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Guests</h1>
          <p className="text-sm text-muted">
            {tab === "staff"
              ? "Front-desk staff accounts — sign in at the admin portal, bookings view only."
              : "Manage guest profiles and stay history."}
          </p>
        </div>
        {tab === "guests" && (
          <div className="flex items-center gap-2 text-[12px] text-muted bg-white border border-[#e2e4e8] rounded-[5px] px-3 py-1.5">
            <Users className="size-4" />
            {guests.length} guests
          </div>
        )}
      </div>

      {/* Guests | Staff */}
      <div className="flex gap-1 border-b border-[#e2e4e8]">
        {([["guests", "Guests"], ["staff", "Staff"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`-mb-px cursor-pointer rounded-t-[6px] border-b-2 px-4 py-2 text-[13px] font-medium transition-colors ${
              tab === key
                ? "border-[#82285f] bg-[#82285f]/[0.06] text-[#82285f]"
                : "border-transparent text-[#6b7280] hover:bg-[#f5f6f8] hover:text-[#1a1d26]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "staff" ? (
        <Staff embedded />
      ) : (
        <GuestsTable guests={guests} loading={loading} />
      )}
    </div>
  )
}
