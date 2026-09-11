import { useState } from "react"
import { Navigate } from "react-router"
import { User, Camera, Pencil, Check, X, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage, HotelLogoIcon } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { authApi } from "@/services/api"
import LoadingDots from "@/components/LoadingDots"

const PRIMARY = "#82285f"
const INK = "#2A2A28"
const MUTED = "#7A7A70"
const HAIRLINE = "#D5DADF"
const SURFACE_SOFT = "#F4F6F8"

type Section = "personal"

const inputClass = "w-full rounded-[6px] border px-4 py-2.5 typo-body-sm text-ink placeholder:text-muted-soft bg-white focus:outline-none transition-all duration-150"
const cardClass = "bg-white rounded-[12px] p-6 md:p-8 transition-shadow duration-200"

function SidebarNav({
  sections,
  activeSection,
  onSelect,
}: {
  sections: { id: Section; label: string; icon: React.ReactNode }[]
  activeSection: Section
  onSelect: (s: Section) => void
}) {
  return (
    <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] text-left typo-body-sm font-medium transition-all duration-150 whitespace-nowrap cursor-pointer hover:bg-gray-100"
          style={{
            backgroundColor: activeSection === s.id ? PRIMARY : "transparent",
            color: activeSection === s.id ? "#FBF9F4" : MUTED,
          }}
        >
          {s.icon}
          {s.label}
        </button>
      ))}
    </nav>
  )
}

export default function Profile() {
  const { user, isAuthenticated, updateUser } = useAuth()

  const [activeSection, setActiveSection] = useState<Section>("personal")
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(user?.name || "")

  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(user?.avatar)
  const [avatarLoading, setAvatarLoading] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const handleSaveProfile = async () => {
    try {
      await authApi.updateProfile({ name: editName })
      updateUser({ name: editName })
      setIsEditing(false)
    } catch {
      // keep current state
    }
  }

  const handleCancelEdit = () => {
    setEditName(user?.name || "")
    setIsEditing(false)
  }

  const handleAvatarUpload = async (file: File) => {
    setAvatarLoading(true)
    try {
      const { avatar_url } = await authApi.uploadAvatar(file)
      setAvatarSrc(avatar_url)
      updateUser({ avatar: avatar_url })
    } catch {
      // keep current avatar
    } finally {
      setAvatarLoading(false)
    }
  }

  const handleRemoveAvatar = () => {
    setAvatarSrc(undefined)
    updateUser({ avatar: undefined })
  }

  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "personal", label: "Personal Information", icon: <User className="size-4" /> },
  ]

  return (
    <div className="min-h-screen bg-[#F4F6F8] pb-16">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="md:w-64 shrink-0 md:sticky md:top-[88px] md:self-start">
            <div className="text-center md:text-left mb-6">
              <div className="flex justify-center md:justify-start">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger className="relative group cursor-pointer">
                      <Avatar className="size-20 md:size-24 !rounded-[6px]">
                        {avatarSrc && <AvatarImage src={avatarSrc} />}
                        <AvatarFallback className="bg-transparent">
                          <HotelLogoIcon />
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute inset-0 rounded-[6px] flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
                        {avatarLoading ? (
                          <LoadingDots size="sm" className="text-white" />
                        ) : (
                          <Camera className="size-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        )}
                      </div>
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
                              setAvatarSrc(ev.target?.result as string)
                            }
                            reader.readAsDataURL(file)
                            handleAvatarUpload(file)
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
              />
            </div>
          </aside>

          {/* Mobile section tabs */}
          <div className="md:hidden">
            <SidebarNav
              sections={sections}
              activeSection={activeSection}
              onSelect={setActiveSection}
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
                        {user?.name || "\u2014"}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="typo-caption block mb-1.5" style={{ color: MUTED }}>
                      Email
                    </label>
                    <p
                      className="typo-body-md rounded-[6px] px-4 py-2.5"
                      style={{ color: MUTED, backgroundColor: SURFACE_SOFT }}
                    >
                      {user?.email || "\u2014"}
                    </p>
                    <p className="typo-caption-sm mt-1" style={{ color: MUTED }}>
                      Email cannot be changed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
