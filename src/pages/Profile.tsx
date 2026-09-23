import { useState, useEffect } from "react"
import { Navigate } from "react-router"
import { User, Camera, Pencil, Check, X, Trash2, Palette } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { authApi } from "@/services/api"
import LoadingDots from "@/components/LoadingDots"
import { DICEBEAR_STYLES, getDiceBearUrl } from "@/lib/dicebear"

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
  const [editFirstName, setEditFirstName] = useState("")
  const [editLastName, setEditLastName] = useState("")
  const [firstNameError, setFirstNameError] = useState("")
  const [lastNameError, setLastNameError] = useState("")

  // avatarSrc is ONLY a temporary override during upload/selection previews.
  // The real display avatar is always derived from user?.avatar (same as Header).
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>(undefined)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)

  // Google profile picture from Supabase metadata
  const [googleAvatar, setGoogleAvatar] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    import("@/lib/supabase").then(({ supabase }) =>
      supabase.auth.getUser().then(({ data: { user: sbUser } }) => {
        if (cancelled) return
        if (sbUser?.app_metadata?.providers?.includes("google")) {
          const meta = sbUser.user_metadata || {}
          setGoogleAvatar(meta.picture || meta.avatar_url || null)
        }
      })
    )
    return () => { cancelled = true }
  }, [])

  // Always derive display avatar from user data (mirrors Header logic exactly)
  // Priority: temporary override > user.avatar (from DB) > googleAvatar (from Supabase) > DiceBear fallback
  const displayAvatar = avatarSrc || user?.avatar || googleAvatar || getDiceBearUrl("adventurer", user?.email || "user", 128)

  // Clear temporary override when user data changes (e.g., after save/reload)
  useEffect(() => {
    setAvatarSrc(undefined)
  }, [user?.avatar])

  const formatName = (value: string, onError: (msg: string) => void) => {
    const hasInvalid = /[^a-zA-Z\s]/.test(value)
    if (hasInvalid) {
      onError("Letters and spaces only — no numbers or special characters")
    } else {
      onError("")
    }
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  }

  const parseNameParts = (fullName: string) => {
    const parts = (fullName || "").trim().split(/\s+/)
    const first = parts[0] || ""
    const last = parts.slice(1).join(" ")
    return { first, last }
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const getNameCooldown = () => {
    if (!user?.name_changed_at) return null
    const lastChanged = new Date(user.name_changed_at)
    const now = new Date()
    const daysSince = Math.floor((now.getTime() - lastChanged.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSince >= 7) return null
    const daysRemaining = 7 - daysSince
    return { daysRemaining, nextAvailable: new Date(lastChanged.getTime() + 7 * 24 * 60 * 60 * 1000) }
  }

  const nameCooldown = getNameCooldown()
  const hasNameErrors = firstNameError !== "" || lastNameError !== ""

  const handleSaveProfile = async () => {
    if (hasNameErrors) return
    const fullName = `${editFirstName.trim()} ${editLastName.trim()}`
    try {
      await authApi.updateProfile({ name: fullName })
      updateUser({ name: fullName, name_changed_at: new Date().toISOString() })
      // Sync system name into Supabase user_metadata so next session's
      // instant display shows system name, not Google's full_name
      import("@/lib/supabase").then(({ supabase }) =>
        supabase.auth.updateUser({ data: { name: fullName, full_name: fullName } }).catch(() => {})
      )
      setIsEditing(false)
    } catch {
      // keep current state
    }
  }

  const handleCancelEdit = () => {
    const { first, last } = parseNameParts(user?.name || "")
    setEditFirstName(first)
    setEditLastName(last)
    setFirstNameError("")
    setLastNameError("")
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

  const handleRemoveAvatar = async () => {
    // Default placeholder avatar (like Facebook's empty profile)
    const defaultAvatar = ""

    setAvatarSrc(defaultAvatar)
    try {
      await authApi.updateProfile({ avatar_url: defaultAvatar })
      updateUser({ avatar: defaultAvatar })
    } catch {
      // keep current
    }
  }

  const handleSelectDiceBear = async (style: string) => {
    const url = getDiceBearUrl(style, user?.email || "user")
    console.log("[profile] Selecting DiceBear:", style, url)
    setAvatarSrc(url)
    setSelectedStyle(style)
    try {
      const result = await authApi.updateProfile({ avatar_url: url })
      console.log("[profile] Update result:", result)
      updateUser({ avatar: url })
    } catch (e) {
      console.error("[profile] Update FAILED:", e)
      // keep current avatar
    }
  }

  const handleSelectGoogle = async () => {
    if (!googleAvatar) return
    console.log("[profile] Selecting Google avatar:", googleAvatar)
    setAvatarSrc(googleAvatar)
    setSelectedStyle("google")
    try {
      const result = await authApi.updateProfile({ avatar_url: googleAvatar })
      console.log("[profile] Update result:", result)
      updateUser({ avatar: googleAvatar })
    } catch (e) {
      console.error("[profile] Update FAILED:", e)
      // keep current avatar
    }
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
                        <AvatarImage src={displayAvatar || undefined} />
                        <AvatarFallback className="bg-gray-200">
                          <svg className="size-full text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
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
                      onClick={() => setShowAvatarPicker(true)}
                      className="cursor-pointer"
                    >
                      <Palette className="size-4 mr-2" />
                      Choose Avatar
                    </DropdownMenuItem>
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
                    {displayAvatar && (
                      <DropdownMenuItem onClick={handleRemoveAvatar} className="cursor-pointer">
                        <Trash2 className="size-4 mr-2" />
                        Remove Photo
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h1 className="font-display text-xl font-bold mt-4" style={{ color: INK }}>
                {user?.name && user.name.toLowerCase() !== "guest" && !user.name.includes("@")
                  ? user.name
                  : (user?.email?.split("@")[0] || "Guest")}
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
                      onClick={() => {
                        const { first, last } = parseNameParts(user?.name || "")
                        setEditFirstName(first)
                        setEditLastName(last)
                        setFirstNameError("")
                        setLastNameError("")
                        setIsEditing(true)
                      }}
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
                        disabled={hasNameErrors || !editFirstName.trim() || !editLastName.trim()}
                        className="flex items-center gap-1.5 typo-body-sm font-medium cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                    {isEditing && nameCooldown && (
                      <div className="mb-3 p-3 rounded-[8px] text-sm flex items-start gap-2" style={{ backgroundColor: "#FFF3CD", color: "#856404" }}>
                        <svg className="size-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        <span>You can change your name again in <strong>{nameCooldown.daysRemaining} day(s)</strong> (after {nameCooldown.nextAvailable.toLocaleDateString()}).</span>
                      </div>
                    )}
                    {isEditing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium block mb-1.5" style={{ color: MUTED }}>First Name</label>
                          <input
                            type="text"
                            value={editFirstName}
                            onChange={(e) => setEditFirstName(formatName(e.target.value, setFirstNameError))}
                            className={inputClass}
                            style={{ borderColor: HAIRLINE }}
                            placeholder="First name"
                            maxLength={50}
                          />
                          {firstNameError && (
                            <p className="text-xs mt-1.5" style={{ color: "#A4423A" }}>{firstNameError}</p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-medium block mb-1.5" style={{ color: MUTED }}>Last Name</label>
                          <input
                            type="text"
                            value={editLastName}
                            onChange={(e) => setEditLastName(formatName(e.target.value, setLastNameError))}
                            className={inputClass}
                            style={{ borderColor: HAIRLINE }}
                            placeholder="Last name"
                            maxLength={50}
                          />
                          {lastNameError && (
                            <p className="text-xs mt-1.5" style={{ color: "#A4423A" }}>{lastNameError}</p>
                          )}
                        </div>
                      </div>
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

      {/* DiceBear Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setShowAvatarPicker(false)}>
          <div
            className="bg-white rounded-[16px] shadow-lg p-6 animate-scale-in max-h-[80vh] overflow-hidden flex flex-col"
            style={{ width: "min(90vw, 520px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold" style={{ color: INK }}>Choose Your Avatar</h3>
              <button onClick={() => setShowAvatarPicker(false)} className="p-1 hover:bg-gray-100 rounded-full cursor-pointer">
                <X className="size-5" style={{ color: MUTED }} />
              </button>
            </div>
            <p className="typo-body-sm mb-4" style={{ color: MUTED }}>
              Pick a style that represents you. Your avatar is generated from your email.
            </p>

            {/* Style grid */}
            <div className="grid grid-cols-4 gap-3 overflow-y-auto flex-1 p-1" style={{ maxHeight: "60vh" }}>
              {/* Google Avatar Option */}
              {googleAvatar && (
                <button
                  onClick={handleSelectGoogle}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-[10px] border-2 transition-all cursor-pointer hover:scale-105 ${
                    selectedStyle === "google" || (displayAvatar === googleAvatar)
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-gray-200"
                  }`}
                >
                  <img
                    src={googleAvatar}
                    alt="Google"
                    className="size-14 rounded-full bg-surface-soft object-cover"
                    loading="lazy"
                  />
                  <span className="typo-caption-xs text-center leading-tight" style={{ color: MUTED }}>
                    Google
                  </span>
                </button>
              )}

              {/* DiceBear Styles */}
              {DICEBEAR_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleSelectDiceBear(style.id)}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-[10px] border-2 transition-all cursor-pointer hover:scale-105 ${
                    selectedStyle === style.id || (displayAvatar && displayAvatar.includes(`/${style.id}/`))
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:border-gray-200"
                  }`}
                >
                  <img
                    src={getDiceBearUrl(style.id, user?.email || "user", 80)}
                    alt={style.name}
                    className="size-14 rounded-full bg-surface-soft"
                    loading="lazy"
                  />
                  <span className="typo-caption-xs text-center leading-tight" style={{ color: MUTED }}>
                    {style.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
