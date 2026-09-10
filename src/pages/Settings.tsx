import { useState } from "react"
import { Lock, Save, Eye, EyeOff, Sun, Moon, Monitor, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme, type ThemeMode, type ColorPreset } from "@/contexts/ThemeContext"
import { authApi } from "@/services/api"

const COLOR_PRESETS: { key: ColorPreset; label: string; primary: string; secondary: string }[] = [
  { key: "royal-plum", label: "Royal Plum", primary: "#82285f", secondary: "#455d58" },
  { key: "ocean-blue", label: "Ocean Blue", primary: "#1a6b8a", secondary: "#2d4a5e" },
  { key: "forest-green", label: "Forest Green", primary: "#2d6a4f", secondary: "#4a7c59" },
  { key: "sunset-orange", label: "Sunset Orange", primary: "#c45d3e", secondary: "#5e4a2d" },
  { key: "rose-gold", label: "Rose Gold", primary: "#b76e79", secondary: "#6e7b8b" },
  { key: "midnight", label: "Midnight", primary: "#1a1a2e", secondary: "#16213e" },
]

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
]

const TABS = [
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "security", label: "Change Password", icon: Lock },
] as const

type TabKey = typeof TABS[number]["key"]

export default function Settings() {
  const { mode, setMode, colorPreset, setColorPreset } = useTheme()
  const [activeTab, setActiveTab] = useState<TabKey>("appearance")

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

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
      <div className="max-w-3xl mx-auto">
        <h1 className="typo-display-lg text-ink mb-lg">Settings</h1>

        <div className="flex gap-lg">
          {/* Sidebar */}
          <nav className="w-48 shrink-0">
            <div className="bg-white border border-hairline rounded-[12px] p-2 dark:bg-surface-soft dark:border-hairline">
              {TABS.map((tab) => {
                const Icon = tab.icon
                const active = activeTab === tab.key
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-sm font-medium transition-all ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted hover:text-ink hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="bg-white border border-hairline rounded-[12px] p-md dark:bg-surface-soft dark:border-hairline">
                <h2 className="typo-title-sm text-ink mb-md">Appearance</h2>

                {/* Mode Toggle */}
                <div className="flex gap-2 mb-md">
                  {MODE_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const active = mode === opt.key
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setMode(opt.key)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium transition-all border ${
                          active
                            ? "bg-ink text-on-primary border-ink"
                            : "bg-transparent text-muted border-hairline hover:border-ink/30 hover:text-ink"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>

                {/* Color Presets */}
                <p className="text-xs text-muted mb-3">Color Scheme</p>
                <div className="grid grid-cols-3 gap-3">
                  {COLOR_PRESETS.map((preset) => {
                    const active = colorPreset === preset.key
                    return (
                      <button
                        key={preset.key}
                        onClick={() => setColorPreset(preset.key)}
                        className={`flex items-center gap-3 p-3 rounded-[10px] border transition-all ${
                          active
                            ? "border-ink ring-2 ring-ink/10"
                            : "border-hairline hover:border-ink/30"
                        }`}
                      >
                        <div className="flex shrink-0">
                          <div
                            className="w-6 h-6 rounded-full border border-black/10"
                            style={{ backgroundColor: preset.primary }}
                          />
                          <div
                            className="w-6 h-6 rounded-full border border-black/10 -ml-2"
                            style={{ backgroundColor: preset.secondary }}
                          />
                        </div>
                        <span className="text-xs font-medium text-ink">{preset.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="bg-white border border-hairline rounded-[12px] p-md dark:bg-surface-soft dark:border-hairline">
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
                        className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 transition-colors dark:bg-surface-soft"
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
                        className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 transition-colors dark:bg-surface-soft"
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
                      className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 transition-colors dark:bg-surface-soft"
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
                  className="mt-md !rounded-[8px] bg-primary text-primary-foreground hover:bg-primary-active"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingPassword ? "Saving..." : "Update Password"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
