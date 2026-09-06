import { useState, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  X, CloudUpload, Bed, SquarePen, Users, CircleDot,
  Snowflake, ShowerHead, Wifi, Monitor, Tv, Wind, SprayCan, Car, Bath, Waves, Music,
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
  amenities: string[]
  images: string[]
  description: string
  status: "available" | "occupied" | "maintenance"
}

const MAX_IMAGES = 5

const roomTypes = ["Standard", "Deluxe", "Executive Deluxe", "Regular Suite", "Superior Suite"]

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
  "Regular Suite": {
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
  "Bathtub": <Bath className="size-3.5 text-black" />,
  "Jacuzzi": <Waves className="size-3.5 text-black" />,
  "KTV": <Music className="size-3.5 text-black" />,
}

interface RoomFormSheetProps {
  open: boolean
  onClose: () => void
  onSave: (data: RoomFormData) => Promise<void> | void
  editRoom?: AdminRoom | null
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
    amenities: [...preset.amenities],
    images: [],
    description: "",
    status: "available",
  }
}

function extractPath(url: string): string | null {
  const marker = "/object/public/room-images/"
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return url.slice(idx + marker.length)
}

export default function RoomFormSheet({ open, onClose, onSave, editRoom }: RoomFormSheetProps) {
  const [form, setForm] = useState<RoomFormData>(() => {
    if (editRoom) {
      const max_adults = editRoom.max_adults || 2
      const max_children = editRoom.max_children ?? 1
      return { ...editRoom, max_adults, max_children, capacity: max_adults + max_children, images: editRoom.images || [] }
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
    setForm(editRoom ? { ...editRoom, images: editRoom.images || [] } : emptyForm())
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
    if (!form.name.trim()) errs.name = "Room name is required"
    if (!form.type) errs.type = "Room type is required"
    if (form.price <= 0) errs.price = "Price must be greater than 0"
    if (form.capacity <= 0) errs.capacity = "Capacity must be greater than 0"
    if (form.images.length === 0) errs.images = "At least 1 image is required"
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave(form)
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
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
                      onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                      placeholder="2400"
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                    />
                  </div>
                  {errors.price && <p className="text-[10px] text-[#A4423A] mt-1">{errors.price}</p>}
                </div>
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
                      onChange={(e) => setForm((f) => {
                        const max_adults = Number(e.target.value)
                        return { ...f, max_adults, capacity: max_adults + f.max_children }
                      })}
                      min={1}
                      max={10}
                      placeholder="2"
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                    />
                  </div>
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
                      onChange={(e) => setForm((f) => {
                        const max_children = Number(e.target.value)
                        return { ...f, max_children, capacity: f.max_adults + max_children, allows_children: max_children > 0 ? true : false }
                      })}
                      min={0}
                      max={10}
                      placeholder="1"
                      className="w-full rounded-[6px] border border-[#e2e4e8] bg-white pl-9 pr-3 py-2.5 text-[13px] text-[#1a1d26] placeholder:text-[#b0b3b8] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
                    />
                  </div>
                </div>
                <div>
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
                </div>
              </div>

              {/* Children Policy */}
              <div className="flex items-center justify-between rounded-[6px] border border-[#e2e4e8] bg-[#f9fafb] px-3 py-2.5">
                <div>
                  <p className="text-[13px] font-medium text-[#1a1d26]">Allow Children</p>
                  <p className="text-[11px] text-[#6b7280]">Allow guests to bring children (age 0-17) to this room</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.allows_children}
                  onClick={() => setForm((f) => ({ ...f, allows_children: !f.allows_children, max_children: !f.allows_children ? f.max_children : 0 }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${form.allows_children ? "bg-[#82285f]" : "bg-[#d1d5db]"}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${form.allows_children ? "translate-x-4" : "translate-x-0"}`}
                  />
                </button>
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
                  placeholder="Describe the room, its features, and what makes it special..."
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
                  <p className="text-[12px] font-semibold text-[#1a1d26]">Uploading to storage...</p>
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
