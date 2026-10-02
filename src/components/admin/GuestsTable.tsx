import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import type { Guest } from "@/data/admin"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mail, CalendarDays, PhilippinePeso, User, Clock, Search, X } from "lucide-react"
import { getStoredAvatar, getGeneratedAvatar, onAvatarError } from "@/lib/avatar"
import Pagination from "@/components/admin/Pagination"

const PAGE_SIZE = 10

interface GuestsTableProps {
  guests: Guest[]
  loading?: boolean
}

type GuestSortKey =
  | "spentDesc"
  | "spentAsc"
  | "bookingsDesc"
  | "bookingsAsc"
  | "nameAsc"
  | "nameDesc"
  | "lastStayDesc"

const sortOptions: { value: GuestSortKey; label: string }[] = [
  { value: "spentDesc", label: "Top spenders" },
  { value: "spentAsc", label: "Lowest spenders" },
  { value: "bookingsDesc", label: "Most bookings" },
  { value: "bookingsAsc", label: "Fewest bookings" },
  { value: "lastStayDesc", label: "Last stay · recent first" },
  { value: "nameAsc", label: "Guest name · A to Z" },
  { value: "nameDesc", label: "Guest name · Z to A" },
]

const sorters: Record<GuestSortKey, (a: Guest, b: Guest) => number> = {
  spentDesc: (a, b) => b.totalSpent - a.totalSpent,
  spentAsc: (a, b) => a.totalSpent - b.totalSpent,
  bookingsDesc: (a, b) => b.totalBookings - a.totalBookings,
  bookingsAsc: (a, b) => a.totalBookings - b.totalBookings,
  lastStayDesc: (a, b) => (b.lastStay || "").localeCompare(a.lastStay || ""),
  nameAsc: (a, b) => a.name.localeCompare(b.name),
  nameDesc: (a, b) => b.name.localeCompare(a.name),
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—"
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

export default function GuestsTable({ guests, loading }: GuestsTableProps) {
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<GuestSortKey>("spentDesc")
  const [page, setPage] = useState(1)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = guests.filter(
      (g) =>
        !q ||
        [g.name, g.email, g.phone].filter(Boolean).some((v) => v.toLowerCase().includes(q)),
    )
    return rows.sort(sorters[sort])
  }, [guests, query, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [query, sort])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const openGuest = (guest: Guest) => {
    setSelectedGuest(guest)
    setModalOpen(true)
  }

  if (loading) {
    return (
      <div className="rounded-[6px] bg-white border border-[#e2e4e8] animate-pulse">
        <div className="flex items-center justify-between gap-3 border-b border-[#e2e4e8] px-5 py-2.5">
          <div className="h-7 w-64 bg-[#f0f1f3] rounded-[5px]" />
          <div className="h-7 w-40 bg-[#f0f1f3] rounded-[5px]" />
        </div>
        <div className="p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#f0f1f3] rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-[6px] bg-white border border-[#e2e4e8] flex h-[708px] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[#e2e4e8] px-5 py-2.5 shrink-0 flex-wrap">
          <div className="relative w-full max-w-[300px] min-w-[180px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full rounded-[5px] border border-[#e2e4e8] bg-white py-1.5 pl-8 pr-7 text-[11px] text-[#1a1d26] placeholder:text-[#9ca3af] focus:border-[#82285f] focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-[#9ca3af] transition-colors hover:text-[#6b7280]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#9ca3af]">
              {filtered.length} {filtered.length === 1 ? "guest" : "guests"}
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as GuestSortKey)}
              title="Sort guests"
              className="rounded-[5px] border border-[#e2e4e8] bg-white px-2.5 py-1.5 text-[11px] text-[#6b7280] focus:border-[#82285f] focus:outline-none cursor-pointer"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#e2e4e8]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Guest Name</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-center text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Bookings</th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Total Spent</th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Last Stay</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((guest) => {
                return (
                  <tr
                    key={guest.id}
                    onClick={() => openGuest(guest)}
                    className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150 cursor-pointer group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={getStoredAvatar(guest.avatar_url) || getGeneratedAvatar(guest.email || guest.name)}
                          alt={guest.name}
                          onError={(e) => onAvatarError(e, guest.email || guest.name)}
                          className="size-8 rounded-full object-cover"
                        />
                        <span className="font-medium text-[#1a1d26] group-hover:text-[#82285f] transition-colors">{guest.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#6b7280]">{guest.email || "—"}</td>
                    <td className="px-5 py-3 text-center font-medium text-[#1a1d26]">{guest.totalBookings}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[#1a1d26]">₱{guest.totalSpent.toLocaleString()}</td>
                    <td className="px-5 py-3 text-[#6b7280]">{guest.lastStay}</td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[#9ca3af]">
                    {query ? "No guests match your search." : "No guests found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* ── Guest Detail Modal ──────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="!rounded-[16px] !max-w-[440px] !p-0 overflow-hidden">
          {selectedGuest && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e2e4e8]">
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-[#82285f]" />
                  Guest Account Details
                </DialogTitle>
              </DialogHeader>

              <div className="p-6">
                {/* Guest Header */}
                <div className="flex items-center gap-4 mb-6">
                  <img
                    src={getStoredAvatar(selectedGuest.avatar_url) || getGeneratedAvatar(selectedGuest.email || selectedGuest.name)}
                    alt={selectedGuest.name}
                    onError={(e) => onAvatarError(e, selectedGuest.email || selectedGuest.name)}
                    className="size-14 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-display font-semibold text-[#1a1d26] text-lg">{selectedGuest.name}</h3>
                    <p className="text-[12px] text-[#9ca3af] mt-0.5">{selectedGuest.email}</p>
                  </div>
                </div>

                {/* Account Info */}
                <div className="space-y-3 mb-6">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Account Information</h4>
                  <div className="bg-[#f5f6f8] rounded-[10px] p-4 space-y-3">
                    <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={selectedGuest.email || "Not provided"} />
                    <DetailRow icon={<Clock className="h-4 w-4" />} label="Member Since" value={formatDate(selectedGuest.created_at || "")} />
                    <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Guest ID" value={selectedGuest.id.slice(0, 8) + "..."} />
                  </div>
                </div>

                {/* Booking Stats */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">Booking History</h4>
                  <div className="bg-[#f5f6f8] rounded-[10px] p-4 space-y-3">
                    <DetailRow
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Total Bookings"
                      value={`${selectedGuest.totalBookings} booking${selectedGuest.totalBookings !== 1 ? "s" : ""}`}
                    />
                    <DetailRow
                      icon={<PhilippinePeso className="h-4 w-4" />}
                      label="Total Spent"
                      value={`₱${selectedGuest.totalSpent.toLocaleString()}`}
                      valueClass="font-bold text-[#82285f]"
                    />
                    <DetailRow
                      icon={<CalendarDays className="h-4 w-4" />}
                      label="Last Stay"
                      value={selectedGuest.lastStay || "No stays yet"}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ── Detail Row ────────────────────────────────────────────────────── */

function DetailRow({ icon, label, value, valueClass }: { icon: React.ReactNode; label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[13px] text-[#6b7280]">
        {icon}
        {label}
      </span>
      <span className={cn("text-[13px] text-[#1a1d26] text-right", valueClass)}>{value}</span>
    </div>
  )
}
