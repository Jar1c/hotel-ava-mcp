import { useState, useRef } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { authApi } from "@/services/api"
import { Button } from "@/components/ui/button"
import {
  Camera, Eye, EyeOff, Save, Pencil, X, Mail, Lock, Shield,
  Phone, Calendar, MapPin, CheckCircle, AlertCircle,
} from "lucide-react"

const PRIMARY = "#82285f"

export default function Settings() {
  const { user, updateUser } = useAuth()
  const [name, setName] = useState(user?.name ?? "")
  const [phone, setPhone] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile")
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = (user?.name ?? "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)
    try {
      const { avatar_url } = await authApi.uploadAvatar(file)
      setAvatarPreview(avatar_url)
      updateUser({ avatar: avatar_url })
    } catch {
      // keep preview
    }
  }

  const handleSave = async () => {
    setMsg(null)
    setSaving(true)
    try {
      if (!user) return
      await authApi.updateProfile({ name, phone })
      updateUser({ name })
      setMsg({ type: "success", text: "Profile updated." })
      setEditing(false)
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Failed." })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwMsg(null)
    setPwSaving(true)
    try {
      if (!newPassword) throw new Error("Enter a new password.")
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.")
      if (!/[A-Z]/.test(newPassword)) throw new Error("Password must contain an uppercase letter.")
      if (!/[0-9]/.test(newPassword)) throw new Error("Password must contain a number.")
      await authApi.changePassword({ new_password: newPassword })
      setPwMsg({ type: "success", text: "Password updated successfully." })
      setNewPassword("")
    } catch (err) {
      setPwMsg({ type: "error", text: err instanceof Error ? err.message : "Failed." })
    } finally {
      setPwSaving(false)
    }
  }

  const handleCancel = () => {
    setName(user?.name ?? "")
    setPhone("")
    setEditing(false)
    setMsg(null)
  }

  const infoItems = [
    { icon: Mail, label: "Email Address", value: user?.email ?? "—" },
    { icon: Phone, label: "Phone", value: phone || "—", editable: true, field: "phone" },
    { icon: Shield, label: "Role", value: "Administrator", badge: true },
    { icon: Calendar, label: "Joined", value: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) },
    { icon: MapPin, label: "Location", value: "Manila, Philippines" },
  ]

  return (
    <div className="max-w-2xl mx-auto">
      {/* Profile Card */}
      <div className="bg-white rounded-[12px] border border-[#e8eaed] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative group flex-shrink-0">
              <button
                type="button"
                onClick={handleAvatarClick}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-[#82285f] to-[#5a1a3f] flex items-center justify-center shadow-md cursor-pointer transition-all duration-200 hover:shadow-lg overflow-hidden"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-display font-bold text-lg">{initials}</span>
                )}
              </button>
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={handleAvatarClick}
              >
                <Camera className="w-4 h-4 text-white" />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {/* Name + Tagline */}
            <div>
              <h2 className="text-[17px] font-bold text-[#1a1d26] font-display leading-tight">{user?.name}</h2>
              <p className="text-[13px] text-[#9ca3af] mt-0.5">Hotel Ava Administrator</p>
            </div>
          </div>

          {/* Edit / Cancel Button */}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[#6b7280] hover:bg-[#f5f6f8] hover:text-[#1a1d26] transition-all cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium text-[#A4423A] hover:bg-[#A4423A]/5 transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 mt-4 border-b border-[#e8eaed]">
          {(["profile", "security"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 capitalize transition-all duration-200 cursor-pointer ${
                activeTab === tab
                  ? "border-[#82285f] text-[#82285f]"
                  : "border-transparent text-[#9ca3af] hover:text-[#6b7280]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === "profile" && (
            <div className="space-y-0">
              {/* Section Title */}
              <h3 className="text-[14px] font-semibold text-[#1a1d26] mb-4">Personal Information</h3>

              {/* Info Grid */}
              <div className="grid grid-cols-3 gap-y-5 gap-x-6">
                {infoItems.map((item) => (
                  <div key={item.label}>
                    <p className="text-[11px] font-medium text-[#9ca3af] uppercase tracking-wider mb-1">{item.label}</p>
                    {editing && item.editable ? (
                      <div className="relative">
                        <item.icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#b0b3b8] pointer-events-none" />
                        <input
                          type="text"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Enter phone"
                          className="w-full pl-8 pr-3 py-1.5 rounded-[6px] border border-[#e2e4e8] text-[13px] text-[#1a1d26] bg-white focus:outline-none focus:border-[#82285f] focus:ring-1 focus:ring-[#82285f]/20 placeholder:text-[#d1d5db]"
                        />
                      </div>
                    ) : item.badge ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-semibold bg-[#82285f]/10 text-[#82285f]">
                        <item.icon className="w-3 h-3" />
                        {item.value}
                      </span>
                    ) : (
                      <p className="text-[13px] text-[#374151] flex items-center gap-2">
                        <item.icon className="w-3.5 h-3.5 text-[#d1d5db] flex-shrink-0" />
                        {item.value}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Save Bar */}
              {editing && (
                <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#f0f1f3]">
                  {msg && (
                    <p className={`text-[12px] flex items-center gap-1.5 ${
                      msg.type === "success" ? "text-[#3D6B4F]" : "text-[#A4423A]"
                    }`}>
                      {msg.type === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      {msg.text}
                    </p>
                  )}
                  <div className="ml-auto">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-[8px] text-[12px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow-sm"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      <Save className="w-3 h-3" />
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "security" && (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <h3 className="text-[14px] font-semibold text-[#1a1d26] mb-1">Change Password</h3>
              <p className="text-[12px] text-[#9ca3af] mb-3">Keep your account secure with a strong password.</p>

              <div className="max-w-sm">
                <label className="text-[11px] font-medium text-[#9ca3af] uppercase tracking-wider block mb-1.5">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#d1d5db] pointer-events-none" />
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="w-full pl-10 pr-10 py-2.5 rounded-[8px] border border-[#e2e4e8] text-[13px] text-[#1a1d26] bg-white focus:outline-none focus:border-[#82285f] focus:ring-1 focus:ring-[#82285f]/20 placeholder:text-[#d1d5db]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d1d5db] hover:text-[#6b7280] transition-colors"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {newPassword && (
                <div className="max-w-sm space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => {
                      const s = newPassword.length >= 12 ? 4 : newPassword.length >= 8 ? 3 : newPassword.length >= 6 ? 2 : 1
                      return (
                        <div
                          key={i}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{ backgroundColor: i <= s ? (s >= 3 ? "#3D6B4F" : s === 2 ? "#D4A843" : "#A4423A") : "#e8eaed" }}
                        />
                      )
                    })}
                  </div>
                  <div className="flex gap-3 text-[11px] text-[#9ca3af]">
                    <span className={newPassword.length >= 8 ? "text-[#3D6B4F]" : ""}>8+ chars</span>
                    <span className={/[A-Z]/.test(newPassword) ? "text-[#3D6B4F]" : ""}>Uppercase</span>
                    <span className={/[0-9]/.test(newPassword) ? "text-[#3D6B4F]" : ""}>Number</span>
                  </div>
                </div>
              )}

              {pwMsg && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-[8px] text-[12px] max-w-sm ${
                  pwMsg.type === "success"
                    ? "bg-[#3D6B4F]/8 text-[#3D6B4F]"
                    : "bg-[#A4423A]/8 text-[#A4423A]"
                }`}>
                  {pwMsg.type === "success" ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {pwMsg.text}
                </div>
              )}

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={pwSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[12px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 shadow-sm"
                  style={{ backgroundColor: PRIMARY }}
                >
                  <Lock className="w-3 h-3" />
                  {pwSaving ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
