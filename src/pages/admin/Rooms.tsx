import { useState, useEffect } from "react"
import { Plus } from "lucide-react"
import AdminRoomTable from "@/components/admin/AdminRoomTable"
import RoomFormSheet from "@/components/admin/RoomFormSheet"
import type { RoomFormData } from "@/components/admin/RoomFormSheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getRooms, addRoom, updateRoom, deleteRoom } from "@/services/adminService"
import type { AdminRoom } from "@/data/admin"

export default function Rooms() {
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<AdminRoom | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminRoom | null>(null)

  useEffect(() => {
    getRooms().then((data) => {
      setRooms(data)
      setLoading(false)
    })
  }, [])

  const handleAdd = () => {
    setEditRoom(null)
    setSheetOpen(true)
  }

  const handleEdit = (room: AdminRoom) => {
    setEditRoom(room)
    setSheetOpen(true)
  }

  const handleDelete = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    if (room) setDeleteTarget(room)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const ok = await deleteRoom(deleteTarget.id)
    if (ok) {
      setRooms((prev) => prev.filter((r) => r.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
  }

  const handleSave = async (data: RoomFormData) => {
    if (editRoom) {
      const updated = await updateRoom({ ...editRoom, ...data })
      if (updated) {
        setRooms((prev) => prev.map((r) => (r.id === editRoom.id ? updated : r)))
      }
    } else {
      const created = await addRoom(data)
      if (created) {
        setRooms((prev) => [created, ...prev])
      }
    }
    setSheetOpen(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Rooms</h1>
          <p className="text-sm text-muted">Manage room inventory, pricing, and availability.</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 rounded-[5px] bg-[#82285f] px-3.5 py-2 text-[11px] font-semibold text-white hover:bg-[#6b1f4b] transition-colors"
        >
          <Plus className="size-4" />
          Add Room
        </button>
      </div>

      {loading ? (
        <div className="rounded-[6px] bg-white border border-[#e2e4e8] animate-pulse p-5 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-[#f0f1f3] rounded" />
          ))}
        </div>
      ) : (
        <AdminRoomTable
          rooms={rooms}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}

      {/* Add/Edit Sheet */}
      <RoomFormSheet
        key={editRoom?.id ?? "new"}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        editRoom={editRoom}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1a1d26]">Delete Room</DialogTitle>
            <DialogDescription className="text-[12px] text-[#9ca3af]">
              Are you sure you want to delete <span className="font-semibold text-[#1a1d26]">{deleteTarget?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="text-[12px]">
              Cancel
            </Button>
            <Button onClick={confirmDelete} className="bg-[#A4423A] hover:bg-[#8d382f] text-white text-[12px]">
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
