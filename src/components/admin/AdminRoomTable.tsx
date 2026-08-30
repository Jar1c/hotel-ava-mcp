import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"
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

export default function AdminRoomTable({ rooms, onEdit, onDelete, highlightId }: AdminRoomTableProps) {
  const [filter, setFilter] = useState<RoomStatus | "all">("all")

  const filtered = filter === "all" ? rooms : rooms.filter((r) => r.status === filter)

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
                  <td className="px-5 py-3 text-center text-[#6b7280]">{room.capacity} {room.capacity > 2 ? "guests" : "guest"}</td>
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
                  No rooms found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
