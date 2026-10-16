import { useEffect, useMemo, useState } from "react"
import { Download, Search } from "lucide-react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import Pagination from "@/components/admin/Pagination"
import { SkeletonLine } from "@/components/ui/skeleton"
import { getBookings } from "@/services/adminService"
import { formatPaymentMethod } from "@/lib/payment"
import { cn } from "@/lib/utils"
import type { Booking, BookingStatus } from "@/data/admin"

/**
 * Reports — every booking record in one table, with a one-click Excel export.
 * The CSV carries the full record (ids, contacts, stay window, money, refund
 * and cancellation notes), not just what fits on screen.
 */

const PAGE_SIZE = 15

const statusStyles: Record<BookingStatus, { label: string; dot: string; text: string }> = {
  confirmed: { label: "Confirmed", dot: "bg-[#3D6B4F]", text: "text-[#3D6B4F]" },
  pending: { label: "Pending", dot: "bg-[#b45309]", text: "text-[#b45309]" },
  completed: { label: "Completed", dot: "bg-[#3E5C76]", text: "text-[#3E5C76]" },
  "checked-out": { label: "Checked out", dot: "bg-[#6b7280]", text: "text-[#6b7280]" },
  cancelled: { label: "Cancelled", dot: "bg-[#A4423A]", text: "text-[#A4423A]" },
}

const statusFilters: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All statuses", value: "all" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Checked out", value: "checked-out" },
  { label: "Cancelled", value: "cancelled" },
]

type SortKey = "createdDesc" | "createdAsc" | "checkInAsc" | "checkInDesc" | "amountDesc" | "amountAsc" | "guestAsc"

const sortOptions: { value: SortKey; label: string }[] = [
  { value: "createdDesc", label: "Newest booked" },
  { value: "createdAsc", label: "Oldest booked" },
  { value: "checkInAsc", label: "Check-in · soonest" },
  { value: "checkInDesc", label: "Check-in · latest" },
  { value: "amountDesc", label: "Amount · high to low" },
  { value: "amountAsc", label: "Amount · low to high" },
  { value: "guestAsc", label: "Guest name · A to Z" },
]

const sorters: Record<SortKey, (a: Booking, b: Booking) => number> = {
  createdDesc: (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
  createdAsc: (a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  checkInAsc: (a, b) => (a.checkIn || "").localeCompare(b.checkIn || ""),
  checkInDesc: (a, b) => (b.checkIn || "").localeCompare(a.checkIn || ""),
  amountDesc: (a, b) => (b.amount ?? 0) - (a.amount ?? 0),
  amountAsc: (a, b) => (a.amount ?? 0) - (b.amount ?? 0),
  guestAsc: (a, b) => (a.guestName || "").localeCompare(b.guestName || ""),
}

/** "2026-10-16" or ISO → "Oct 16, 2026" without timezone drift. */
function fmtDate(s?: string | null): string {
  if (!s) return "—"
  const day = s.slice(0, 10)
  const d = new Date(`${day}T00:00:00`)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

/** ISO timestamp → "Oct 16, 2026, 8:20 PM" (booking made / refund sent). */
function fmtStamp(iso?: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-PH", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  })
}

const peso = (n?: number | null) => `₱${(n ?? 0).toLocaleString("en-PH")}`

export default function Reports() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [sort, setSort] = useState<SortKey>("createdDesc")
  const [page, setPage] = useState(1)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getBookings({ force: true })
      setBookings(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load bookings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return bookings
      .filter((b) => statusFilter === "all" || b.status === statusFilter)
      .filter((b) => {
        // Check-in date range (YYYY-MM-DD strings compare lexicographically).
        const ci = (b.checkIn || "").slice(0, 10)
        if (dateFrom && ci < dateFrom) return false
        if (dateTo && ci > dateTo) return false
        return true
      })
      .filter((b) => {
        if (!q) return true
        return [b.guestName, b.guestEmail, b.phone, b.id, b.fullId, b.roomNumber, b.roomType]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      })
      .sort(sorters[sort])
  }, [bookings, query, statusFilter, dateFrom, dateTo, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [query, statusFilter, dateFrom, dateTo, sort, bookings])

  // Real .xlsx (not CSV): column widths, autofilter, phone stays text —
  // nothing renders as hashes or 6.4E+11 when the admin opens it in Excel.
  const exportXlsx = () => {
    const header = [
      "Booking ID", "Guest Name", "Email", "Phone",
      "Room", "Room Type", "Stay Type", "Check-in", "Check-out",
      "Nights", "Duration (hrs)", "Start Time", "Guests",
      "Status", "Payment Mode", "Payment Method",
      "Total (PHP)", "Amount Paid (PHP)", "Balance (PHP)",
      "Booked On", "Refunded At", "Cancellation Reason",
    ]
    const rows = filtered.map((b) => [
      (b.fullId || b.id).toUpperCase(),
      b.guestName,
      b.guestEmail,
      b.phone ? String(b.phone) : "",
      b.roomNumber,
      b.roomType,
      b.stay_type === "day" ? "Day use" : "Overnight",
      fmtDate(b.checkIn),
      b.stay_type === "day" ? "" : fmtDate(b.checkOut),
      b.stay_type === "day" ? "" : b.nights,
      b.duration || "",
      b.start_time || "",
      b.guests ?? "",
      statusStyles[b.status]?.label ?? b.status,
      b.payment_mode === "downpayment" ? "Downpayment (50%)" : "Full payment",
      formatPaymentMethod(b.payment_method, "Not set"),
      b.amount ?? 0,
      b.amount_paid ?? 0,
      (b.amount ?? 0) - (b.amount_paid ?? 0),
      b.createdAt ? fmtStamp(b.createdAt) : "",
      b.refunded_at ? fmtStamp(b.refunded_at) : "",
      b.cancellation_reason || "",
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    // wch = characters wide, tuned per column so nothing shows as ########.
    ws["!cols"] = [
      { wch: 38 }, { wch: 22 }, { wch: 28 }, { wch: 16 },
      { wch: 18 }, { wch: 17 }, { wch: 11 }, { wch: 14 }, { wch: 14 },
      { wch: 8 }, { wch: 13 }, { wch: 11 }, { wch: 8 },
      { wch: 12 }, { wch: 17 }, { wch: 18 },
      { wch: 13 }, { wch: 16 }, { wch: 14 },
      { wch: 22 }, { wch: 22 }, { wch: 30 },
    ]
    if (rows.length > 0) {
      ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: header.length - 1, r: rows.length } }) }
    }
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Bookings")
    const data = XLSX.write(wb, { bookType: "xlsx", type: "array" })
    const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hotel-ava-bookings-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-ink">Reports</h1>
          <p className="text-sm text-muted">All booking records — search, review, and export to Excel.</p>
        </div>
        <Button
          type="button"
          onClick={exportXlsx}
          disabled={loading || filtered.length === 0}
          className="!rounded-[8px] gap-2 bg-[#82285f] hover:bg-[#6b1f4b] text-white"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </Button>
      </div>

      {error ? (
        <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-rose-800">Couldn't load reports</p>
          <p className="mt-1 text-sm text-rose-700">{error}</p>
          <Button type="button" variant="outline" onClick={() => void load()} className="mt-4 !rounded-[8px]">
            Try again
          </Button>
        </div>
      ) : (
        <div className="rounded-[6px] bg-white border border-[#e2e4e8]">
          {/* Search + filters */}
          <div className="flex items-center gap-3 border-b border-[#e2e4e8] px-5 py-2.5 flex-wrap">
            <div className="relative w-full max-w-[280px] min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9ca3af]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guest, email, room, booking ID…"
                className="w-full rounded-[6px] border border-[#e2e4e8] bg-white py-2 pl-9 pr-3 text-[13px] text-[#1a1d26] placeholder:text-[#9ca3af] focus:border-[#82285f]/40 focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#6b7280]">
              Check-in from
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-[6px] border border-[#e2e4e8] bg-white px-2 py-1.5 text-[12px] text-[#1a1d26] focus:border-[#82285f]/40 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-[#6b7280]">
              to
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-[6px] border border-[#e2e4e8] bg-white px-2 py-1.5 text-[12px] text-[#1a1d26] focus:border-[#82285f]/40 focus:outline-none"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BookingStatus | "all")}
              className="rounded-[6px] border border-[#e2e4e8] bg-white px-3 py-2 text-[13px] text-[#1a1d26] focus:border-[#82285f]/40 focus:outline-none"
            >
              {statusFilters.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-[6px] border border-[#e2e4e8] bg-white px-3 py-2 text-[13px] text-[#1a1d26] focus:border-[#82285f]/40 focus:outline-none"
            >
              {sortOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#e2e4e8]">
                  {["Booking ID", "Guest", "Room", "Stay", "Guests", "Status", "Payment", "Total", "Paid", "Balance", "Booked on"].map((h, i) => (
                    <th key={h} className={cn(
                      "px-4 py-3 text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider",
                      i >= 7 ? "text-right" : "text-left",
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#f0f1f3]">
                        <td colSpan={11} className="px-4 py-3"><SkeletonLine className="h-4 w-full" /></td>
                      </tr>
                    ))
                  : pageRows.map((b) => {
                      const st = statusStyles[b.status] ?? statusStyles.pending
                      const isDay = b.stay_type === "day"
                      const balance = (b.amount ?? 0) - (b.amount_paid ?? 0)
                      return (
                        <tr key={b.fullId || b.id} className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150">
                          <td className="px-4 py-3">
                            <span className="font-mono text-[11px] text-[#9ca3af]">#{(b.fullId || b.id).slice(0, 8).toUpperCase()}</span>
                          </td>
                          <td className="px-4 py-3 min-w-[180px]">
                            <p className="font-medium text-[#1a1d26] truncate">{b.guestName}</p>
                            <p className="text-[11px] text-[#9ca3af] truncate">{b.guestEmail}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#1a1d26]">{b.roomNumber}</p>
                            <p className="text-[11px] text-[#9ca3af]">{b.roomType}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#1a1d26] whitespace-nowrap">{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}</p>
                            <p className="text-[11px] text-[#9ca3af]">
                              {isDay ? `Day use${b.duration ? ` · ${b.duration} hrs` : ""}` : `${b.nights} night${b.nights === 1 ? "" : "s"}`}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-[#6b7280]">{b.guests ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", st.text)}>
                              <span className={cn("size-1.5 rounded-full", st.dot)} />
                              {st.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[#1a1d26]">{b.payment_mode === "downpayment" ? "Downpayment" : "Full payment"}</p>
                            <p className="text-[11px] text-[#9ca3af]">{formatPaymentMethod(b.payment_method, "Not set")}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#1a1d26] whitespace-nowrap">{peso(b.amount)}</td>
                          <td className="px-4 py-3 text-right text-[#6b7280] whitespace-nowrap">{peso(b.amount_paid)}</td>
                          <td className={cn("px-4 py-3 text-right whitespace-nowrap", balance > 0 ? "font-semibold text-[#b45309]" : "text-[#9ca3af]")}>{peso(balance)}</td>
                          <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{fmtStamp(b.createdAt)}</td>
                        </tr>
                      )
                    })}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-[#9ca3af]">
                      {query || statusFilter !== "all" ? "No bookings match your filters." : "No bookings yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > PAGE_SIZE && (
            <div className="border-t border-[#e2e4e8] px-5 py-3">
              <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
