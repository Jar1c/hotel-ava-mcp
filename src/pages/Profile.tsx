import { useState } from "react"
import { useNavigate, Navigate } from "react-router"
import { User, Lock, Calendar, LogOut, Camera, Pencil, Check, X, ChevronRight, MapPin, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage, HotelLogoIcon } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"

const PRIMARY = "#82285f"
const CANVAS = "#FBF9F4"
const INK = "#2A2A28"
const MUTED = "#7A7A70"
const HAIRLINE = "#DCD5C4"
const SURFACE_SOFT = "#F2EEE4"

interface MockBooking {
  id: string
  roomName: string
  roomType: string
  checkIn: string
  checkOut: string
  status: "Confirmed" | "Completed" | "Cancelled"
  price: number
  image: string
}

const mockBookings: MockBooking[] = [
  {
    id: "b1",
    roomName: "Deluxe Room",
    roomType: "Deluxe",
    checkIn: "Jul 15, 2026",
    checkOut: "Jul 17, 2026",
    status: "Confirmed",
    price: 2800,
    image: "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=400&h=300&fit=crop",
  },
  {
    id: "b2",
    roomName: "Superior Suite",
    roomType: "Suite",
    checkIn: "Jun 1, 2026",
    checkOut: "Jun 3, 2026",
    status: "Completed",
    price: 4500,
    image: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=400&h=300&fit=crop",
  },
  {
    id: "b3",
    roomName: "Executive Deluxe",
    roomType: "Deluxe",
    checkIn: "May 20, 2026",
    checkOut: "May 22, 2026",
    status: "Cancelled",
    price: 3200,
    image: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=400&h=300&fit=crop",
  },
]

const statusBadge: Record<string, { label: string; style: React.CSSProperties }> = {
  Confirmed: {
    label: "Confirmed",
    style: { backgroundColor: "#E8F0EB", color: "#3D6B4F" },
  },
  Completed: {
    label: "Completed",
    style: { backgroundColor: SURFACE_SOFT, color: MUTED },
  },
  Cancelled: {
    label: "Cancelled",
    style: { backgroundColor: "#F5E8E7", color: "#A4423A" },
  },
}

type Section = "personal" | "password" | "bookings"

const inputClass = "w-full rounded-[12px] border px-4 py-2.5 typo-body-sm text-ink placeholder:text-muted-soft bg-white focus:outline-none transition-all duration-150"

const cardClass = "bg-white rounded-[12px] p-6 md:p-8 transition-shadow duration-200"

function SidebarNav({
  sections,
  activeSection,
  onSelect,
  onLogout,
}: {
  sections: { id: Section; label: string; icon: React.ReactNode }[]
  activeSection: Section
  onSelect: (s: Section) => void
  onLogout: () => void
}) {
  return (
    <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left typo-body-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer hover:bg-[#F2EEE4]"
          style={{
            backgroundColor: activeSection === s.id ? PRIMARY : "transparent",
            color: activeSection === s.id ? CANVAS : MUTED,
          }}
        >
          {s.icon}
          {s.label}
        </button>
      ))}
      <div className="hidden md:block h-px bg-hairline my-2" />
      <button
        onClick={onLogout}
        className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left typo-body-sm font-medium transition-all duration-150 cursor-pointer hover:bg-[#F2EEE4]"
        style={{ color: "#A4423A" }}
      >
        <LogOut className="size-4" />
        Sign Out
      </button>
    </nav>
  )
}

export default function Profile() {
  const { user, isAuthenticated, logout, updateUser } = useAuth()
  const navigate = useNavigate()

  const [activeSection, setActiveSection] = useState<Section>("personal")
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(user?.name || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [bookingFilter, setBookingFilter] = useState<"all" | "confirmed" | "completed" | "cancelled">("all")
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(user?.avatar)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const filteredBookings = bookingFilter === "all"
    ? mockBookings
    : mockBookings.filter(b => b.status.toLowerCase() === bookingFilter)

  const handleSaveProfile = () => {
    updateUser({ name: editName })
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditName(user?.name || "")
    setIsEditing(false)
  }

  const handleRemoveAvatar = () => {
    setAvatarSrc(undefined)
    updateUser({ avatar: undefined })
  }

  const handlePasswordChange = () => {
    setPasswordError("")
    setPasswordSuccess("")
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please fill in all password fields.")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.")
      return
    }
    setPasswordSuccess("Password updated successfully!")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleBookingAction = (bookingId: string, action: "cancel" | "modify") => {
    console.log(`Booking ${bookingId}: ${action}`)
  }

  const handleLogout = async () => {
    await logout()
    navigate("/")
  }

  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "personal", label: "Personal Information", icon: <User className="size-4" /> },
    { id: "password", label: "Change Password", icon: <Lock className="size-4" /> },
    { id: "bookings", label: "My Bookings", icon: <Calendar className="size-4" /> },
  ]

  return (
    <div className="min-h-screen bg-canvas pb-section">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="md:w-64 shrink-0 md:sticky md:top-[88px] md:self-start">
            <div className="text-center md:text-left mb-6">
              <div className="flex justify-center md:justify-start">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger>
                    <button className="relative group cursor-pointer">
                      <Avatar className="size-20 md:size-24 !rounded-[6px]">
                        {avatarSrc && <AvatarImage src={avatarSrc} />}
                        <AvatarFallback className="bg-transparent">
                          <HotelLogoIcon />
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 rounded-[6px] flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
                        <Camera className="size-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      </div>
                    </button>
                  </DropdownMenuTrigger>
<DropdownMenuContent className="w-56 !rounded-[14px]" align="start" sticky={true}>
                     <div className="px-3 py-2 text-sm font-medium text-ink">
                       Profile Picture
                     </div>
                     <DropdownMenuItem
                       onClick={() => {
                         const input = document.createElement("input")
                         input.type = "file"
                         input.accept = "image/*"
                         input.onchange = (e) => {
                           const file = (e.target as HTMLInputElement).files?.[0]
                           if (file) {
                             const reader = new FileReader()
                             reader.onload = (ev) => {
                               const dataUrl = ev.target?.result as string
                               setAvatarSrc(dataUrl)
                               updateUser({ avatar: dataUrl })
                             }
                             reader.readAsDataURL(file)
                           }
                         }
                         input.click()
                       }}
                       className="cursor-pointer"
                     >
                       <Camera className="size-4 mr-2" />
                       Upload Photo
                     </DropdownMenuItem>
                     {avatarSrc && (
                       <DropdownMenuItem onClick={handleRemoveAvatar} className="cursor-pointer">
                         <Trash2 className="size-4 mr-2" />
                         Remove Photo
                       </DropdownMenuItem>
                     )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h1 className="font-display text-xl font-bold mt-4" style={{ color: INK }}>
                {user?.name || "Guest"}
              </h1>
              <p className="typo-body-sm" style={{ color: MUTED }}>
                {user?.email || ""}
              </p>
            </div>

            <div className="hidden md:block">
              <SidebarNav
                sections={sections}
                activeSection={activeSection}
                onSelect={setActiveSection}
                onLogout={handleLogout}
              />
            </div>
          </aside>

          {/* Mobile section tabs */}
          <div className="md:hidden">
            <SidebarNav
              sections={sections}
              activeSection={activeSection}
              onSelect={setActiveSection}
              onLogout={handleLogout}
            />
          </div>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {/* Personal Information */}
            {activeSection === "personal" && (
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-xl font-semibold" style={{ color: INK }}>
                    Personal Information
                  </h2>
                  {!isEditing ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-1.5 typo-body-sm font-medium hover:underline cursor-pointer transition-colors"
                      style={{ color: PRIMARY }}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveProfile}
                        className="flex items-center gap-1.5 typo-body-sm font-medium cursor-pointer transition-colors"
                        style={{ color: "#3D6B4F" }}
                      >
                        <Check className="size-3.5" />
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 typo-body-sm font-medium cursor-pointer transition-colors"
                        style={{ color: MUTED }}
                      >
                        <X className="size-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="typo-caption block mb-1.5" style={{ color: MUTED }}>
                      Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={inputClass}
                        style={{ borderColor: HAIRLINE }}
                        placeholder="Your name"
                      />
                    ) : (
                      <p className="typo-body-md" style={{ color: INK }}>
                        {user?.name || "—"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="typo-caption block mb-1.5" style={{ color: MUTED }}>
                      Email
                    </label>
                    <p
                      className="typo-body-md rounded-[12px] px-4 py-2.5"
                      style={{ color: MUTED, backgroundColor: SURFACE_SOFT }}
                    >
                      {user?.email || "—"}
                    </p>
                    <p className="typo-caption-sm mt-1" style={{ color: MUTED }}>
                      Email cannot be changed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Change Password */}
            {activeSection === "password" && (
              <div className={cardClass}>
                <h2 className="font-display text-xl font-semibold mb-5" style={{ color: INK }}>
                  Change Password
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="typo-caption block mb-1.5" style={{ color: MUTED }}>
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: HAIRLINE }}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div>
                    <label className="typo-caption block mb-1.5" style={{ color: MUTED }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: HAIRLINE }}
                      placeholder="Min. 8 characters"
                    />
                  </div>
                  <div>
                    <label className="typo-caption block mb-1.5" style={{ color: MUTED }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: HAIRLINE }}
                      placeholder="Re-enter new password"
                    />
                  </div>
                  {passwordError && (
                    <p className="typo-body-sm" style={{ color: "#A4423A" }}>
                      {passwordError}
                    </p>
                  )}
                  {passwordSuccess && (
                    <p className="typo-body-sm" style={{ color: "#3D6B4F" }}>
                      {passwordSuccess}
                    </p>
                  )}
                  <Button
                    onClick={handlePasswordChange}
                    className="!rounded-[12px] font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.985]"
                    style={{ backgroundColor: PRIMARY, color: CANVAS }}
                  >
                    Update Password
                  </Button>
                </div>
              </div>
            )}

            {/* My Bookings */}
            {activeSection === "bookings" && (
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="font-display text-xl font-semibold" style={{ color: INK }}>
                    My Bookings
                  </h2>
                  <div className="flex gap-1.5">
                    {(["all", "confirmed", "completed", "cancelled"] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setBookingFilter(f)}
                        className="px-3 py-1.5 rounded-[8px] typo-caption-sm font-medium capitalize transition-all duration-150 cursor-pointer"
                        style={{
                          backgroundColor: bookingFilter === f ? PRIMARY : "transparent",
                          color: bookingFilter === f ? CANVAS : MUTED,
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBookings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="typo-body-md" style={{ color: MUTED }}>
                      No bookings found.
                    </p>
                    <Button
                      onClick={() => navigate("/rooms")}
                      className="mt-4 !rounded-[12px] font-semibold"
                      style={{ backgroundColor: PRIMARY, color: CANVAS }}
                    >
                      Browse Rooms
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredBookings.map((booking) => {
                      const badge = statusBadge[booking.status]
                      return (
                        <div
                          key={booking.id}
                          className="flex flex-col sm:flex-row gap-4 p-4 rounded-[12px] transition-all duration-200"
                          style={{ backgroundColor: SURFACE_SOFT }}
                        >
                          <img
                            src={booking.image}
                            alt={booking.roomName}
                            className="w-full sm:w-28 h-20 object-cover rounded-[8px] flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="typo-body-md font-semibold" style={{ color: INK }}>
                                  {booking.roomName}
                                </h3>
                                <p className="typo-caption-sm flex items-center gap-1 mt-0.5" style={{ color: MUTED }}>
                                  <MapPin className="size-3" />
                                  {booking.roomType}
                                </p>
                              </div>
                              <span
                                className="px-2.5 py-0.5 rounded-full typo-caption-sm font-semibold whitespace-nowrap"
                                style={badge.style}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 typo-caption-sm" style={{ color: MUTED }}>
                              <Calendar className="size-3.5" />
                              {booking.checkIn} — {booking.checkOut}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <p className="font-semibold typo-body-sm" style={{ color: PRIMARY }}>
                                ₱{booking.price.toLocaleString()} / night
                              </p>
                              <div className="flex gap-2">
                                {booking.status === "Confirmed" && (
                                  <>
                                    <button
                                      onClick={() => handleBookingAction(booking.id, "modify")}
                                      className="typo-caption-sm font-medium underline cursor-pointer hover:no-underline transition-all"
                                      style={{ color: PRIMARY }}
                                    >
                                      Modify
                                    </button>
                                    <button
                                      onClick={() => handleBookingAction(booking.id, "cancel")}
                                      className="typo-caption-sm font-medium cursor-pointer hover:underline transition-all"
                                      style={{ color: "#A4423A" }}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                )}
                                {booking.status === "Completed" && (
                                  <button
                                    onClick={() => navigate(`/rooms/${booking.roomName.toLowerCase().replace(/\s+/g, "-")}`)}
                                    className="flex items-center gap-0.5 typo-caption-sm font-medium cursor-pointer transition-all"
                                    style={{ color: PRIMARY }}
                                  >
                                    Book Again
                                    <ChevronRight className="size-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
</main>
        </div>
      </div>
    </div>
   )
}
