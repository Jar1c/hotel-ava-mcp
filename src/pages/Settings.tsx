import { useState, useRef } from "react"
import { Camera, Lock, Save, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { authApi } from "@/services/api"

export default function Settings() {
  const { user, updateUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar || "")
  const [uploading, setUploading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

  const handleAvatarClick = () =>     fileInputRef.current?.click()

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Preview
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(reader.result as string)
    reader.readAsDataURL(file)

    // Upload
    setUploading(true)
    try {
      const { avatar_url } = await authApi.uploadAvatar(file)
      setAvatarPreview(avatar_url)
      if (user) updateUser({ avatar: avatar_url })
    } catch {
      setAvatarPreview(user?.avatar || "")
    } finally {
      setUploading(false)
    }
  }

  const handlePasswordChange = async () => {
    setPasswordError("")
    setPasswordSuccess("")

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError("Password must contain an uppercase letter")
      return
    }
    if (!/[0-9]/.test(newPassword)) {
      setPasswordError("Password must contain a number")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }

    setSavingPassword(true)
    try {
      await authApi.changePassword({ new_password: newPassword })
      setPasswordSuccess("Password updated successfully")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password")
    } finally {
      setSavingPassword(false)
    }
  }

  // Password strength checks
  const hasLength = newPassword.length >= 8
  const hasUpper = /[A-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)

  return (
    <div className="px-base py-section">
      <div className="max-w-[560px] mx-auto">
        <h1 className="typo-display-lg text-ink mb-lg">Settings</h1>

        {/* Avatar */}
        <div className="bg-white border border-hairline rounded-[12px] p-md mb-sm">
          <h2 className="typo-title-sm text-ink mb-md">Profile Photo</h2>
          <div className="flex items-center gap-md">
            <div
              className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-white shadow-sm cursor-pointer group"
              onClick={handleAvatarClick}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-primary/30 font-display">
                  {user?.name?.charAt(0) || "U"}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-ink font-medium">{user?.name || "Your Name"}</p>
              <p className="text-xs text-muted">{user?.email}</p>
              <button
                onClick={handleAvatarClick}
                className="text-xs text-primary mt-1 hover:underline"
              >
                {avatarPreview ? "Change photo" : "Upload photo"}
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Password */}
        <div className="bg-white border border-hairline rounded-[12px] p-md">
          <h2 className="typo-title-sm text-ink mb-md flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Change Password
          </h2>

          <div className="space-y-sm">
            {/* Current password */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-white focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-white focus:outline-none focus:border-primary/50 transition-colors"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {/* Password requirements */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <p className={`text-xs flex items-center gap-1.5 ${hasLength ? "text-emerald-600" : "text-muted"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hasLength ? "bg-emerald-500" : "bg-gray-300"}`} />
                    At least 8 characters
                  </p>
                  <p className={`text-xs flex items-center gap-1.5 ${hasUpper ? "text-emerald-600" : "text-muted"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hasUpper ? "bg-emerald-500" : "bg-gray-300"}`} />
                    One uppercase letter
                  </p>
                  <p className={`text-xs flex items-center gap-1.5 ${hasNumber ? "text-emerald-600" : "text-muted"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? "bg-emerald-500" : "bg-gray-300"}`} />
                    One number
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-white focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          {passwordError && (
            <p className="text-xs text-red-500 mt-sm">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-xs text-emerald-600 mt-sm">{passwordSuccess}</p>
          )}

          <Button
            onClick={handlePasswordChange}
            disabled={!newPassword || !confirmPassword || savingPassword}
            className="mt-md !rounded-[8px]"
            style={{ backgroundColor: "#82285f", color: "#FBF9F4" }}
          >
            <Save className="h-4 w-4 mr-2" />
            {savingPassword ? "Saving..." : "Update Password"}
          </Button>
        </div>
      </div>
    </div>
  )
}
