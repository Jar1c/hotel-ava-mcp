import { useState, useMemo } from "react"
import { Pencil, Trash2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdminRoom } from "@/data/admin"

interface AdminRoomTableProps {
  rooms: AdminRoom[]
  onEdit?: (room: AdminRoom) => void
  onDelete?: (roomId: string) => void
  highlightId?: string | null
}

type RoomStatus = "available" | "occupied" | "maintenance"

const statusConfig: Record<RoomStatus, { label: string; dotColor: string; textColor: string }> = {
  available: { label: "Available", dotColor: "bg-[#3D6B4F]", textColor: "text-[#3D6B4F]" },
  occupied: { label: "Occupied", dotColor: "bg-[#B5AC97]", textColor: "text-[#B5AC97]" },
  maintenance: { label: "Maintenance", dotColor: "bg-[#A4423A]", textColor: "text-[#A4423A]" },
}

const statusFilters: { label: string; value: RoomStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Available", value: "available" },
  { label: "Occupied", value: "occupied" },
  { label: "Maintenance", value: "maintenance" },
]

type RoomSortKey = "nameAsc" | "nameDesc" | "priceAsc" | "priceDesc" | "bookingsDesc" | "revenueDesc" | "numberAsc"

const sortOptions: { value: RoomSortKey; label: string }[] = [
  { value: "nameAsc", label: "Room name · A to Z" },
  { value: "nameDesc", label: "Room name · Z to A" },
  { value: "priceAsc", label: "Price · low to high" },
  { value: "priceDesc", label: "Price · high to low" },
  { value: "bookingsDesc", label: "Most bookings" },
  { value: "revenueDesc", label: "Revenue · high to low" },
  { value: "numberAsc", label: "Room no. · A to Z" },
]

const sorters: Record<RoomSortKey, (a: AdminRoom, b: AdminRoom) => number> = {
  nameAsc: (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  nameDesc: (a, b) => b.name.localeCompare(a.name) || a.id.localeCompare(b.id),
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  bookingsDesc: (a, b) => b.bookings - a.bookings,
  revenueDesc: (a, b) => b.revenue - a.revenue,
  numberAsc: (a, b) => a.id.localeCompare(b.id),
}

export default function AdminRoomTable({ rooms, onEdit, onDelete, highlightId }: AdminRoomTableProps) {
  const [filter, setFilter] = useState<RoomStatus | "all">("all")
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [sort, setSort] = useState<RoomSortKey>("nameAsc")

  const types = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.type).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rooms],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rooms
      .filter((r) => filter === "all" || r.status === filter)
      .filter((r) => !typeFilter || r.type === typeFilter)
      .filter((r) => {
        if (!q) return true
        return [r.name, r.type, r.id, r.description].filter(Boolean).some((v) => v.toLowerCase().includes(q))
      })
      .sort(sorters[sort])
  }, [rooms, filter, typeFilter, query, sort])

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
        <span className="ml-auto text-[11px] text-[#9ca3af]">
          {filtered.length} {filtered.length === 1 ? "room" : "rooms"}
        </span>
      </div>

      {/* Search / type filter / sort */}
      <div className="flex items-center justify-between gap-3 border-b border-[#e2e4e8] px-5 py-2.5 flex-wrap">
        <div className="relative w-full max-w-[300px] min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search room name, type, no.…"
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
        <div className="flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            title="Filter by room type"
            className="rounded-[5px] border border-[#e2e4e8] bg-white px-2.5 py-1.5 text-[11px] text-[#6b7280] focus:border-[#82285f] focus:outline-none cursor-pointer"
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as RoomSortKey)}
            title="Sort rooms"
            className="rounded-[5px] border border-[#e2e4e8] bg-white px-2.5 py-1.5 text-[11px] text-[#6b7280] focus:border-[#82285f] focus:outline-none cursor-pointer"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e2e4e8]">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider w-14">Room</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Room ID</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Name</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Price</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Capacity</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Bookings</th>
              <th className="px-5 py-3 text-right text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider">Revenue</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((room) => {
              const status = statusConfig[room.status]
              return (
                <tr
                  key={room.id}
                  className={cn(
                    "border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150",
                    highlightId === room.id && "animate-highlight"
                  )}
                >
                  <td className="px-5 py-3">
                    <div className="size-10 rounded-[4px] overflow-hidden bg-[#f0f1f3]">
                      <img
                        src={room.images[0] || ""}
                        alt={room.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-mono text-[11px] text-[#9ca3af]">{room.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-5 py-3 font-medium text-[#1a1d26]">{room.name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-block rounded-[3px] bg-[#f5f6f8] px-1.5 py-0.5 text-[10px] font-medium text-[#6b7280]">
                      {room.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-[#1a1d26]">₱{room.price.toLocaleString()}</td>
                  <td className="px-5 py-3 text-center text-[#6b7280]">
                    <span className="text-[11px]">{room.max_adults}A {room.max_children}C</span>
                    {!room.allows_children && (
                      <span className="ml-1 text-[9px] text-[#A4423A] font-medium" title="No children allowed">No kids</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", status.textColor)}>
                      <span className={cn("size-1.5 rounded-full", status.dotColor)} />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center font-medium text-[#1a1d26]">{room.bookings}</td>
                  <td className="px-5 py-3 text-right font-semibold text-[#1a1d26]">₱{room.revenue.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(room)}
                          className="flex items-center justify-center size-7 rounded-[4px] text-[#9ca3af] hover:bg-[#f0f1f3] hover:text-[#6b7280] transition-all"
                          title="Edit room"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(room.id)}
                          className="flex items-center justify-center size-7 rounded-[4px] text-[#9ca3af] hover:bg-[#A4423A]/10 hover:text-[#A4423A] transition-all"
                          title="Delete room"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-10 text-center text-[#9ca3af]">
                    {query || typeFilter || filter !== "all"
                      ? "No rooms match your filters."
                      : "No rooms found."}
                  </td>
                </tr>
              )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
