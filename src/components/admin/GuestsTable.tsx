import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import type { Guest } from "@/data/admin"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mail, CalendarDays, PhilippinePeso, User, Clock } from "lucide-react"
import { getDiceBearUrl } from "@/lib/dicebear"
import Pagination from "@/components/admin/Pagination"

const PAGE_SIZE = 10

interface GuestsTableProps {
  guests: Guest[]
  loading?: boolean
}

type GuestStatus = "VIP" | "Regular" | "New"

const statusConfig: Record<GuestStatus, { label: string; dotColor: string; textColor: string }> = {
  VIP: { label: "VIP", dotColor: "bg-[#B5AC97]", textColor: "text-[#B5AC97]" },
  Regular: { label: "Regular", dotColor: "bg-[#6b7280]", textColor: "text-[#6b7280]" },
  New: { label: "New", dotColor: "bg-[#3D6B4F]", textColor: "text-[#3D6B4F]" },
}

const statusFilters: { label: string; value: GuestStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "VIP", value: "VIP" },
  { label: "Regular", value: "Regular" },
  { label: "New", value: "New" },
]

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
  const [filter, setFilter] = useState<GuestStatus | "all">("all")
  const [page, setPage] = useState(1)
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const filtered = filter === "all" ? guests : guests.filter((g) => g.status === filter)
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  useEffect(() => {
    setPage(1)
  }, [filter])

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
        <div className="flex items-center gap-2 border-b border-[#e2e4e8] px-5 py-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-16 bg-[#f0f1f3] rounded-[4px]" />
          ))}
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
        <div className="flex items-center gap-2 border-b border-[#e2e4e8] px-5 py-3 shrink-0">
          {statusFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-[4px] px-2.5 py-1 text-[10px] font-semibold transition-all duration-200 cursor-pointer",
                filter === f.value
                  ? "bg-[#82285f] text-white"
                  : "bg-[#f5f6f8] text-[#6b7280] hover:bg-[#e2e4e8]"
              )}
            >
              {f.label}
            </button>
          ))}
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
                <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((guest) => {
                const status = statusConfig[guest.status]
                return (
                  <tr
                    key={guest.id}
                    onClick={() => openGuest(guest)}
                    className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150 cursor-pointer group"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={guest.avatar_url || getDiceBearUrl("adventurer", guest.email || guest.name, 32)}
                          alt={guest.name}
                          className="size-8 rounded-full object-cover"
                        />
                        <span className="font-medium text-[#1a1d26] group-hover:text-[#82285f] transition-colors">{guest.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[#6b7280]">{guest.email || "—"}</td>
                    <td className="px-5 py-3 text-center font-medium text-[#1a1d26]">{guest.totalBookings}</td>
                    <td className="px-5 py-3 text-right font-semibold text-[#1a1d26]">₱{guest.totalSpent.toLocaleString()}</td>
                    <td className="px-5 py-3 text-[#6b7280]">{guest.lastStay}</td>
                    <td className="px-5 py-3">
                      <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", status.textColor)}>
                        <span className={cn("size-1.5 rounded-full", status.dotColor)} />
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-[#9ca3af]">
                    No guests found.
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
                    src={selectedGuest.avatar_url || getDiceBearUrl("adventurer", selectedGuest.email || selectedGuest.name, 56)}
                    alt={selectedGuest.name}
                    className="size-14 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-display font-semibold text-[#1a1d26] text-lg">{selectedGuest.name}</h3>
                    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium mt-0.5", statusConfig[selectedGuest.status].textColor)}>
                      <span className={cn("size-1.5 rounded-full", statusConfig[selectedGuest.status].dotColor)} />
                      {statusConfig[selectedGuest.status].label}
                    </span>
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
