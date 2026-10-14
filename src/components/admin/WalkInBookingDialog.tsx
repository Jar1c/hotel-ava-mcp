import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  UserPlus, Bed, CalendarDays, Clock, Users, Mail, Phone, Banknote, Wallet,
} from "lucide-react"
import LoadingDots from "@/components/LoadingDots"
import { getRooms } from "@/services/adminService"
import { bookingsApi, ApiError, type WalkInBookingPayload } from "@/services/api"
import { useToast } from "@/contexts/ToastContext"
import type { AdminRoom } from "@/data/admin"

const DAY_USE_DURATIONS = [3, 6, 8, 12] as const
const CLOSING_HOUR = 22 // 10 PM — same cap as the guest booking flow

/** Local calendar day (not UTC — toISOString is a day off before 8 AM in Manila). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return isoLocal(d)
}

function nightsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${to}T00:00:00`).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}

/** Hourly slots 6 AM → cap — mirrors generateStartTimes in RoomDetail. */
function generateStartTimes(maxHour: number): string[] {
  const times: string[] = []
  for (let h = 6; h <= maxHour; h++) {
    const period = h >= 12 ? "PM" : "AM"
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h
    times.push(`${hour12}:00 ${period}`)
  }
  return times
}

function dayRate(room: AdminRoom, hours: number): number {
  const key = (`day_use_${hours}h`) as "day_use_3h" | "day_use_6h" | "day_use_8h" | "day_use_12h"
  const custom = room[key]
  if (custom != null && custom > 0) return custom
  return Math.round((room.price * hours) / 24)
}

interface WalkInForm {
  roomId: string
  stayType: "overnight" | "day"
  checkIn: string
  checkOut: string
  startTime: string
  duration: number
  fullName: string
  email: string
  phone: string
  adults: number
  children: number
  specialRequests: string
  paidNow: boolean
  paymentMethod: string
}

function emptyForm(): WalkInForm {
  const today = isoLocal(new Date())
  return {
    roomId: "",
    stayType: "overnight",
    checkIn: today,
    checkOut: addDaysIso(today, 1),
    startTime: "",
    duration: 3,
    fullName: "",
    email: "",
    phone: "",
    adults: 1,
    children: 0,
    specialRequests: "",
    paidNow: true,
    paymentMethod: "cash",
  }
}

interface WalkInBookingDialogProps {
  open: boolean
  onClose: () => void
  /** Fired after a successful create — the page refetches its list. */
  onCreated: () => void
}

export default function WalkInBookingDialog({ open, onClose, onCreated }: WalkInBookingDialogProps) {
  const { toast } = useToast()
  const [form, setForm] = useState<WalkInForm>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof WalkInForm, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rooms, setRooms] = useState<AdminRoom[]>([])
  const [roomsError, setRoomsError] = useState<string | null>(null)

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === form.roomId) ?? null,
    [rooms, form.roomId],
  )

  const startTimes = useMemo(() => {
    const maxStart = Math.min(24 - form.duration, CLOSING_HOUR)
    return generateStartTimes(maxStart)
  }, [form.duration])

  // Load the room inventory once per open and preselect the first room.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRoomsError(null)
    getRooms()
      .then((data) => {
        if (cancelled) return
        setRooms(data)
        setForm((f) => (f.roomId ? f : { ...f, roomId: data[0]?.id ?? "" }))
      })
      .catch(() => {
        if (!cancelled) setRoomsError("Couldn't load rooms. Close and try again.")
      })
    return () => { cancelled = true }
  }, [open])

  // Keep the picked day-use slot valid when the duration narrows the window.
  useEffect(() => {
    if (form.stayType === "day" && !startTimes.includes(form.startTime)) {
      setForm((f) => ({ ...f, startTime: startTimes[0] ?? "" }))
    }
  }, [startTimes, form.stayType, form.startTime])

  const resetForm = () => {
    setForm(emptyForm())
    setErrors({})
    setSubmitError(null)
    setSaving(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof WalkInForm, string>> = {}
    if (!form.roomId) errs.roomId = "Select a room"
    if (!form.fullName.trim()) errs.fullName = "Guest name is required"
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errs.email = "Enter a valid email or leave it blank"
    if (!form.checkIn) errs.checkIn = "Check-in date is required"
    if (form.stayType === "overnight") {
      if (!form.checkOut) errs.checkOut = "Check-out date is required"
      else if (nightsBetween(form.checkIn, form.checkOut) < 1)
        errs.checkOut = "Check-out must be after check-in"
    } else if (!form.startTime) {
      errs.startTime = "Start time is required"
    }
    if (!Number.isInteger(form.adults) || form.adults < 1 || form.adults > 10)
      errs.adults = "Adults must be 1–10"
    if (!Number.isInteger(form.children) || form.children < 0 || form.children > 10)
      errs.children = "Children must be 0–10"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitError(null)
    setSaving(true)
    const payload: WalkInBookingPayload = {
      room_id: form.roomId,
      check_in: form.checkIn,
      stay_type: form.stayType,
      full_name: form.fullName.trim(),
      adults: form.adults,
      children: form.children,
      paid_now: form.paidNow,
      payment_method: form.paymentMethod,
    }
    if (form.stayType === "overnight") payload.check_out = form.checkOut
    else {
      payload.start_time = form.startTime
      payload.duration = form.duration
    }
    if (form.email.trim()) payload.email = form.email.trim()
    if (form.phone.trim()) payload.phone = form.phone.trim()
    if (form.specialRequests.trim()) payload.special_requests = form.specialRequests.trim()

    try {
      const res = await bookingsApi.createWalkIn(payload)
      toast({
        title: "Walk-in booking created",
        description: `${form.fullName} — confirmed${res.linked_account ? " · linked to their account" : ""} · ₱${res.total_price.toLocaleString()}`,
        variant: "success",
      })
      onCreated()
      handleClose()
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Failed to create booking"
      setSubmitError(msg)
      setSaving(false)
    }
  }

  const field =
    "w-full rounded-[6px] border border-[#e2e4e8] bg-white px-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
  const label = "block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1"

  // Live estimate — the server recomputes authoritatively (discounts included).
  const estimate = selectedRoom
    ? form.stayType === "overnight"
      ? selectedRoom.price * Math.max(1, nightsBetween(form.checkIn, form.checkOut))
      : dayRate(selectedRoom, form.duration)
    : null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-[560px] max-h-[90vh] flex flex-col p-0 rounded-[6px] shadow-xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e2e4e8]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-[6px] bg-[#82285f]/8 flex items-center justify-center">
              <UserPlus className="size-5 text-[#82285f]" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-bold text-[#1a1d26] leading-tight">
                New Walk-In Booking
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[#9ca3af] mt-0.5">
                Encode a reservation for a guest at the front desk — no account needed
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Section: Stay Details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-4 rounded-full bg-[#82285f]" />
              <h3 className="text-[13px] font-bold text-[#1a1d26]">Stay Details</h3>
            </div>

            <div className="space-y-3">
              {roomsError && (
                <p className="text-[11px] text-[#A4423A] bg-[#A4423A]/5 border border-[#A4423A]/20 rounded-[6px] px-3 py-2">
                  {roomsError}
                </p>
              )}

              {/* Room */}
              <div>
                <label className={label}>Room</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <Bed className="size-3.5" />
                  </div>
                  <select
                    value={form.roomId}
                    onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
                    className={`${field} pl-9 pr-8 appearance-none`}
                  >
                    <option value="">Select a room…</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} — ₱{r.price.toLocaleString()}/night ({r.type})
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
                {errors.roomId && <p className="text-[10px] text-[#A4423A] mt-1">{errors.roomId}</p>}
              </div>

              {/* Stay type */}
              <div>
                <label className={label}>Stay Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([["overnight", "Overnight"], ["day", "Day Use"]] as const).map(([value, text]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, stayType: value }))}
                      className={`rounded-[6px] border px-3 py-2.5 text-[13px] font-semibold transition-all ${
                        form.stayType === value
                          ? "border-[#82285f] bg-[#82285f] text-white"
                          : "border-[#e2e4e8] bg-white text-[#6b7280] hover:border-[#82285f]/40"
                      }`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dates / time window */}
              {form.stayType === "overnight" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label}>Check-In</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                        <CalendarDays className="size-3.5" />
                      </div>
                      <input
                        type="date"
                        value={form.checkIn}
                        min={isoLocal(new Date())}
                        onChange={(e) => {
                          const v = e.target.value
                          setForm((f) => ({
                            ...f,
                            checkIn: v,
                            checkOut: nightsBetween(v, f.checkOut) < 1 ? addDaysIso(v, 1) : f.checkOut,
                          }))
                        }}
                        className={`${field} pl-9`}
                      />
                    </div>
                    {errors.checkIn && <p className="text-[10px] text-[#A4423A] mt-1">{errors.checkIn}</p>}
                  </div>
                  <div>
                    <label className={label}>Check-Out</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                        <CalendarDays className="size-3.5" />
                      </div>
                      <input
                        type="date"
                        value={form.checkOut}
                        min={addDaysIso(form.checkIn, 1)}
                        onChange={(e) => setForm((f) => ({ ...f, checkOut: e.target.value }))}
                        className={`${field} pl-9`}
                      />
                    </div>
                    {errors.checkOut && <p className="text-[10px] text-[#A4423A] mt-1">{errors.checkOut}</p>}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={label}>Date</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                        <CalendarDays className="size-3.5" />
                      </div>
                      <input
                        type="date"
                        value={form.checkIn}
                        min={isoLocal(new Date())}
                        onChange={(e) => setForm((f) => ({ ...f, checkIn: e.target.value }))}
                        className={`${field} pl-9`}
                      />
                    </div>
                    {errors.checkIn && <p className="text-[10px] text-[#A4423A] mt-1">{errors.checkIn}</p>}
                  </div>
                  <div>
                    <label className={label}>Start Time</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                        <Clock className="size-3.5" />
                      </div>
                      <select
                        value={form.startTime}
                        onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                        className={`${field} pl-9 pr-8 appearance-none`}
                      >
                        {startTimes.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                    {errors.startTime && <p className="text-[10px] text-[#A4423A] mt-1">{errors.startTime}</p>}
                  </div>
                  <div>
                    <label className={label}>Duration</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                        <Clock className="size-3.5" />
                      </div>
                      <select
                        value={form.duration}
                        onChange={(e) => setForm((f) => ({ ...f, duration: Number(e.target.value) }))}
                        className={`${field} pl-9 pr-8 appearance-none`}
                      >
                        {DAY_USE_DURATIONS.map((h) => (
                          <option key={h} value={h}>{h} hours</option>
                        ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
                        <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Guest Details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-4 rounded-full bg-[#82285f]" />
              <h3 className="text-[13px] font-bold text-[#1a1d26]">Guest Details</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className={label}>Full Name</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <Users className="size-3.5" />
                  </div>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="e.g. Juan Dela Cruz"
                    className={`${field} pl-9`}
                  />
                </div>
                {errors.fullName && <p className="text-[10px] text-[#A4423A] mt-1">{errors.fullName}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Email (optional)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <Mail className="size-3.5" />
                    </div>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="guest@email.com"
                      className={`${field} pl-9`}
                    />
                  </div>
                  {errors.email && <p className="text-[10px] text-[#A4423A] mt-1">{errors.email}</p>}
                  <p className="text-[10px] text-[#6b7280] mt-1">Fills in when the guest has an account</p>
                </div>
                <div>
                  <label className={label}>Phone (optional)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <Phone className="size-3.5" />
                    </div>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="09XX XXX XXXX"
                      className={`${field} pl-9`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>Adults</label>
                  <input
                    type="number"
                    value={form.adults}
                    min={1}
                    max={10}
                    onChange={(e) => setForm((f) => ({ ...f, adults: Number(e.target.value) }))}
                    className={field}
                  />
                  {errors.adults && <p className="text-[10px] text-[#A4423A] mt-1">{errors.adults}</p>}
                </div>
                <div>
                  <label className={label}>Children</label>
                  <input
                    type="number"
                    value={form.children}
                    min={0}
                    max={10}
                    onChange={(e) => setForm((f) => ({ ...f, children: Number(e.target.value) }))}
                    className={field}
                  />
                  {errors.children && <p className="text-[10px] text-[#A4423A] mt-1">{errors.children}</p>}
                </div>
              </div>

              <div>
                <label className={label}>Special Requests (optional)</label>
                <textarea
                  value={form.specialRequests}
                  onChange={(e) => setForm((f) => ({ ...f, specialRequests: e.target.value }))}
                  placeholder="Late arrival, extra pillows, high floor…"
                  rows={2}
                  className={`${field} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Section: Payment */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-4 rounded-full bg-[#82285f]" />
              <h3 className="text-[13px] font-bold text-[#1a1d26]">Payment at Desk</h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {([[true, "Paid in full now"], [false, "Pay later"]] as const).map(([value, text]) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, paidNow: value }))}
                    className={`rounded-[6px] border px-3 py-2.5 text-[13px] font-semibold transition-all ${
                      form.paidNow === value
                        ? "border-[#82285f] bg-[#82285f] text-white"
                        : "border-[#e2e4e8] bg-white text-[#6b7280] hover:border-[#82285f]/40"
                    }`}
                  >
                    {text}
                  </button>
                ))}
              </div>

              <div className={form.paidNow ? "" : "opacity-50 pointer-events-none"}>
                <label className={label}>Payment Method</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    {form.paymentMethod === "cash"
                      ? <Banknote className="size-3.5" />
                      : <Wallet className="size-3.5" />}
                  </div>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    className={`${field} pl-9 pr-8 appearance-none`}
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="card">Card</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              </div>

              {estimate != null && (
                <div className="rounded-[6px] border border-[#82285f]/20 bg-[#82285f]/5 px-3 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] text-[#6b7280]">
                    Estimated total {form.stayType === "overnight"
                      ? `· ${Math.max(1, nightsBetween(form.checkIn, form.checkOut))} night(s)`
                      : `· ${form.duration}h day use`}
                  </span>
                  <span className="text-[14px] font-bold text-[#82285f]">₱{estimate.toLocaleString()}</span>
                </div>
              )}
              <p className="text-[10px] text-[#9ca3af]">
                Final price is computed by the server — active AI-boost and holiday discounts apply automatically.
              </p>
            </div>
          </div>

          {submitError && (
            <div className="rounded-[6px] border border-[#A4423A]/30 bg-[#A4423A]/5 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-[#A4423A]">{submitError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#e2e4e8] px-6 py-4 flex items-center justify-end gap-2.5 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={saving}
            className="text-[12px] border-[#e2e4e8] text-[#6b7280] hover:bg-[#f5f6f8] rounded-[6px] px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || rooms.length === 0 || !!roomsError}
            className="bg-[#82285f] hover:bg-[#6b1f4b] disabled:bg-[#d5d8dd] disabled:cursor-not-allowed text-white text-[12px] rounded-[6px] px-4 py-2 gap-1.5"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <LoadingDots size="sm" />
                Creating...
              </span>
            ) : (
              <>
                <UserPlus className="size-3.5" />
                Create Booking
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
