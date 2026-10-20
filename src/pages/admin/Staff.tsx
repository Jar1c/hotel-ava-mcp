import { useCallback, useEffect, useState } from "react"
import { Pencil, Trash2, UserPlus, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SkeletonLine } from "@/components/ui/skeleton"
import { useToast } from "@/contexts/ToastContext"
import { staffApi, type StaffAccount } from "@/services/api"

const inputClass =
  "w-full rounded-[6px] border border-[#e2e4e8] bg-white px-3 py-2 text-[13px] text-[#1a1d26] placeholder:text-[#9ca3af] focus:border-[#82285f]/40 focus:outline-none"

/**
 * Staff management (admin-only). Creates limited front-desk accounts that can
 * sign in at /admin but only reach Bookings — the backend rejects their
 * tokens on every admin-only endpoint regardless of what this page shows.
 *
 * embedded=true renders it inside the Guests page's "Staff" tab (no own h1 —
 * the Guests header + tabs already frame it).
 */
export default function Staff({ embedded = false }: { embedded?: boolean }) {
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)

  const [removing, setRemoving] = useState<StaffAccount | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  // Edit mode — click a row (or its pencil) to open
  const [editing, setEditing] = useState<StaffAccount | null>(null)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPassword, setEditPassword] = useState("")

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await staffApi.list()
      setStaff(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load staff accounts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setName("")
    setEmail("")
    setPassword("")
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      const created = await staffApi.create({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      })
      setStaff((prev) => [created, ...prev])
      toast({
        title: "Staff account created",
        description: `${created.name} can now sign in at the admin portal.`,
        variant: "success",
      })
      setOpen(false)
      resetForm()
    } catch (err) {
      toast({
        title: "Couldn't create staff account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!removing || removeBusy) return
    setRemoveBusy(true)
    try {
      await staffApi.remove(removing.id)
      setStaff((prev) => prev.filter((s) => s.id !== removing.id))
      toast({
        title: "Staff account removed",
        description: `${removing.name} can no longer sign in.`,
        variant: "success",
      })
      setRemoving(null)
    } catch (err) {
      toast({
        title: "Couldn't remove staff account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setRemoveBusy(false)
    }
  }

  const openEdit = (s: StaffAccount) => {
    setEditing(s)
    setEditName(s.name)
    setEditEmail(s.email)
    setEditPassword("")
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || saving) return
    setSaving(true)
    try {
      const updated = await staffApi.update(editing.id, {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        ...(editPassword ? { password: editPassword } : {}),
      })
      setStaff((prev) =>
        prev.map((s) => (s.id === updated.id ? { ...s, ...updated, created_at: s.created_at } : s)),
      )
      toast({
        title: "Staff account updated",
        description: `${updated.name}'s details were saved.`,
        variant: "success",
      })
      setEditing(null)
    } catch (err) {
      toast({
        title: "Couldn't update staff account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      })
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (iso?: string) => {
    if (!iso) return "—"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
  }

  return (
    <div className="flex flex-col gap-6">
      {embedded ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#9ca3af]">
            Click a staff row to edit its name, email, or password.
          </p>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="!rounded-[8px] gap-2 bg-[#82285f] hover:bg-[#6b1f4b] text-white"
          >
            <UserPlus className="h-4 w-4" />
            Add staff
          </Button>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-ink">Staff</h1>
            <p className="text-sm text-muted">
              Front-desk accounts — can sign in at the admin portal but only see bookings and arrivals.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            className="!rounded-[8px] gap-2 bg-[#82285f] hover:bg-[#6b1f4b] text-white"
          >
            <UserPlus className="h-4 w-4" />
            Add staff
          </Button>
        </div>
      )}

      {error ? (
        <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-6 py-8 text-center">
          <p className="text-sm font-semibold text-rose-800">Couldn't load staff accounts</p>
          <p className="mt-1 text-sm text-rose-700">{error}</p>
          <Button type="button" variant="outline" onClick={() => void load()} className="mt-4 !rounded-[8px]">
            Try again
          </Button>
        </div>
      ) : (
        <div className="rounded-[6px] bg-white border border-[#e2e4e8]">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#e2e4e8]">
                  {["Name", "Email", "Added", ""].map((h, i) => (
                    <th
                      key={h || i}
                      className={`px-4 py-3 text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider ${
                        i === 3 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-[#f0f1f3]">
                        <td colSpan={4} className="px-4 py-3">
                          <SkeletonLine className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  : staff.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => openEdit(s)}
                        className="border-b border-[#f0f1f3] last:border-b-0 hover:bg-[#f5f6f8] transition-colors duration-150 cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-8 items-center justify-center rounded-full bg-[#82285f]/10 text-[#82285f]">
                              <Users className="size-4" />
                            </span>
                            <span className="font-medium text-[#1a1d26]">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6b7280]">{s.email}</td>
                        <td className="px-4 py-3 text-[#6b7280] whitespace-nowrap">{formatDate(s.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openEdit(s) }}
                              aria-label={`Edit ${s.name}`}
                              title="Edit"
                              className="rounded-[6px] p-1.5 text-[#9ca3af] hover:bg-[#82285f]/10 hover:text-[#82285f] transition-colors cursor-pointer"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setRemoving(s) }}
                              aria-label={`Remove ${s.name}`}
                              title="Remove"
                              className="rounded-[6px] p-1.5 text-[#9ca3af] hover:bg-rose-50 hover:text-[#A4423A] transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                {!loading && staff.length === 0 && !error && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-[#9ca3af]">
                      No staff accounts yet — create one with <span className="font-medium">Add staff</span>.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!rounded-[12px] !max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-ink">Add staff account</DialogTitle>
            <DialogDescription className="text-sm text-muted">
              The staff member signs in at the admin portal with this email and password. They only
              see the bookings and arrivals screen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3 pt-2">
            <div>
              <label htmlFor="staff-name" className="text-[11px] font-medium text-[#6b7280]">
                Full name
              </label>
              <input
                id="staff-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                required
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="staff-email" className="text-[11px] font-medium text-[#6b7280]">
                Email
              </label>
              <input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@hotelava.com"
                required
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="staff-password" className="text-[11px] font-medium text-[#6b7280]">
                Password
              </label>
              <input
                id="staff-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="!rounded-[8px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !name.trim() || !email.trim() || password.length < 8}
                className="!rounded-[8px] bg-[#82285f] hover:bg-[#6b1f4b] text-white"
              >
                {saving ? "Creating…" : "Create account"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent className="!rounded-[12px] !max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-ink">Edit staff account</DialogTitle>
            <DialogDescription className="text-sm text-muted">
              Update the name or email. Leave the password blank to keep the current one.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-3 pt-2">
            <div>
              <label htmlFor="edit-staff-name" className="text-[11px] font-medium text-[#6b7280]">
                Full name
              </label>
              <input
                id="edit-staff-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                required
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="edit-staff-email" className="text-[11px] font-medium text-[#6b7280]">
                Email
              </label>
              <input
                id="edit-staff-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="staff@hotelava.com"
                required
                className={`${inputClass} mt-1`}
              />
            </div>
            <div>
              <label htmlFor="edit-staff-password" className="text-[11px] font-medium text-[#6b7280]">
                New password <span className="text-[#9ca3af]">(optional)</span>
              </label>
              <input
                id="edit-staff-password"
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
                minLength={8}
                className={`${inputClass} mt-1`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(null)}
                className="!rounded-[8px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !editName.trim() || !editEmail.trim()}
                className="!rounded-[8px] bg-[#82285f] hover:bg-[#6b1f4b] text-white"
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={removing !== null} onOpenChange={(o) => { if (!o) setRemoving(null) }}>
        <DialogContent className="!rounded-[12px] !max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-ink">Remove staff account?</DialogTitle>
            <DialogDescription className="text-sm text-muted">
              {removing ? `${removing.name} (${removing.email}) will no longer be able to sign in.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRemoving(null)} className="!rounded-[8px]">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={removeBusy}
              onClick={() => void remove()}
              className="!rounded-[8px] bg-[#A4423A] hover:bg-[#8c3731] text-white"
            >
              {removeBusy ? "Removing…" : "Remove account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
