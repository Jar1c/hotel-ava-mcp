import { useState } from "react"
import { cn } from "@/lib/utils"
import type { Guest } from "@/data/admin"

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

export default function GuestsTable({ guests, loading }: GuestsTableProps) {
  const [filter, setFilter] = useState<GuestStatus | "all">("all")
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null)

  const filtered = filter === "all" ? guests : guests.filter((g) => g.status === filter)

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
    <div className="rounded-[6px] bg-white border border-[#e2e4e8]">
      <div className="flex items-center gap-2 border-b border-[#e2e4e8] px-5 py-3">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-[4px] px-2.5 py-1 text-[10px] font-semibold transition-all duration-200",
              filter === f.value
                ? "bg-[#82285f] text-white"
                : "bg-[#f5f6f8] text-[#6b7280] hover:bg-[#e2e4e8]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e2e4e8]">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Guest Name</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Email</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Phone</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Bookings</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Total Spent</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Last Stay</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((guest, i) => {
              const status = statusConfig[guest.status]
              return (
                <tr
                  key={guest.id}
                  onClick={() => setSelectedGuest(selectedGuest?.id === guest.id ? null : guest)}
                  className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150 cursor-pointer"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-[#82285f]/10 flex items-center justify-center text-[11px] font-bold text-[#82285f]">
                        {guest.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="font-medium text-[#1a1d26]">{guest.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-[#6b7280]">{guest.email}</td>
                  <td className="px-5 py-3 text-[#6b7280]">{guest.phone}</td>
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
                <td colSpan={7} className="px-5 py-10 text-center text-[#9ca3af]">
                  No guests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Guest Detail Panel */}
      {selectedGuest && (
        <div className="border-t border-[#e2e4e8] px-5 py-4 bg-[#fafafa]">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-[#82285f]/10 flex items-center justify-center text-[13px] font-bold text-[#82285f]">
                {selectedGuest.name.split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1a1d26]">{selectedGuest.name}</h3>
                <p className="text-[11px] text-[#6b7280]">{selectedGuest.email}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedGuest(null)}
              className="text-[#9ca3af] hover:text-[#6b7280] transition-colors text-[11px] font-medium"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-[12px]">
            <div>
              <p className="text-[#9ca3af] text-[10px] font-semibold uppercase tracking-wider mb-0.5">Phone</p>
              <p className="text-[#1a1d26]">{selectedGuest.phone}</p>
            </div>
            <div>
              <p className="text-[#9ca3af] text-[10px] font-semibold uppercase tracking-wider mb-0.5">Total Bookings</p>
              <p className="text-[#1a1d26] font-semibold">{selectedGuest.totalBookings}</p>
            </div>
            <div>
              <p className="text-[#9ca3af] text-[10px] font-semibold uppercase tracking-wider mb-0.5">Total Spent</p>
              <p className="text-[#1a1d26] font-semibold">₱{selectedGuest.totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
