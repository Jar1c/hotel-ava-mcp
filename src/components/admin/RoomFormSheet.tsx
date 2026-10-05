import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  X, CloudUpload, Bed, SquarePen, Users, CircleDot,
  Snowflake, ShowerHead, Wifi, Monitor, Tv, Wind, SprayCan, Car, Bath, Waves, Music, PawPrint,
} from "lucide-react"
import { uploadApi } from "@/services/api"
import LoadingDots from "@/components/LoadingDots"
import type { AdminRoom } from "@/data/admin"

export interface RoomFormData {
  name: string
  type: string
  price: number
  capacity: number
  max_adults: number
  max_children: number
  allows_children: boolean
  allows_pets?: boolean
  max_pets?: number
  amenities: string[]
  images: string[]
  description: string
  status: "available" | "occupied" | "maintenance"
  /** Admin-set day-use rates (₱) — null/blank = auto pro-rata from price. */
  day_use_3h?: number | null
  day_use_6h?: number | null
  day_use_8h?: number | null
  day_use_12h?: number | null
}

const MAX_IMAGES = 5

const roomTypes = ["Standard", "Deluxe", "Executive Deluxe", "Junior Suite", "Superior Suite"]

// Hotel Ava Malate room type presets
const roomTypePresets: Record<string, { capacity: number; max_adults: number; max_children: number; allows_children: boolean; amenities: string[] }> = {
  "Standard": {
    capacity: 2,
    max_adults: 2,
    max_children: 1,
    allows_children: true,
    amenities: ["Air Conditioning", "Free WiFi", "Cable TV", "Hot & Cold Shower", "Personal Care Kit"],
  },
  "Deluxe": {
    capacity: 2,
    max_adults: 2,
    max_children: 1,
    allows_children: true,
    amenities: ["Air Conditioning", "Free WiFi", "Smart TV", "Hot & Cold Shower", "Personal Care Kit", "Hairdryer", "Private Garage"],
  },
  "Executive Deluxe": {
    capacity: 2,
    max_adults: 2,
    max_children: 0,
    allows_children: false,
    amenities: ["Air Conditioning", "Free WiFi", "Smart TV", "Hot & Cold Shower", "Personal Care Kit", "Hairdryer", "Private Garage", "Bathtub"],
  },
  "Junior Suite": {
    capacity: 4,
    max_adults: 3,
    max_children: 2,
    allows_children: true,
    amenities: ["Air Conditioning", "Free WiFi", "Smart TV", "Hot & Cold Shower", "Personal Care Kit", "Hairdryer", "Private Garage", "Bathtub", "KTV"],
  },
  "Superior Suite": {
    capacity: 4,
    max_adults: 4,
    max_children: 0,
    allows_children: false,
    amenities: ["Air Conditioning", "Free WiFi", "Smart TV", "Hot & Cold Shower", "Personal Care Kit", "Hairdryer", "Private Garage", "Bathtub", "Jacuzzi", "KTV"],
  },
}

const amenityIcons: Record<string, React.ReactNode> = {
  "Air Conditioning": <Snowflake className="size-3.5 text-black" />,
  "Hot & Cold Shower": <ShowerHead className="size-3.5 text-black" />,
  "Free WiFi": <Wifi className="size-3.5 text-black" />,
  "Cable TV": <Monitor className="size-3.5 text-black" />,
  "Smart TV": <Tv className="size-3.5 text-black" />,
  "Hairdryer": <Wind className="size-3.5 text-black" />,
  "Personal Care Kit": <SprayCan className="size-3.5 text-black" />,
  "Private Garage": <Car className="size-3.5 text-black" />,
  "Parking": <Car className="size-3.5 text-black" />,
  "Bathtub": <Bath className="size-3.5 text-black" />,
  "Jacuzzi": <Waves className="size-3.5 text-black" />,
  "KTV": <Music className="size-3.5 text-black" />,
}

interface RoomFormSheetProps {
  open: boolean
  onClose: () => void
  onSave: (data: RoomFormData) => Promise<void> | void
  editRoom?: AdminRoom | null
  otherRoomNames?: string[]
}

function emptyForm(): RoomFormData {
  const preset = roomTypePresets["Standard"]
  return {
    name: "",
    type: "Standard",
    price: 0,
    capacity: preset.capacity,
    max_adults: preset.max_adults,
    max_children: preset.max_children,
    allows_children: preset.allows_children,
    allows_pets: false,
    max_pets: 0,
    amenities: [...preset.amenities],
    images: [],
    description: "",
    status: "available",
    day_use_3h: null,
    day_use_6h: null,
    day_use_8h: null,
    day_use_12h: null,
  }
}

function extractPath(url: string): string | null {
  const marker = "/object/public/room-images/"
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

export default function RoomFormSheet({ open, onClose, onSave, editRoom, otherRoomNames = [] }: RoomFormSheetProps) {
  const [form, setForm] = useState<RoomFormData>(() => {
    if (editRoom) {
      const max_adults = editRoom.max_adults || 2
      const max_children = editRoom.max_children ?? 1
      const allows_pets = (editRoom.amenities || []).some((a) => a.includes("Pet"))
      return { ...editRoom, max_adults, max_children, capacity: max_adults + max_children, images: editRoom.images || [], allows_pets, max_pets: allows_pets ? 2 : 0 }
    }
    return emptyForm()
  })
  const [errors, setErrors] = useState<Partial<Record<keyof RoomFormData, string>>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [, setUploadQueue] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    if (editRoom) {
      const pets = (editRoom.amenities || []).some((a) => a.includes("Pet"))
      setForm({ ...editRoom, images: editRoom.images || [], allows_pets: pets, max_pets: pets ? 2 : 0 })
    } else {
      setForm(emptyForm())
    }
    setErrors({})
    setUploading(false)
    setUploadProgress(0)
    setUploadQueue([])
    setSaving(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof RoomFormData, string>> = {}
    const name = form.name.trim()
    if (!name) errs.name = "Room name is required"
    else if (name.length > 100) errs.name = "Room name must not exceed 100 characters"
    else if (otherRoomNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) errs.name = "A room with this name already exists"
    if (!form.type) errs.type = "Room type is required"
    if (!Number.isInteger(form.price) || form.price <= 0) errs.price = "Price must be a whole number greater than 0"
    else if (form.price > 1000000) errs.price = "Price must not exceed ₱1,000,000"
    if (!Number.isInteger(form.max_adults) || form.max_adults < 1 || form.max_adults > 10) errs.max_adults = "Max adults must be a whole number from 1 to 10"
    if (!Number.isInteger(form.max_children) || form.max_children < 0 || form.max_children > 10) errs.max_children = "Max children must be a whole number from 0 to 10"
    if (!Number.isInteger(form.max_pets ?? 0) || (form.max_pets ?? 0) < 0 || (form.max_pets ?? 0) > 2) errs.max_pets = "Max pets must be 0, 1, or 2"
    if (!Number.isInteger(form.capacity) || form.capacity <= 0) errs.capacity = "Total capacity must be greater than 0"
    if (form.images.length === 0) errs.images = "At least 1 image is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    // The pet amenity follows the numeric pet limit (0 = pets not allowed)
    const petAmenity = "Pets (Max 2 Allowed)"
    const petCount = form.max_pets ?? 0
    const amenities = petCount > 0
      ? (form.amenities.includes(petAmenity) ? form.amenities : [...form.amenities, petAmenity])
      : form.amenities.filter((a) => a !== petAmenity)
    setSaving(true)
    try {
      await onSave({ ...form, amenities, allows_children: form.max_children > 0, allows_pets: petCount > 0 })
      handleClose()
    } catch {
      // keep dialog open on error
    } finally {
      setSaving(false)
    }
  }

  const toggleAmenity = (amenity: string) => {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(amenity)
        ? f.amenities.filter((a) => a !== amenity)
        : [...f.amenities, amenity],
    }))
  }

  const processQueue = async (queue: File[]) => {
    setUploading(true)
    const urls: string[] = []

    for (let i = 0; i < queue.length; i++) {
      const file = queue[i]
      setUploadProgress(Math.round(((i) / queue.length) * 100))
      try {
        const result = await uploadApi.image(file)
        urls.push(result.url)
      } catch {
        // skip failed uploads
      }
    }

    setUploadProgress(100)
    setForm((f) => ({ ...f, images: [...f.images, ...urls] }))
    setTimeout(() => {
      setUploading(false)
      setUploadProgress(0)
      setUploadQueue([])
    }, 300)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const remaining = MAX_IMAGES - form.images.length
    const toUpload = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, remaining)
    if (toUpload.length > 0) processQueue(toUpload)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (!files || files.length === 0) return
    const remaining = MAX_IMAGES - form.images.length
    const toUpload = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, remaining)
    if (toUpload.length > 0) processQueue(toUpload)
  }

  const removeImage = async (index: number) => {
    const url = form.images[index]
    const path = extractPath(url)
    if (path) {
      uploadApi.delete(path).catch(() => {})
    }
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))
  }

  const canAddMore = form.images.length < MAX_IMAGES && !uploading
  const canSubmit = form.images.length > 0 && !uploading && !saving

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-[560px] max-h-[90vh] flex flex-col p-0 rounded-[6px] shadow-xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#e2e4e8]">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-[6px] bg-[#82285f]/8 flex items-center justify-center">
              <Bed className="size-5 text-[#82285f]" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-bold text-[#1a1d26] leading-tight">
                {editRoom ? "Edit Room" : "Add New Room"}
              </DialogTitle>
              <DialogDescription className="text-[12px] text-[#9ca3af] mt-0.5">
                {editRoom ? `Editing ${editRoom.name}` : "Create a new room in your inventory"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Section: Room Details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-4 rounded-full bg-[#82285f]" />
              <h3 className="text-[13px] font-bold text-[#1a1d26]">Room Details</h3>
            </div>

            <div className="space-y-3">
              {/* Room Name */}
              <div>
                <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Room Name</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <SquarePen className="size-3.5" />
                  </div>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => {
                      const value = e.target.value
                      setForm((f) => ({ ...f, name: value }))
                      // Live duplicate-name check against the other rooms
                      const dup = otherRoomNames.some((n) => n.trim().toLowerCase() === value.trim().toLowerCase())
                      setErrors((prev) => {
                        if (dup) return { ...prev, name: "A room with this name already exists" }
                        if (prev.name === "A room with this name already exists") {
                          const next = { ...prev }
                          delete next.name
                          return next
                        }
                        return prev
                      })
                    }}
                    placeholder="e.g. Deluxe Room"
                    className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                  />
                </div>
                {errors.name && <p className="text-[10px] text-[#A4423A] mt-1">{errors.name}</p>}
              </div>

              {/* Type + Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Type</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <Bed className="size-3.5" />
                    </div>
                    <select
                      value={form.type}
                      onChange={(e) => {
                        const newType = e.target.value
                        const preset = roomTypePresets[newType]
                        setForm((f) => ({
                          ...f,
                          type: newType,
                          capacity: preset?.capacity ?? f.capacity,
                          max_adults: preset?.max_adults ?? f.max_adults,
                          max_children: preset?.max_children ?? f.max_children,
                          allows_children: preset?.allows_children ?? f.allows_children,
                          allows_pets: false,
                          max_pets: 0,
                          amenities: preset?.amenities ?? f.amenities,
                        }))
                      }}
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-8 py-2.5 text-[13px] text-[#1a1d26] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all appearance-none"
                    >
                      {roomTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
                      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                    </div>
                  </div>
                  {errors.type && <p className="text-[10px] text-[#A4423A] mt-1">{errors.type}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Price (₱/Night)</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <span className="text-[12px] font-semibold">₱</span>
                    </div>
                    <input
                      type="number"
                      value={form.price || ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 7)
                        setForm((f) => ({ ...f, price: v ? Number(v) : 0 }))
                      }}
                      placeholder="2400"
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                    />
                  </div>
                  {errors.price && <p className="text-[10px] text-[#A4423A] mt-1">{errors.price}</p>}
                </div>
              </div>

              {/* Day use pricing — optional per-duration rates */}
              <div>
                <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">
                  Day use pricing (₱) — optional
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[3, 6, 8, 12].map((h) => {
                    const key = (`day_use_${h}h`) as "day_use_3h" | "day_use_6h" | "day_use_8h" | "day_use_12h"
                    const fallback = form.price ? Math.round((form.price * h) / 24) : null
                    const val = form[key]
                    return (
                      <div key={h} className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#9ca3af] tabular-nums">
                          {h}h
                        </span>
                        <input
                          type="number"
                          value={val ?? ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 7)
                            setForm((f) => ({ ...f, [key]: v ? Number(v) : null }))
                          }}
                          placeholder={fallback ? String(fallback) : "—"}
                          aria-label={`Day use price for ${h} hours`}
                          className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-8 pr-2 py-2 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all tabular-nums"
                        />
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-[#9ca3af] mt-1">
                  Blank = auto price from the nightly rate (₱/24 × hours). The placeholder shows what auto would charge.
                </p>
              </div>

              {/* Guest Limits */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Max Adults</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <Users className="size-3.5" />
                    </div>
                    <input
                      type="number"
                      value={form.max_adults || ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2)
                        setForm((f) => {
                          const max_adults = v ? Number(v) : 0
                          return { ...f, max_adults, capacity: max_adults + f.max_children }
                        })
                      }}
                      min={1}
                      max={10}
                      placeholder="2"
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                    />
                  </div>
                  {errors.max_adults && <p className="text-[10px] text-[#A4423A] mt-1">{errors.max_adults}</p>}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Max Children</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <Users className="size-3.5" />
                    </div>
                    <input
                      type="number"
                      value={form.max_children || ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 2)
                        setForm((f) => {
                          const max_children = v ? Number(v) : 0
                          return { ...f, max_children, capacity: f.max_adults + max_children, allows_children: max_children > 0 }
                        })
                      }}
                      min={0}
                      max={10}
                      placeholder="1"
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                    />
                  </div>
                  {errors.max_children && <p className="text-[10px] text-[#A4423A] mt-1">{errors.max_children}</p>}
                  <p className="text-[10px] text-[#6b7280] mt-1">0 = children not allowed</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Max Pets</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <PawPrint className="size-3.5" />
                    </div>
                    <input
                      type="number"
                      value={form.max_pets || ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 1)
                        setForm((f) => ({ ...f, max_pets: Math.min(2, v ? Number(v) : 0) }))
                      }}
                      min={0}
                      max={2}
                      placeholder="0"
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                    />
                  </div>
                  {errors.max_pets && <p className="text-[10px] text-[#A4423A] mt-1">{errors.max_pets}</p>}
                  <p className="text-[10px] text-[#6b7280] mt-1">0 = pets not allowed (max 2)</p>
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Total Capacity</label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                      <Users className="size-3.5" />
                    </div>
                    <input
                      type="number"
                      value={form.capacity || ""}
                      readOnly
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-[#f5f6f8] pl-9 pr-3 py-2.5 text-[13px] text-[#6b7280] cursor-not-allowed"
                    />
                  </div>
                  {errors.capacity && <p className="text-[10px] text-[#A4423A] mt-1">{errors.capacity}</p>}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">Status</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                    <CircleDot className="size-3.5" />
                  </div>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AdminRoom["status"] }))}
                    className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-9 py-2.5 text-[13px] text-[#1a1d26] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all appearance-none"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#9ca3af]">
                    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] font-bold text-[#6b7280] uppercase tracking-wider mb-1">About This Room</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the room, its features, and what makes it special…"
                  rows={3}
                  className="w-full rounded-[6px] border border-[#e2e4e8] bg-white px-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section: Room Images */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-4 rounded-full bg-[#82285f]" />
              <h3 className="text-[13px] font-bold text-[#1a1d26]">Room Images</h3>
              <span className="text-[10px] text-[#9ca3af] ml-auto">{form.images.length}/{MAX_IMAGES}</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Uploaded images grid */}
            {form.images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {form.images.map((img, i) => (
                  <div key={i} className="relative group rounded-[6px] border border-[#e2e4e8] bg-white overflow-hidden aspect-square">
                    <img src={img} alt={`Room ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label="Remove image"
                      className="absolute top-1.5 right-1.5 size-6 rounded-full bg-white/90 text-[#A4423A] flex items-center justify-center hover:bg-white hover:scale-110 transition-all shadow-md opacity-0 group-hover:opacity-100"
                    >
                      <X className="size-3" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1.5 left-1.5 bg-[#82285f] text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-[3px]">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Uploading state */}
            {uploading ? (
              <div className="rounded-[6px] border border-[#82285f]/20 bg-[#82285f]/3 overflow-hidden">
                <div className="h-28 bg-gradient-to-b from-[#f8f3f6] to-[#f0eaee] flex flex-col items-center justify-center gap-2">
                  <div className="size-10 rounded-full bg-[#82285f]/8 flex items-center justify-center">
                    <CloudUpload className="size-5 text-[#82285f]/50" />
                  </div>
                  <p className="text-[12px] font-semibold text-[#1a1d26]">Uploading to storage…</p>
                </div>
                <div className="px-3 py-2 bg-white border-t border-[#e2e4e8]">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#e2e4e8] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#82285f] rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-semibold text-[#82285f] whitespace-nowrap">{uploadProgress}%</p>
                  </div>
                </div>
              </div>
            ) : canAddMore ? (
              /* Empty / add more state */
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="rounded-[6px] border-2 border-dashed border-[#d5d8dd] bg-white flex flex-col items-center justify-center gap-2 py-6 px-6 cursor-pointer hover:border-[#b0b3b8] transition-all duration-200 relative"
              >
                <div className="size-12 rounded-full bg-[#f0f1f3] flex items-center justify-center">
                  <svg className="size-6 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
                <p className="text-[12px] text-[#374151]">
                  Drag and drop or{" "}
                  <span
                    className="text-[#374151] font-semibold hover:underline"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                  >
                    browse
                  </span>
                </p>
                <p className="text-[10px] text-[#9ca3af]">Add up to {MAX_IMAGES} images (JPG, PNG)</p>
                <div className="absolute bottom-3 right-4 text-[#d5d8dd]">
                  <CloudUpload className="size-4" />
                </div>
              </div>
            ) : null}
            {errors.images && <p className="text-[10px] text-[#A4423A] mt-2">{errors.images}</p>}
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-[3px] h-4 rounded-full bg-[#82285f]" />
              <h3 className="text-[13px] font-bold text-[#1a1d26]">Amenities</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.keys(amenityIcons).map((amenity) => (
                <label
                  key={amenity}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] border border-[#e2e4e8] bg-white hover:border-[#82285f]/30 hover:bg-[#fdf8fb] cursor-pointer transition-all"
                >
                  <input
                    type="checkbox"
                    checked={form.amenities.includes(amenity)}
                    onChange={() => toggleAmenity(amenity)}
                    className="size-3.5 accent-[#82285f]"
                  />
                  {amenityIcons[amenity]}
                  <span className="text-[12px] text-[#1a1d26]">{amenity}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#e2e4e8] px-6 py-4 flex items-center justify-end gap-2.5 flex-shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            className="text-[12px] border-[#e2e4e8] text-[#6b7280] hover:bg-[#f5f6f8] rounded-[6px] px-4 py-2"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSubmit}
            className="bg-[#82285f] hover:bg-[#6b1f4b] disabled:bg-[#d5d8dd] disabled:cursor-not-allowed text-white text-[12px] rounded-[6px] px-4 py-2 gap-1.5"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <LoadingDots size="sm" />
                Saving...
              </span>
            ) : editRoom ? "Save Changes" : (
              <>
                <span className="text-[14px] leading-none">+</span>
                Add Room
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
