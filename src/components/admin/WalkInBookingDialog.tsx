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
  UserPlus, Bed, CalendarDays, Clock, Users, Mail, Banknote, PawPrint,
} from "lucide-react"
import LoadingDots from "@/components/LoadingDots"
import { getRooms } from "@/services/adminService"
import {
  bookingsApi, ApiError, publicRoomsApi,
  type WalkInBookingPayload, type RoomQuote,
} from "@/services/api"
import { useToast } from "@/contexts/ToastContext"
import type { AdminRoom } from "@/data/admin"
import { roomAllowsPets, formatRoomCapacity } from "@/lib/capacity"

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

/** '2:00 PM' / '14:00' → 24h hour — mirrors parseTimeToHour in RoomDetail. */
function parseTimeToHour(timeStr: string): number {
  const match = timeStr.match(/(\d+):00\s*(AM|PM)/i)
  if (!match) return 0
  let h = parseInt(match[1])
  const period = match[2].toUpperCase()
  if (period === "PM" && h !== 12) h += 12
  if (period === "AM" && h === 12) h = 0
  return h
}

function dayRate(room: AdminRoom, hours: number): number {
  const key = (`day_use_${hours}h`) as "day_use_3h" | "day_use_6h" | "day_use_8h" | "day_use_12h"
  const custom = room[key]
  if (custom != null && custom > 0) return custom
  return Math.round((room.price * hours) / 24)
}

const STATUS_CHIP: Record<string, string> = {
  available: "bg-[#1f8a5b]",
  occupied: "bg-[#b4741f]",
  maintenance: "bg-[#6b7280]",
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
  adults: number
  children: number
  pets: number
  specialRequests: string
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
    adults: 1,
    children: 0,
    pets: 0,
    specialRequests: "",
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
  const [quote, setQuote] = useState<RoomQuote | null>(null)
  /** roomId → free for the selected dates/times (undefined = not checked yet). */
  const [avail, setAvail] = useState<Record<string, boolean | undefined>>({})

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === form.roomId) ?? null,
    [rooms, form.roomId],
  )

  // Per-room guest caps — same rules the guest booking flow enforces
  // (GuestSelector): adults ≤ max_adults, children ≤ max_children when the
  // room allows them, pets ≤ 2 only when an amenity says the room allows pets.
  const limits = useMemo(() => {
    if (!selectedRoom) return null
    const maxAdults = selectedRoom.max_adults > 0 ? selectedRoom.max_adults : 10
    const maxChildren = selectedRoom.allows_children ? selectedRoom.max_children : 0
    const maxPets = roomAllowsPets(selectedRoom) ? 2 : 0
    return { maxAdults, maxChildren, maxPets }
  }, [selectedRoom])

  // Start-time slots — same rule as the guest flow (RoomDetail): on TODAY,
  // hours already passed (and the current hour itself) are locked out, so a
  // 12 PM desk can no longer encode a 6:00 AM day-use slot.
  const startTimes = useMemo(() => {
    const maxStart = Math.min(24 - form.duration, CLOSING_HOUR)
    const allTimes = generateStartTimes(maxStart)
    if (!form.checkIn) return allTimes
    const now = new Date()
    const selectedDate = new Date(form.checkIn)
    const isToday = selectedDate.toDateString() === now.toDateString()
    if (!isToday) return allTimes
    const currentHour = now.getHours()
    return allTimes.filter((t) => parseTimeToHour(t) > currentHour)
  }, [form.duration, form.checkIn])

  // Load the room inventory once per open and preselect the first bookable room.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setRoomsError(null)
    getRooms()
      .then((data) => {
        if (cancelled) return
        setRooms(data)
        setAvail({})
        setForm((f) => (
          f.roomId ? f : { ...f, roomId: data.find((r) => r.status !== "maintenance")?.id ?? "" }
        ))
      })
      .catch(() => {
        if (!cancelled) setRoomsError("Couldn't load rooms. Close and try again.")
      })
    return () => { cancelled = true }
  }, [open])

  // Re-clamp guest counts the moment a different room is picked.
  useEffect(() => {
    if (!limits) return
    setForm((f) => ({
      ...f,
      adults: Math.min(Math.max(1, f.adults), limits.maxAdults),
      children: Math.min(Math.max(0, f.children), limits.maxChildren),
      pets: Math.min(Math.max(0, f.pets), limits.maxPets),
    }))
    setErrors((e) => {
      if (!e.adults && !e.children && !e.pets) return e
      const rest = { ...e }
      delete rest.adults
      delete rest.children
      delete rest.pets
      return rest
    })
  }, [limits])

  // Keep the picked day-use slot valid when the duration narrows the window.
  useEffect(() => {
    if (form.stayType === "day" && !startTimes.includes(form.startTime)) {
      setForm((f) => ({ ...f, startTime: startTimes[0] ?? "" }))
    }
  }, [startTimes, form.stayType, form.startTime])

  // Server-quoted price (debounced) — the exact math create_booking charges,
  // with live AI-boost / holiday discounts, so the breakdown matches the
  // guest checkout line for line: subtotal, 12% tax, total.
  useEffect(() => {
    if (!open || !form.roomId) {
      setQuote(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      publicRoomsApi.quote({
        room_ids: [form.roomId],
        check_in: form.checkIn,
        ...(form.stayType === "overnight" ? { check_out: form.checkOut } : {}),
        stay_type: form.stayType,
        ...(form.stayType === "day" ? { duration: form.duration } : {}),
      })
        .then((q) => { if (!cancelled) setQuote(q[0] ?? null) })
        .catch(() => { if (!cancelled) setQuote(null) })
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, form.roomId, form.stayType, form.checkIn, form.checkOut, form.duration])

  // Same availability probe the guest flow uses (check-availability), run for
  // every room so the picker SHOWS which rooms are already in use for the
  // selected dates/times — both sides read the same bookings table, and the
  // bookings_no_overlap DB constraint backstops the write (migrate-time-window-overlap.sql).
  useEffect(() => {
    if (!open || rooms.length === 0) return
    const needTime = form.stayType === "day"
    if (!form.checkIn || (needTime && !form.startTime)) {
      setAvail({})
      return
    }
    if (form.stayType === "overnight" && !form.checkOut) {
      setAvail({})
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      Promise.all(
        rooms.map(async (r): Promise<[string, boolean | undefined]> => {
          try {
            const res = await publicRoomsApi.checkAvailability({
              room_id: r.id,
              check_in: form.checkIn,
              ...(form.stayType === "overnight" ? { check_out: form.checkOut } : {}),
              stay_type: form.stayType,
              ...(needTime ? { start_time: form.startTime, duration: form.duration } : {}),
            })
            return [r.id, res.available]
          } catch {
            return [r.id, undefined]
          }
        }),
      ).then((pairs) => {
        if (!cancelled) setAvail(Object.fromEntries(pairs))
      })
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, rooms, form.stayType, form.checkIn, form.checkOut, form.startTime, form.duration])

  // Drop a quote that no longer matches the picked dates (still in debounce).
  const freshQuote = useMemo(() => {
    if (!quote) return null
    if (quote.check_in !== form.checkIn) return null
    if (form.stayType === "overnight" && quote.check_out !== form.checkOut) return null
    if (form.stayType === "day" && quote.hours !== form.duration) return null
    return quote
  }, [quote, form.stayType, form.checkIn, form.checkOut, form.duration])

  const resetForm = () => {
    setForm(emptyForm())
    setErrors({})
    setSubmitError(null)
    setSaving(false)
    setQuote(null)
    setAvail({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof WalkInForm, string>> = {}
    const lim = limits ?? { maxAdults: 10, maxChildren: 10, maxPets: 2 }
    if (!form.roomId) errs.roomId = "Select a room"
    else if (avail[form.roomId] === false)
      errs.roomId = "This room is already booked for the selected dates/times"
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
    // Guest counts clamped to the selected room's capacity limits.
    if (!Number.isInteger(form.adults) || form.adults < 1)
      errs.adults = "Adults must be at least 1"
    else if (form.adults > lim.maxAdults)
      errs.adults = `Adults can't exceed ${lim.maxAdults} in this room`
    if (!Number.isInteger(form.children) || form.children < 0)
      errs.children = "Children can't be negative"
    else if (form.children > lim.maxChildren)
      errs.children = lim.maxChildren === 0
        ? "Children aren't allowed in this room"
        : `Children can't exceed ${lim.maxChildren} in this room`
    if (!Number.isInteger(form.pets) || form.pets < 0)
      errs.pets = "Pets can't be negative"
    else if (form.pets > lim.maxPets)
      errs.pets = lim.maxPets === 0
        ? "Pets aren't allowed in this room"
        : `Pets can't exceed ${lim.maxPets} in this room`
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitError(null)
    setSaving(true)
    // Walk-in payment is always settled in full at the counter.
    const payload: WalkInBookingPayload = {
      room_id: form.roomId,
      check_in: form.checkIn,
      stay_type: form.stayType,
      full_name: form.fullName.trim(),
      adults: form.adults,
      children: form.children,
      pets: form.pets,
      paid_now: true,
    }
    if (form.stayType === "overnight") payload.check_out = form.checkOut
    else {
      payload.start_time = form.startTime
      payload.duration = form.duration
    }
    if (form.email.trim()) payload.email = form.email.trim()
    if (form.specialRequests.trim()) payload.special_requests = form.specialRequests.trim()

    try {
      const res = await bookingsApi.createWalkIn(payload)
      // Stays starting today are stamped checked-in on arrival at the counter
      // (backend mirrors the QR check-in) — no scan needed for walk-ins.
      const startsToday = form.checkIn === new Date().toLocaleDateString("en-CA")
      toast({
        title: "Walk-in booking created",
        description: `${form.fullName} — ${startsToday ? "checked in · in-house" : "confirmed"}${res.linked_account ? " · linked to their account" : ""} · ₱${res.total_price.toLocaleString()}`,
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
    "w-full rounded-[6px] border border-[#e2e4e8] bg-white px-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all disabled:bg-[#f5f6f8] disabled:text-[#9ca3af]"
  const label = "block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1"

  /** Clamp on type + surface the limit as an error the moment it's exceeded. */
  const onGuestChange = (
    key: "adults" | "children" | "pets",
    raw: string,
    min: number,
    max: number,
    limitErr: string,
  ) => {
    const v = Number(raw)
    const finite = raw !== "" && Number.isFinite(v)
    setForm((f) => ({ ...f, [key]: finite ? Math.max(min, Math.min(max, Math.floor(v))) : min }))
    setErrors((e) => {
      const rest = { ...e }
      if (finite && v > max) rest[key] = limitErr
      else delete rest[key]
      return rest
    })
  }

  // Breakdown: server quote when fresh, local fallback while it loads/fails.
  const breakdown = useMemo(() => {
    if (!selectedRoom) return null
    const isDay = form.stayType === "day"
    const nights = isDay
      ? null
      : Math.max(1, nightsBetween(form.checkIn, form.checkOut))
    const localSubtotal = isDay
      ? dayRate(selectedRoom, form.duration)
      : selectedRoom.price * (nights ?? 1)
    const subtotal = freshQuote ? freshQuote.subtotal : localSubtotal
    const tax = freshQuote ? freshQuote.tax : Math.round(subtotal * 0.12)
    const saved = freshQuote ? localSubtotal - freshQuote.subtotal : 0
    // Day use shows the prorated day price in the rate row (it IS the
    // subtotal); overnight shows the nightly rate with a separate × nights row.
    const rate = isDay
      ? subtotal
      : freshQuote
        ? freshQuote.rate
        : selectedRoom.price
    const baseRate = isDay
      ? localSubtotal
      : freshQuote
        ? freshQuote.base_rate
        : selectedRoom.price
    return {
      rate,
      baseRate,
      subtotal,
      tax,
      total: subtotal + tax,
      discount: freshQuote?.discount ?? null,
      saved: saved > 0 ? saved : 0,
      nights,
    }
  }, [selectedRoom, freshQuote, form.stayType, form.checkIn, form.checkOut, form.duration])

  const limitsCaption = limits
    ? `Room limits — max ${limits.maxAdults} adult${limits.maxAdults === 1 ? "" : "s"} · ${
        limits.maxChildren === 0 ? "no children" : `${limits.maxChildren} child${limits.maxChildren === 1 ? "" : "ren"}`
      } · ${limits.maxPets === 0 ? "no pets" : `max ${limits.maxPets} pet${limits.maxPets === 1 ? "" : "s"}`}`
    : ""

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-[640px] max-h-[90vh] flex flex-col p-0 rounded-[6px] shadow-xl">
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

              {/* Room picker — visual cards with real room photos */}
              <div>
                <label className={label}>Room</label>
                {rooms.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-[248px] overflow-y-auto pr-1">
                    {rooms.map((r) => {
                      const isSel = form.roomId === r.id
                      const isMaint = r.status === "maintenance"
                      const booked = avail[r.id] === false
                      const cardDisabled = isMaint || booked
                      const chipKind = isMaint
                        ? "maintenance"
                        : booked
                          ? "booked"
                          : avail[r.id] === true
                            ? "available"
                            : r.status
                      const chipClass =
                        chipKind === "booked"
                          ? "bg-[#A4423A]"
                          : chipKind === "occupied"
                            ? STATUS_CHIP.occupied
                            : chipKind === "maintenance"
                              ? STATUS_CHIP.maintenance
                              : STATUS_CHIP.available
                      return (
                        <button
                          key={r.id}
                          type="button"
                          disabled={cardDisabled}
                          aria-pressed={isSel}
                          onClick={() => setForm((f) => ({ ...f, roomId: r.id }))}
                          className={`flex gap-2.5 rounded-[6px] border p-2 text-left transition-all ${
                            isSel
                              ? "border-[#82285f] bg-[#82285f]/5 ring-1 ring-[#82285f]"
                              : "border-[#e2e4e8] bg-white hover:border-[#82285f]/40"
                          } ${cardDisabled ? "opacity-55 cursor-not-allowed" : "cursor-pointer"}`}
                        >
                          <div className="relative h-[62px] w-[76px] shrink-0 overflow-hidden rounded-[4px] bg-[#f0f1f3] flex items-center justify-center">
                            {r.images?.[0] ? (
                              <img
                                src={r.images[0]}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Bed className="size-5 text-[#b0b3b8]" />
                            )}
                            <span
                              className={`absolute bottom-1 left-1 rounded-[3px] px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white ${chipClass}`}
                            >
                              {chipKind}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-bold text-[#1a1d26] truncate">
                              {r.name}
                            </p>
                            <p className="text-[11px] text-[#6b7280] truncate">
                              {r.type} · <span className="font-semibold text-[#82285f]">₱{r.price.toLocaleString()}</span>/night
                            </p>
                            <p className="text-[10px] text-[#9ca3af] truncate">
                              {formatRoomCapacity(r) ?? "Capacity listed at desk"}
                            </p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  !roomsError && <p className="text-[11px] text-[#9ca3af]">Loading rooms…</p>
                )}
                {errors.roomId && <p className="text-[10px] text-[#A4423A] mt-1">{errors.roomId}</p>}
                {selectedRoom && avail[selectedRoom.id] === false && (
                  <p className="text-[11px] font-semibold text-[#A4423A] bg-[#A4423A]/5 border border-[#A4423A]/20 rounded-[6px] px-3 py-2 mt-1">
                    {selectedRoom.name} ({selectedRoom.id}) is already booked for the selected dates/times — pick another room or change the schedule.
                  </p>
                )}
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
                <>
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
                  {startTimes.length === 0 && (
                    <p className="text-[11px] font-semibold text-[#A4423A] bg-[#A4423A]/5 border border-[#A4423A]/20 rounded-[6px] px-3 py-2">
                      No day-use slots left today — pick another date.
                    </p>
                  )}
                </div>
                </>
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

              {/* Guest counts — clamped to the selected room's limits */}
              <div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={label}>Adults</label>
                    <input
                      type="number"
                      value={form.adults}
                      min={1}
                      max={limits?.maxAdults ?? 10}
                      disabled={!limits}
                      onChange={(e) => onGuestChange(
                        "adults",
                        e.target.value,
                        1,
                        limits?.maxAdults ?? 10,
                        `Adults can't exceed ${limits?.maxAdults ?? 10} in this room`,
                      )}
                      className={field}
                    />
                    {errors.adults
                      ? <p className="text-[10px] text-[#A4423A] mt-1">{errors.adults}</p>
                      : limits && <p className="text-[10px] text-[#9ca3af] mt-1">Max {limits.maxAdults}</p>}
                  </div>
                  <div>
                    <label className={label}>Children</label>
                    <input
                      type="number"
                      value={form.children}
                      min={0}
                      max={limits?.maxChildren ?? 0}
                      disabled={!limits || limits.maxChildren === 0}
                      onChange={(e) => onGuestChange(
                        "children",
                        e.target.value,
                        0,
                        limits?.maxChildren ?? 0,
                        limits?.maxChildren
                          ? `Children can't exceed ${limits.maxChildren} in this room`
                          : "Children aren't allowed in this room",
                      )}
                      className={field}
                    />
                    {errors.children
                      ? <p className="text-[10px] text-[#A4423A] mt-1">{errors.children}</p>
                      : limits && (
                        <p className="text-[10px] text-[#9ca3af] mt-1">
                          {limits.maxChildren === 0 ? "Not allowed" : `Max ${limits.maxChildren}`}
                        </p>
                      )}
                  </div>
                  <div>
                    <label className={label}>Pets</label>
                    <input
                      type="number"
                      value={form.pets}
                      min={0}
                      max={limits?.maxPets ?? 0}
                      disabled={!limits || limits.maxPets === 0}
                      onChange={(e) => onGuestChange(
                        "pets",
                        e.target.value,
                        0,
                        limits?.maxPets ?? 0,
                        limits?.maxPets
                          ? `Pets can't exceed ${limits.maxPets} in this room`
                          : "Pets aren't allowed in this room",
                      )}
                      className={field}
                    />
                    {errors.pets
                      ? <p className="text-[10px] text-[#A4423A] mt-1">{errors.pets}</p>
                      : limits && (
                        <p className={`text-[10px] mt-1 flex items-center gap-1 ${limits.maxPets === 0 ? "text-[#9ca3af]" : "text-[#6b7280]"}`}>
                          {limits.maxPets > 0 && <PawPrint className="size-3" />}
                          {limits.maxPets === 0 ? "Not allowed" : `Max ${limits.maxPets}`}
                        </p>
                      )}
                  </div>
                </div>
                {limits && <p className="text-[10px] text-[#6b7280] mt-1.5">{limitsCaption}</p>}
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
              <div className="flex items-center gap-2 rounded-[6px] border border-[#1f8a5b]/25 bg-[#1f8a5b]/8 px-3 py-2">
                <Banknote className="size-3.5 text-[#1f8a5b] shrink-0" />
                <span className="text-[11px] font-semibold text-[#1f8a5b]">
                  Full payment collected at the counter
                </span>
              </div>

              <div>
                <label className={label}>Payment Method</label>
                <div className={`${field} flex items-center gap-2 bg-[#f5f6f8]`}>
                  <Banknote className="size-3.5 text-[#1f8a5b] shrink-0" />
                  <span className="text-[#6b7280]">Cash — settled at the counter</span>
                </div>
              </div>

              {/* Price breakdown — same rows and math as the guest checkout */}
              {breakdown && (
                <div className="rounded-[6px] border border-[#82285f]/20 bg-[#82285f]/5 px-3 py-2.5 space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b7280]">
                      {form.stayType === "overnight" ? "Per night" : `Day Use (${form.duration}h)`}
                    </span>
                    <span className="text-[#1a1d26]">
                      {breakdown.saved > 0 && (
                        <s className="text-[#9ca3af] mr-1.5">₱{breakdown.baseRate.toLocaleString()}</s>
                      )}
                      ₱{breakdown.rate.toLocaleString()}
                    </span>
                  </div>
                  {breakdown.saved > 0 && breakdown.discount && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#6b7280]">
                        {breakdown.discount.name} ({breakdown.discount.percent}% off)
                      </span>
                      <span className="text-[#A4423A]">-₱{breakdown.saved.toLocaleString()}</span>
                    </div>
                  )}
                  {breakdown.nights != null && (
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#6b7280]">
                        × {breakdown.nights} {breakdown.nights === 1 ? "night" : "nights"}
                      </span>
                      <span className="text-[#1a1d26]">₱{breakdown.subtotal.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[#6b7280]">Taxes &amp; fees (12%)</span>
                    <span className="text-[#1a1d26]">₱{breakdown.tax.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-[#82285f]/15">
                    <span className="text-[12px] font-semibold text-[#1a1d26]">Total</span>
                    <span className="text-[16px] font-bold text-[#82285f]">₱{breakdown.total.toLocaleString()}</span>
                  </div>
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
            disabled={saving || rooms.length === 0 || !!roomsError || avail[form.roomId] === false}
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
