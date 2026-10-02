import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Lock, Save, Eye, EyeOff, Sun, Moon, Monitor, Palette, Smartphone, QrCode, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import QrScannerDialog from "@/components/QrScannerDialog"
import { useTheme, type ThemeMode, type ColorPreset } from "@/contexts/ThemeContext"
import { authApi, sessionsApi, quickSigninApi, type SessionInfo } from "@/services/api"

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
  { key: "devices", label: "Devices", icon: Smartphone },
  { key: "quick-signin", label: "Quick Sign-In", icon: QrCode },
] as const

type TabKey = typeof TABS[number]["key"]

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? "" : "s"} ago`
}

const isMobileUA = (ua: string | null) => /android|iphone|ipad|mobile/i.test(ua || "")

/** Raw QR payload → the 8-char quick sign-in code (settings deep link or bare code). */
function extractQsCode(raw: string): string | null {
  const fromUrl = raw.match(/[?&]code=([A-Za-z0-9]{8})/)
  if (fromUrl) return fromUrl[1].toUpperCase()
  const plain = raw.trim().replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  return plain.length === 8 ? plain : null
}

export default function Settings() {
  const { mode, setMode, colorPreset, setColorPreset } = useTheme()
  const [searchParams, setSearchParams] = useSearchParams()
  // URL-driven (?tab=devices) — a reload or deep link lands on the same tab
  const activeTab: TabKey =
    TABS.find((tab) => tab.key === searchParams.get("tab"))?.key ?? "appearance"
  const setActiveTab = (key: TabKey) => setSearchParams({ tab: key }, { replace: true })

  // Devices & activity
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsLoaded, setSessionsLoaded] = useState(false)
  const [sessionsError, setSessionsError] = useState("")
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [confirmOthers, setConfirmOthers] = useState(false)
  const [revokingOthers, setRevokingOthers] = useState(false)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

  // Quick Sign-In approval (enter the code shown on the other device —
  // a scanned QR deep-links here with ?code= already filled in)
  const [qsCode, setQsCode] = useState(() =>
    (searchParams.get("code") ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8),
  )
  const [qsBusy, setQsBusy] = useState(false)
  const [qsError, setQsError] = useState("")
  const [qsDone, setQsDone] = useState(false)
  const [qsScannerOpen, setQsScannerOpen] = useState(false)

  const handleQsScan = (raw: string) => {
    const code = extractQsCode(raw)
    setQsScannerOpen(false)
    if (!code) {
      setQsError("That QR code isn't a quick sign-in code.")
      return
    }
    setQsCode(code)
    setQsError("")
    setQsDone(false)
  }

  const handleApproveQuickSignin = async () => {
    const code = qsCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    if (code.length !== 8) {
      setQsError("Enter the 8-character code shown on the other device.")
      return
    }
    setQsBusy(true)
    setQsError("")
    setQsDone(false)
    try {
      await quickSigninApi.approve(code)
      setQsDone(true)
      setQsCode("")
    } catch (err: any) {
      setQsError(err.message || "Could not approve that code.")
    } finally {
      setQsBusy(false)
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

  // Load the session list the first time the Devices tab opens
  useEffect(() => {
    if (activeTab !== "devices" || sessionsLoaded) return
    setSessionsLoading(true)
    sessionsApi
      .list()
      .then(setSessions)
      .catch((err) => setSessionsError(err.message || "Failed to load devices"))
      .finally(() => {
        setSessionsLoading(false)
        setSessionsLoaded(true)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sessionsLoaded])

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    setSessionsError("")
    try {
      await sessionsApi.revoke(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err: any) {
      setSessionsError(err.message || "Failed to log out this device")
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeOthers = async () => {
    setRevokingOthers(true)
    setSessionsError("")
    try {
      await sessionsApi.revokeOthers()
      setSessions((prev) => prev.filter((s) => s.is_current))
      setConfirmOthers(false)
    } catch (err: any) {
      setSessionsError(err.message || "Failed to log out other devices")
    } finally {
      setRevokingOthers(false)
    }
  }

  const otherSessions = sessions.filter((s) => !s.is_current)
  // "This device" always pinned on top; the rest by most recent activity
  const sortedSessions = [...sessions].sort((a, b) =>
    a.is_current === b.is_current
      ? new Date(b.last_used).getTime() - new Date(a.last_used).getTime()
      : a.is_current
        ? -1
        : 1,
  )

  return (
    <div className="px-base py-section">
      <div className="max-w-3xl mx-auto">
        <h1 className="typo-display-lg text-ink mb-lg">Settings</h1>

        {/* Top tabs — same pattern as admin settings; works on mobile + desktop */}
        <div className="flex gap-1 border-b border-hairline mb-lg overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div>
            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="bg-white border border-hairline rounded-[12px] p-md dark:bg-surface-soft dark:border-hairline">
                <h2 className="typo-title-sm text-ink mb-lg">Appearance</h2>

                {/* Mode Toggle */}
                <div className="mb-lg">
                  <p className="text-xs font-medium text-muted mb-3 uppercase tracking-wider">Theme</p>
                  <div className="flex gap-3">
                    {MODE_OPTIONS.map((opt) => {
                      const Icon = opt.icon
                      const active = mode === opt.key
                      return (
                        <button
                          key={opt.key}
                          onClick={() => setMode(opt.key)}
                          className={`flex-1 flex flex-col items-center gap-2 px-4 py-4 rounded-[12px] text-sm font-medium transition-all border ${
                            active
                              ? "bg-ink text-on-primary border-ink shadow-md"
                              : "bg-canvas text-muted border-hairline hover:border-ink/30 hover:text-ink dark:bg-surface"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Color Presets */}
                <div>
                  <p className="text-xs font-medium text-muted mb-3 uppercase tracking-wider">Color Scheme</p>
                  <div className="grid grid-cols-2 gap-3">
                    {COLOR_PRESETS.map((preset) => {
                      const active = colorPreset === preset.key
                      return (
                        <button
                          key={preset.key}
                          onClick={() => setColorPreset(preset.key)}
                          className={`flex items-center gap-3 p-3.5 rounded-[12px] border transition-all ${
                            active
                              ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                              : "border-hairline hover:border-ink/30 bg-canvas dark:bg-surface"
                          }`}
                        >
                          <div className="flex shrink-0 relative">
                            <div
                              className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: preset.primary }}
                            />
                            <div
                              className="w-8 h-8 rounded-full border-2 border-white shadow-sm -ml-3"
                              style={{ backgroundColor: preset.secondary }}
                            />
                          </div>
                          <span className="text-sm font-medium text-ink">{preset.label}</span>
                          {active && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-primary" />
                          )}
                        </button>
                      )
                    })}
                  </div>
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
                        className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 transition-colors dark:bg-surface"
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
                        className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 transition-colors dark:bg-surface"
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
                      className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 transition-colors dark:bg-surface"
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

            {/* Devices & activity Tab */}
            {activeTab === "devices" && (
              <div className="bg-white border border-hairline rounded-[12px] p-md dark:bg-surface-soft dark:border-hairline">
                <div className="flex items-center justify-between gap-3 mb-md flex-wrap">
                  <h2 className="typo-title-sm text-ink flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Devices &amp; activity
                  </h2>
                  {otherSessions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmOthers(true)}
                      className="!rounded-[8px] border-hairline text-ink"
                    >
                      Log out all others
                    </Button>
                  )}
                </div>

                {sessionsError && (
                  <p className="text-xs text-red-500 mb-sm">{sessionsError}</p>
                )}

                {sessionsLoading ? (
                  <div className="space-y-sm" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3.5 rounded-[12px] border border-hairline bg-canvas dark:bg-surface animate-pulse"
                      >
                        <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-surface-strong shrink-0" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="h-3.5 w-44 max-w-full bg-gray-200 dark:bg-surface-strong rounded" />
                          <div className="h-3 w-56 max-w-full bg-gray-100 dark:bg-surface-strong/60 rounded" />
                          <div className="h-3 w-36 max-w-full bg-gray-100 dark:bg-surface-strong/60 rounded" />
                        </div>
                        {i > 0 && (
                          <div className="h-7 w-16 rounded-[8px] bg-gray-100 dark:bg-surface-strong/60 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-sm">
                    {sortedSessions.map((s) => {
                      const Icon = isMobileUA(s.user_agent) ? Smartphone : Monitor
                      return (
                        <div
                          key={s.id}
                          className="flex items-start gap-3 p-3.5 rounded-[12px] border border-hairline bg-canvas dark:bg-surface"
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-ink truncate">
                                {s.device_name}
                              </span>
                              {s.is_current && (
                                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  This device
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted truncate">
                              {s.location || "Unknown location"}
                              {s.ip ? ` · ${s.ip}` : ""}
                            </p>
                            <p className="text-xs text-muted">
                              Last active {timeAgo(s.last_used)} · Joined{" "}
                              {new Date(s.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {!s.is_current && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={revokingId === s.id}
                              onClick={() => handleRevoke(s.id)}
                              className="!rounded-[8px] border-hairline text-ink shrink-0"
                            >
                              {revokingId === s.id ? "..." : "Log out"}
                            </Button>
                          )}
                        </div>
                      )
                    })}
                    {sessions.length === 0 && (
                      <p className="text-sm text-muted py-lg text-center">
                        No active sessions found.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quick Sign-In Tab */}
            {activeTab === "quick-signin" && (
              <div className="bg-white border border-hairline rounded-[12px] p-md dark:bg-surface-soft dark:border-hairline">
                <h2 className="typo-title-sm text-ink mb-sm flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Quick Sign-In
                </h2>
                <p className="text-sm text-muted mb-md leading-relaxed">
                  Signing in on another device? Scan the QR code it shows, or enter its
                  8-character code — the device is signed in as you, no password needed.
                </p>

                <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
                  <input
                    value={qsCode}
                    onChange={(e) => {
                      setQsCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
                      setQsError("")
                      setQsDone(false)
                    }}
                    placeholder="ABCD2345"
                    className="flex-1 rounded-[8px] border border-hairline bg-canvas px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-ink placeholder:text-muted-soft placeholder:tracking-normal placeholder:font-body focus:outline-none focus:border-primary/50 transition-colors dark:bg-surface"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQsScannerOpen(true)}
                    className="!rounded-[8px] border-hairline text-ink gap-2 shrink-0"
                  >
                    <Camera className="h-4 w-4" />
                    Scan QR
                  </Button>
                  <Button
                    onClick={handleApproveQuickSignin}
                    disabled={qsBusy || qsCode.length < 8}
                    className="!rounded-[8px] bg-primary text-primary-foreground hover:bg-primary-active disabled:opacity-50"
                  >
                    {qsBusy ? "Signing in device..." : "Sign in device"}
                  </Button>
                </div>

                {qsError && <p className="text-xs text-red-500 mt-sm">{qsError}</p>}
                {qsDone && (
                  <p className="text-xs text-emerald-600 mt-sm">
                    Approved — the other device is now signed in.
                  </p>
                )}
              </div>
            )}
          </div>

          <ConfirmDialog
            open={confirmOthers}
            onOpenChange={setConfirmOthers}
            title="Log out all other devices?"
            description={`This will end ${otherSessions.length} other session${
              otherSessions.length === 1 ? "" : "s"
            }. You'll stay signed in on this device.`}
            confirmLabel="Log out others"
            loading={revokingOthers}
            onConfirm={handleRevokeOthers}
          />
          <QrScannerDialog
            open={qsScannerOpen}
            onOpenChange={setQsScannerOpen}
            onResult={handleQsScan}
            hint="Scan the sign-in QR code shown on the other device."
          />
      </div>
    </div>
  )
}
