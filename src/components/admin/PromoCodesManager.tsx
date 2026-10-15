import { useState, useEffect, useCallback } from "react"
import { Check, Pencil, Plus, Power, Tag, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useToast } from "@/contexts/ToastContext"
import { ApiError, promoApi, type PromoCodeData, type PromoCodeInput } from "@/services/api"
import { Skeleton } from "@/components/ui/skeleton"

const longDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const errorMessage = (err: unknown) =>
  err instanceof ApiError && err.message ? err.message : "Couldn't save. Try again."

/** Same live/scheduled/expired/off/redeemed rules the backend enforces. */
const promoStatus = (p: PromoCodeData): "live" | "scheduled" | "expired" | "redeemed" | "off" => {
  if (!p.active) return "off"
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (p.valid_to && new Date(`${p.valid_to.slice(0, 10)}T00:00:00`) < today) return "expired"
  if (p.max_uses && p.used_count >= p.max_uses) return "redeemed"
  if (p.valid_from && new Date(`${p.valid_from.slice(0, 10)}T00:00:00`) > today) return "scheduled"
  return "live"
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-[#82285f]/10 text-[#82285f]" },
  scheduled: { label: "Scheduled", cls: "bg-gray-100 text-gray-600" },
  expired: { label: "Expired", cls: "bg-gray-100 text-gray-600" },
  redeemed: { label: "Fully used", cls: "bg-amber-100 text-amber-700" },
  off: { label: "Off", cls: "bg-gray-100 text-gray-600" },
}

const EMPTY_FORM: PromoCodeInput = {
  code: "",
  label: "",
  discount_type: "percent",
  value: 10,
  valid_from: null,
  valid_to: null,
  max_uses: null,
  one_per_guest: true,
  active: true,
}

export default function PromoCodesManager() {
  const { toast } = useToast()
  const [codes, setCodes] = useState<PromoCodeData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [formBusy, setFormBusy] = useState(false)
  const [form, setForm] = useState<{ open: boolean; editing: PromoCodeData | null; data: PromoCodeInput }>({
    open: false,
    editing: null,
    data: EMPTY_FORM,
  })
  const [confirmDelete, setConfirmDelete] = useState<PromoCodeData | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    promoApi
      .list()
      .then(setCodes)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const saveForm = async () => {
    setFormBusy(true)
    try {
      if (form.editing) {
        const updated = await promoApi.update(form.editing.id, form.data)
        setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
        toast({ title: "Promo code updated", description: `${updated.code} saved.` })
      } else {
        const created = await promoApi.create(form.data)
        setCodes((prev) => [...prev, created])
        toast({ title: "Promo code created", description: `${created.code} is ready to use.` })
      }
      setForm({ open: false, editing: null, data: EMPTY_FORM })
    } catch (err) {
      toast({ title: "Couldn't save", description: errorMessage(err), variant: "error" })
    } finally {
      setFormBusy(false)
    }
  }

  const toggleActive = async (p: PromoCodeData) => {
    try {
      // Send only the flag — sending the whole record would overwrite fields
      // the server tracks (e.g. used_by, which this client never sees).
      const updated = await promoApi.update(p.id, { ...EMPTY_FORM, code: p.code, active: !p.active })
      setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      toast({ title: updated.active ? "Promo code turned on" : "Promo code turned off", description: updated.code })
    } catch (err) {
      toast({ title: "Couldn't update", description: errorMessage(err), variant: "error" })
    }
  }

  const runDelete = async () => {
    if (!confirmDelete) return
    setDeleteBusy(true)
    try {
      await promoApi.remove(confirmDelete.id)
      setCodes((prev) => prev.filter((c) => c.id !== confirmDelete.id))
      toast({ title: "Promo code deleted", description: confirmDelete.code })
    } catch (err) {
      toast({ title: "Couldn't delete", description: errorMessage(err), variant: "error" })
    } finally {
      setDeleteBusy(false)
      setConfirmDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-full rounded-[8px]" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-[6px] border border-[#e2e4e8] p-8 text-center">
        <p className="text-sm text-muted">Couldn't load promo codes.</p>
        <button
          onClick={load}
          className="mt-3 text-xs font-medium text-[#82285f] hover:underline cursor-pointer"
        >
          Refresh
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[12px] border border-[#82285f]/20 bg-[#82285f]/5 p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-[#82285f]" />
          <div>
            <p className="text-[13px] font-bold text-[#82285f]">Promo codes</p>
            <p className="text-[11px] text-[#6b7280]">
              Guests type these at checkout — great for NFC card promos and giveaways.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setForm({ open: true, editing: null, data: EMPTY_FORM })}
          className="inline-flex items-center gap-1.5 cursor-pointer rounded-[8px] bg-[#82285f] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#6b1f4d]"
        >
          <Plus className="h-3.5 w-3.5" />
          New code
        </button>
      </div>

      {codes.length === 0 ? (
        <div className="py-16 text-center text-[13px] text-[#6b7280]">
          No promo codes yet. Create one to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {codes.map((p) => {
            const status = promoStatus(p)
            const badge = STATUS_BADGE[status]
            return (
              <div key={p.id} className="rounded-[12px] border border-[#e5e7eb] bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[14px] font-bold text-[#1a1d26] font-mono truncate">{p.code}</h3>
                    {p.label && <p className="text-[11px] text-[#6b7280] truncate">{p.label}</p>}
                  </div>
                  <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.cls)}>
                    {badge.label}
                  </span>
                </div>

                <div className="mb-3 space-y-1 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6b7280]">Discount</span>
                    <span className="font-bold text-[#82285f]">
                      {p.discount_type === "percent" ? `${p.value}% off` : `₱${p.value.toLocaleString()} off`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6b7280]">Valid</span>
                    <span className="text-right font-semibold text-[#1a1d26]">
                      {p.valid_from && p.valid_to
                        ? `${longDate(p.valid_from)} – ${longDate(p.valid_to)}`
                        : p.valid_from
                          ? `From ${longDate(p.valid_from)}`
                          : p.valid_to
                            ? `Until ${longDate(p.valid_to)}`
                            : "Always"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6b7280]">Used</span>
                    <span className="font-semibold text-[#1a1d26]">
                      {p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#6b7280]">Per guest</span>
                    <span className="font-semibold text-[#1a1d26]">
                      {p.one_per_guest === false ? "Repeat allowed" : "One use each"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-[8px] bg-[#f8f9fb] p-2">
                  <button
                    type="button"
                    onClick={() => setForm({ open: true, editing: p, data: { ...p } })}
                    className="flex-1 inline-flex cursor-pointer items-center justify-center gap-1 rounded-[6px] border border-[#e2e4e8] bg-white px-2 py-1.5 text-[11px] font-medium text-[#4a4f59] transition-colors hover:border-[#c9ccd3] hover:text-[#1a1d26]"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleActive(p)}
                    title={p.active ? "Turn off" : "Turn on"}
                    className="inline-flex cursor-pointer items-center justify-center rounded-[6px] border border-[#e2e4e8] bg-white px-2 py-1.5 text-[11px] font-medium text-[#4a4f59] transition-colors hover:border-[#c9ccd3] hover:text-[#1a1d26]"
                  >
                    <Power className={cn("h-3 w-3", p.active ? "text-emerald-600" : "text-gray-400")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(p)}
                    title="Delete"
                    className="inline-flex cursor-pointer items-center justify-center rounded-[6px] border border-[#e2e4e8] bg-white px-2 py-1.5 text-[11px] font-medium text-[#4a4f59] transition-colors hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog
        open={form.open}
        onOpenChange={(open) => !formBusy && setForm({ open, editing: null, data: EMPTY_FORM })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.editing ? `Edit ${form.editing.code}` : "New promo code"}</DialogTitle>
            <DialogDescription>
              {form.editing
                ? "Update this code's discount, dates, or usage limit."
                : "Guests will type this code at checkout to get the discount."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-medium text-[#6b7280]">Code</span>
                <input
                  value={form.data.code}
                  onChange={(e) => setForm((f) => ({ ...f, data: { ...f.data, code: e.target.value.toUpperCase() } }))}
                  placeholder="e.g. NFC10"
                  maxLength={32}
                  className="mt-1 w-full rounded-[8px] border border-[#e2e4e8] px-3 py-2 text-[13px] font-mono text-[#1a1d26] outline-none focus:border-[#82285f]"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-[#6b7280]">Label (optional)</span>
                <input
                  value={form.data.label}
                  onChange={(e) => setForm((f) => ({ ...f, data: { ...f.data, label: e.target.value } }))}
                  placeholder="e.g. NFC launch promo"
                  maxLength={80}
                  className="mt-1 w-full rounded-[8px] border border-[#e2e4e8] px-3 py-2 text-[13px] text-[#1a1d26] outline-none focus:border-[#82285f]"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-[#6b7280]">Type</span>
                  <select
                    value={form.data.discount_type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, data: { ...f.data, discount_type: e.target.value as "percent" | "fixed" } }))
                    }
                    className="mt-1 w-full rounded-[8px] border border-[#e2e4e8] bg-white px-3 py-2 text-[13px] text-[#1a1d26] outline-none focus:border-[#82285f]"
                  >
                    <option value="percent">Percent off</option>
                    <option value="fixed">₱ off</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[#6b7280]">
                    {form.data.discount_type === "percent" ? "Percent" : "Amount (₱)"}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={form.data.discount_type === "percent" ? 100 : undefined}
                    value={form.data.value}
                    onChange={(e) => setForm((f) => ({ ...f, data: { ...f.data, value: Number(e.target.value) } }))}
                    className="mt-1 w-full rounded-[8px] border border-[#e2e4e8] px-3 py-2 text-[13px] text-[#1a1d26] outline-none focus:border-[#82285f]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-medium text-[#6b7280]">Valid from</span>
                  <input
                    type="date"
                    value={form.data.valid_from ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, data: { ...f.data, valid_from: e.target.value || null } }))}
                    className="mt-1 w-full rounded-[8px] border border-[#e2e4e8] px-3 py-2 text-[13px] text-[#1a1d26] outline-none focus:border-[#82285f]"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[#6b7280]">Valid until</span>
                  <input
                    type="date"
                    value={form.data.valid_to ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, data: { ...f.data, valid_to: e.target.value || null } }))}
                    className="mt-1 w-full rounded-[8px] border border-[#e2e4e8] px-3 py-2 text-[13px] text-[#1a1d26] outline-none focus:border-[#82285f]"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-[11px] font-medium text-[#6b7280]">Max uses (blank = unlimited)</span>
                <input
                  type="number"
                  min={1}
                  value={form.data.max_uses ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, data: { ...f.data, max_uses: e.target.value ? Number(e.target.value) : null } }))
                  }
                  className="mt-1 w-full rounded-[8px] border border-[#e2e4e8] px-3 py-2 text-[13px] text-[#1a1d26] outline-none focus:border-[#82285f]"
                />
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.data.one_per_guest ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, data: { ...f.data, one_per_guest: e.target.checked } }))}
                  className="h-4 w-4 accent-[#82285f]"
                />
                <span className="text-[12px] text-[#4a4f59]">
                  One use per guest (each account redeems it once)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.data.active}
                  onChange={(e) => setForm((f) => ({ ...f, data: { ...f.data, active: e.target.checked } }))}
                  className="h-4 w-4 accent-[#82285f]"
                />
                <span className="text-[12px] text-[#4a4f59]">Active (guests can use it right away)</span>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setForm({ open: false, editing: null, data: EMPTY_FORM })}
                disabled={formBusy}
                className="cursor-pointer rounded-[8px] border border-[#e2e4e8] bg-white px-4 py-2 text-[12px] font-medium text-[#6b7280] transition-colors hover:border-[#c9ccd3] hover:text-[#1a1d26] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveForm()}
                disabled={formBusy || !form.data.code.trim()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] bg-[#82285f] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#6b1f4d] disabled:opacity-50"
              >
                {formBusy ? (
                  "Saving..."
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    {form.editing ? "Save changes" : "Create code"}
                  </>
                )}
              </button>
            </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setConfirmDelete(null)
        }}
        variant="danger"
        title={`Delete ${confirmDelete?.code ?? ""}?`}
        description="Guests will no longer be able to use this code. Bookings that already used it keep their discount."
        confirmLabel="Delete code"
        loading={deleteBusy}
        loadingLabel="Deleting..."
        onConfirm={() => void runDelete()}
      />
    </div>
  )
}
