import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Save, Eye, EyeOff, Sun, Moon, Monitor, Smartphone, QrCode, Camera, CircleCheck, CircleAlert, Mail } from "lucide-react"
import type { UserIdentity } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import ConfirmDialog from "@/components/ui/confirm-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import QrScannerDialog from "@/components/QrScannerDialog"
import QuickSigninGuide from "@/components/QuickSigninGuide"
import { useTheme, type ThemeMode, type ColorPreset } from "@/contexts/ThemeContext"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { supabase, supabaseUrl, supabaseAnonKey } from "@/lib/supabase"
import { authApi, sessionsApi, quickSigninApi, type SessionInfo } from "@/services/api"
import { getAccessToken, getRefreshToken } from "@/lib/tokenStore"

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
  { key: "appearance", label: "Appearance" },
  { key: "security", label: "Login & security" },
  { key: "devices", label: "Devices" },
  { key: "quick-signin", label: "Quick Sign-In" },
] as const

const settingsInputClass =
  "w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 transition-colors dark:bg-surface"

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29a7.18 7.18 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
    </svg>
  )
}

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
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
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
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")

  // ── Connected accounts (Supabase identity linking) ──
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null)
  const [identitiesFailed, setIdentitiesFailed] = useState(false)
  const [showSetPw, setShowSetPw] = useState(false)
  const [setPw, setSetPw] = useState("")
  const [setPwConfirm, setSetPwConfirm] = useState("")
  const [setPwBusy, setSetPwBusy] = useState(false)
  const [setPwError, setSetPwError] = useState("")
  const [reauthOpen, setReauthOpen] = useState(false)
  const [reauthPassword, setReauthPassword] = useState("")
  const [reauthBusy, setReauthBusy] = useState(false)
  const [reauthError, setReauthError] = useState("")
  const pendingReauthRef = useRef<(() => Promise<void>) | null>(null)

  // ── Account deletion (30-day grace period) ──
  const [delOpen, setDelOpen] = useState(false)
  const [delPassword, setDelPassword] = useState("")
  const [delTyped, setDelTyped] = useState("")
  const [delError, setDelError] = useState("")
  const [delBusy, setDelBusy] = useState(false)
  const [googleReauthed, setGoogleReauthed] = useState(false)
  const [delCancelBusy, setDelCancelBusy] = useState(false)

  const hasEmailIdentity = identities?.some((i) => i.provider === "email") ?? false
  const googleIdentity = identities?.find((i) => i.provider === "google") ?? null
  const googleEmail = String(googleIdentity?.identity_data?.email || "")
  // A failed identities load must never hide the existing Change Password card.
  const showChangePassword = identitiesFailed || identities === null || hasEmailIdentity

  /** Adopt the app's stored tokens if the browser has no Supabase session
   *  (email/password logins create one best-effort; this is the safety net). */
  const ensureSupabaseSession = async (): Promise<boolean> => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session) return true
    const access_token = getAccessToken()
    const refresh_token = getRefreshToken()
    if (!access_token || !refresh_token) return false
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    return !error
  }

  const loadIdentities = async () => {
    try {
      setIdentitiesFailed(false)
      if (!(await ensureSupabaseSession())) {
        setIdentities([])
        setIdentitiesFailed(true)
        return
      }
      const { data, error } = await supabase.auth.getUserIdentities()
      if (error) throw error
      let list = data?.identities ?? []
      // Same-email rule: a Google identity from a different address never stays
      // linked — remove it right away and explain why.
      const mismatched = list.find(
        (i) =>
          i.provider === "google" &&
          !!i.identity_data?.email &&
          String(i.identity_data.email).toLowerCase() !== (user?.email || "").toLowerCase(),
      )
      if (mismatched) {
        const { error: unlinkErr } = await supabase.auth.unlinkIdentity(mismatched)
        if (unlinkErr) {
          toast({ title: "Couldn't connect that Google account", description: "Please try again.", variant: "error" })
        } else {
          list = list.filter((i) => i.id !== mismatched.id)
          toast({
            title: "Google account not connected",
            description: `This Google account (${String(mismatched.identity_data?.email)}) is different from your account email (${user?.email}). Use the same email to connect.`,
            variant: "error",
            duration: 8000,
          })
        }
      }
      setIdentities(list)
    } catch {
      setIdentities([])
      setIdentitiesFailed(true)
    }
  }

  useEffect(() => {
    if (activeTab !== "security") return
    void loadIdentities()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Coming back from the Google consent screen → land on this tab again
  useEffect(() => {
    if (sessionStorage.getItem("link_intent") === "google") {
      sessionStorage.removeItem("link_intent")
      setActiveTab("security")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Coming back from Google re-auth in the delete flow: is it the SAME account?
  useEffect(() => {
    if (!user?.id) return
    const params = new URLSearchParams(window.location.search)
    if (params.get("reauth") !== "delete") return
    sessionStorage.removeItem("delete_reauth_intent")
    params.delete("reauth")
    const qs = params.toString()
    window.history.replaceState({}, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
    ;(async () => {
      try {
        const { data: { user: sbUser } } = await supabase.auth.getUser()
        if (sbUser && sbUser.id === user.id) {
          setGoogleReauthed(true)
          setDelOpen(true)
          setDelError("")
        } else {
          toast({
            title: "Google account doesn't match",
            description: "Sign in with the Google account that matches your email, then try again.",
            variant: "error",
          })
        }
      } catch {
        toast({
          title: "Google sign-in couldn't be confirmed",
          description: "Please try again.",
          variant: "error",
        })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /** Re-auth gate: verify the account password WITHOUT touching any session —
   *  direct GoTrue password grant, returned tokens discarded. */
  const verifyPassword = async (password: string): Promise<boolean> => {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user?.email, password }),
    })
    return res.ok
  }

  const runWithReauth = (action: () => Promise<void>) => {
    pendingReauthRef.current = action
    setReauthPassword("")
    setReauthError("")
    setReauthOpen(true)
  }

  const handleReauth = async () => {
    if (!reauthPassword) {
      setReauthError("Enter your password to continue.")
      return
    }
    setReauthBusy(true)
    setReauthError("")
    try {
      const ok = await verifyPassword(reauthPassword)
      if (!ok) {
        setReauthError("That password is incorrect.")
        return
      }
      const action = pendingReauthRef.current
      pendingReauthRef.current = null
      setReauthOpen(false)
      setReauthPassword("")
      await action?.()
    } finally {
      setReauthBusy(false)
    }
  }

  const linkErrorToast = (message: string) => {
    if (message.includes("manual linking") || message.includes("manual_linking")) {
      toast({
        title: "Account linking is turned off",
        description: "Linking sign-in methods is disabled for this project. Contact support to enable it.",
        variant: "error",
      })
      return
    }
    if (message.includes("already linked") || message.includes("already exists")) {
      toast({
        title: "Google already connected",
        description: "That Google account is already linked to your account.",
        variant: "error",
      })
      return
    }
    toast({
      title: "Couldn't connect Google",
      description: "Something went wrong. Please try again.",
      variant: "error",
    })
  }

  const connectGoogle = async () => {
    if (!(await ensureSupabaseSession())) {
      toast({ title: "Please sign in again", description: "Your session expired. Sign in to connect Google.", variant: "error" })
      return
    }
    sessionStorage.setItem("link_intent", "google")
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/settings` },
    })
    if (error) {
      sessionStorage.removeItem("link_intent")
      linkErrorToast(error.message || "")
    }
    // On success the browser navigates away to Google's consent screen.
  }

  // ── Account deletion (30-day grace period) ──

  const formatDeletionDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return "soon"
    }
  }

  const openDeleteDialog = () => {
    setDelPassword("")
    setDelTyped("")
    setDelError("")
    setGoogleReauthed(false)
    setDelOpen(true)
  }

  /** Google-only accounts re-prove presence with a fresh Google sign-in;
   *  backend checks last_sign_in_at within 10 minutes. */
  const startGoogleDeleteReauth = async () => {
    setDelError("")
    if (!(await ensureSupabaseSession())) {
      setDelError("Your session expired. Sign in again and retry.")
      return
    }
    sessionStorage.setItem("delete_reauth_intent", "google")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/settings?tab=security&reauth=delete`,
      },
    })
    if (error) {
      sessionStorage.removeItem("delete_reauth_intent")
      setDelError(error.message || "Could not start Google sign-in.")
    }
  }

  const handleDeleteSubmit = async () => {
    if (delTyped.trim() !== "DELETE") {
      setDelError("Type DELETE to confirm.")
      return
    }
    const usePassword = hasEmailIdentity && delPassword.length > 0
    if (!usePassword && !googleReauthed) {
      setDelError(
        hasEmailIdentity ? "Enter your password to continue." : "Confirm with Google first."
      )
      return
    }
    setDelBusy(true)
    setDelError("")
    try {
      await authApi.deleteRequest({
        typed_confirm: "DELETE",
        ...(usePassword ? { password: delPassword } : {}),
        ...(!hasEmailIdentity ? { reauth: "google" as const } : {}),
      })
      setDelOpen(false)
      await refreshUser()
      toast({
        title: "Account scheduled for deletion",
        description: "You can cancel any time before the deletion date from Settings.",
        variant: "success",
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : ""
      setDelError(message || "Something went wrong. Please try again.")
    } finally {
      setDelBusy(false)
    }
  }

  const handleCancelDeletion = async () => {
    setDelCancelBusy(true)
    try {
      await authApi.deleteCancel()
      await refreshUser()
      toast({
        title: "Deletion cancelled",
        description: "Your account is back to normal.",
        variant: "success",
      })
    } catch {
      toast({
        title: "Couldn't cancel deletion",
        description: "Please try again.",
        variant: "error",
      })
    } finally {
      setDelCancelBusy(false)
    }
  }

  const handleSetPassword = async () => {
    setSetPwError("")
    if (setPw.length < 8 || !/[A-Z]/.test(setPw) || !/[0-9]/.test(setPw)) {
      setSetPwError("Use at least 8 characters with one uppercase letter and one number.")
      return
    }
    if (setPw !== setPwConfirm) {
      setSetPwError("Passwords do not match")
      return
    }
    setSetPwBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: setPw })
      if (error) throw error
      toast({ title: "Password set", description: "You can now sign in with your email and password.", variant: "success" })
      setShowSetPw(false)
      setSetPw("")
      setSetPwConfirm("")
      await loadIdentities()
    } catch {
      toast({ title: "Couldn't set your password", description: "Please try again.", variant: "error" })
    } finally {
      setSetPwBusy(false)
    }
  }

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
  const [qsSuccessOpen, setQsSuccessOpen] = useState(false)

  const approveQsCode = async (code: string) => {
    setQsBusy(true)
    setQsError("")
    setQsDone(false)
    try {
      await quickSigninApi.approve(code)
      setQsDone(true)
      setQsSuccessOpen(true)
      setQsCode("")
    } catch (err: any) {
      setQsError(err.message || "Could not approve that code.")
    } finally {
      setQsBusy(false)
    }
  }

  const handleApproveQuickSignin = async () => {
    const code = qsCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    if (code.length !== 8) {
      setQsError("Enter the 8-character code shown on the other device.")
      return
    }
    await approveQsCode(code)
  }

  // A successful scan IS the confirmation — approve without an extra tap.
  const handleQsScan = (raw: string) => {
    const code = extractQsCode(raw)
    setQsScannerOpen(false)
    if (!code) {
      setQsError("That QR code isn't a quick sign-in code.")
      return
    }
    setQsCode(code)
    void approveQsCode(code)
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
        <h1 className="typo-display-lg text-ink">Settings</h1>
        <p className="text-sm text-muted mb-lg">Manage how you sign in and secure your account</p>

        {/* Top tabs — same pattern as admin settings; works on mobile + desktop */}
        <div className="flex gap-1 border-b border-hairline mb-lg overflow-x-auto">
          {TABS.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div>
            {/* Appearance Tab */}
            {activeTab === "appearance" && (
              <div className="bg-white border border-hairline rounded-[12px] p-6 dark:bg-surface-soft dark:border-hairline">
                <h2 className="text-base font-semibold text-ink mb-lg">Appearance</h2>

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
              <div className="space-y-6">
                {/* ── Connected accounts ── */}
                <div className="bg-white border border-hairline rounded-[12px] p-6 dark:bg-surface-soft dark:border-hairline">
                  <h2 className="text-base font-semibold text-ink mb-md">Connected accounts</h2>

                  {identitiesFailed ? (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted">Couldn&apos;t load your sign-in methods.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="!rounded-[8px]"
                        onClick={() => void loadIdentities()}
                      >
                        Try again
                      </Button>
                    </div>
                  ) : identities === null ? (
                    <p className="text-sm text-muted">Loading your sign-in methods…</p>
                  ) : (
                    <>
                      {/* Email */}
                      <div className="flex flex-col gap-3 py-4 border-b border-hairline sm:flex-row sm:items-center sm:justify-between dark:border-hairline/60">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-canvas dark:border-hairline/60 dark:bg-surface">
                            <Mail className="h-4 w-4 text-muted" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">Email</p>
                            <p className="text-[13px] text-ink/70 truncate">
                              {hasEmailIdentity
                                ? user?.email
                                : `${user?.email} — email sign-in not set up`}
                            </p>
                          </div>
                        </div>
                        {hasEmailIdentity ? (
                          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-ink/70">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                            Connected
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="!rounded-[8px] shrink-0"
                            onClick={() => setShowSetPw(true)}
                          >
                            Set a password
                          </Button>
                        )}
                      </div>

                      {/* Google */}
                      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white dark:border-hairline/60 dark:bg-surface">
                            <GoogleGlyph className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">Google</p>
                            <p className="text-[13px] text-ink/70 truncate">
                              {googleIdentity ? googleEmail : "Not connected"}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {googleIdentity ? (
                            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink/70">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                              Connected
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="!rounded-[8px]"
                              onClick={() => runWithReauth(connectGoogle)}
                            >
                              Connect Google
                            </Button>
                          )}
                        </div>
                      </div>

                      {hasEmailIdentity && googleIdentity && (
                        <p className="border-t border-hairline pt-4 text-[13px] text-muted dark:border-hairline/60">
                          Both use the same email, so they are one account.
                        </p>
                      )}

                      {/* Google-only accounts set their password here */}
                      {showSetPw && !hasEmailIdentity && (
                        <div className="mt-4 max-w-[400px] pt-4 border-t border-hairline space-y-sm dark:border-hairline/60">
                          <div>
                            <label className="block text-[13px] font-medium text-ink/70 mb-1">New Password</label>
                            <input
                              type="password"
                              value={setPw}
                              onChange={(e) => setSetPw(e.target.value)}
                              className={settingsInputClass}
                              placeholder="Enter new password"
                            />
                          </div>
                          <div>
                            <label className="block text-[13px] font-medium text-ink/70 mb-1">Confirm New Password</label>
                            <input
                              type="password"
                              value={setPwConfirm}
                              onChange={(e) => setSetPwConfirm(e.target.value)}
                              className={settingsInputClass}
                              placeholder="Confirm new password"
                            />
                          </div>
                          {setPwError && <p className="text-[13px] text-red-500">{setPwError}</p>}
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              onClick={() => void handleSetPassword()}
                              disabled={setPwBusy || !setPw || !setPwConfirm}
                              className="!rounded-[8px] bg-primary text-primary-foreground hover:bg-primary-active"
                            >
                              {setPwBusy ? "Setting…" : "Set password"}
                            </Button>
                            <Button
                              variant="ghost"
                              className="!rounded-[8px]"
                              onClick={() => {
                                setShowSetPw(false)
                                setSetPw("")
                                setSetPwConfirm("")
                                setSetPwError("")
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Change password (existing) ── */}
                {showChangePassword && (
                <div className="bg-white border border-hairline rounded-[12px] p-6 dark:bg-surface-soft dark:border-hairline">
                  <h2 className="text-base font-semibold text-ink mb-md">Change Password</h2>

                <div className="max-w-[400px] space-y-sm">
                  {/* Current password */}
                  <div>
                    <label htmlFor="spw-current" className="block text-[13px] font-medium text-ink/70 mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        id="spw-current"
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 transition-colors dark:bg-surface"
                        placeholder="Enter current password"
                        aria-describedby={passwordError ? "spw-error" : undefined}
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
                    <label htmlFor="spw-new" className="block text-[13px] font-medium text-ink/70 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        id="spw-new"
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        aria-describedby={[newPassword ? "spw-reqs" : "", passwordError ? "spw-error" : ""].filter(Boolean).join(" ") || undefined}
                        className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 transition-colors dark:bg-surface"
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
                      <div id="spw-reqs" className="mt-2 space-y-1">
                        <p className={`text-[13px] flex items-center gap-1.5 ${hasLength ? "text-emerald-600" : "text-muted"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hasLength ? "bg-emerald-500" : "bg-gray-300"}`} />
                          At least 8 characters
                        </p>
                        <p className={`text-[13px] flex items-center gap-1.5 ${hasUpper ? "text-emerald-600" : "text-muted"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hasUpper ? "bg-emerald-500" : "bg-gray-300"}`} />
                          One uppercase letter
                        </p>
                        <p className={`text-[13px] flex items-center gap-1.5 ${hasNumber ? "text-emerald-600" : "text-muted"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${hasNumber ? "bg-emerald-500" : "bg-gray-300"}`} />
                          One number
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label htmlFor="spw-confirm" className="block text-[13px] font-medium text-ink/70 mb-1">Confirm New Password</label>
                    <div className="relative">
                      <input
                        id="spw-confirm"
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-hairline rounded-[8px] text-sm bg-canvas focus:outline-none focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1 transition-colors dark:bg-surface"
                        placeholder="Confirm new password"
                        aria-describedby={passwordError ? "spw-error" : undefined}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {passwordError && (
                  <p id="spw-error" className="text-[13px] text-red-500 mt-sm">{passwordError}</p>
                )}
                {passwordSuccess && (
                  <p className="text-[13px] text-emerald-600 mt-sm">{passwordSuccess}</p>
                )}

                <Button
                  onClick={handlePasswordChange}
                  disabled={!newPassword || !confirmPassword || savingPassword}
                  className="mt-md !rounded-[8px] bg-primary text-primary-foreground hover:bg-primary-active disabled:bg-muted disabled:text-muted-foreground"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingPassword ? "Saving…" : "Update Password"}
                </Button>
                </div>
                )}

                {/* ── Danger zone: account deletion ── */}
                <div className="pt-2">
                  <p className="text-[13px] font-semibold text-muted mb-3">Danger zone</p>
                  <div className="bg-white border border-hairline rounded-[12px] p-6 dark:bg-surface-soft dark:border-hairline">
                  <h2 className="text-base font-semibold text-ink mb-md">Delete account</h2>
                  {user?.scheduled_deletion_at ? (
                    <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-500/10">
                      <p className="text-sm text-ink">
                        Scheduled for deletion on{" "}
                        <strong>{formatDeletionDate(user.scheduled_deletion_at)}</strong>.
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        New bookings are disabled. You can cancel any time before that date.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 !rounded-[8px] border-red-300 text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white"
                        onClick={() => void handleCancelDeletion()}
                        disabled={delCancelBusy}
                      >
                        {delCancelBusy ? "Cancelling…" : "Cancel deletion"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-muted">
                        Permanently delete your account after a 30-day grace period.
                        You can cancel any time before then.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="!rounded-[8px] shrink-0 border-red-300 bg-white text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white dark:border-red-500/40 dark:bg-transparent dark:text-red-400 dark:hover:border-red-600 dark:hover:bg-red-600 dark:hover:text-white"
                        onClick={openDeleteDialog}
                      >
                        Delete account
                      </Button>
                    </div>
                  )}
                </div>
                </div>
              </div>
            )}

            {/* Devices & activity Tab */}
            {activeTab === "devices" && (
              <div className="bg-white border border-hairline rounded-[12px] p-6 dark:bg-surface-soft dark:border-hairline">
                <div className="flex items-center justify-between gap-3 mb-md flex-wrap">
                  <h2 className="text-base font-semibold text-ink">Devices & activity</h2>
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
                              {revokingId === s.id ? "…" : "Log out"}
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
              <div className="bg-white border border-hairline rounded-[12px] p-6 dark:bg-surface-soft dark:border-hairline sm:p-8">
                {/* Hero */}
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary/10">
                    <QrCode className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-base font-semibold text-ink mt-4">Approve another device</h2>
                  <p className="mt-1 max-w-[24rem] text-sm leading-relaxed text-muted">
                    Enter the code shown on the other device's Login page — it signs in as
                    you, no password needed.
                  </p>
                </div>

                {/* Code + actions */}
                <div className="mx-auto mt-6 flex max-w-[24rem] flex-col gap-3">
                  <label
                    htmlFor="qs-code"
                    className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-soft"
                  >
                    Device code
                  </label>
                  <input
                    id="qs-code"
                    value={qsCode}
                    onChange={(e) => {
                      const next = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
                      setQsCode(next)
                      setQsError("")
                      setQsDone(false)
                    }}
                    placeholder="ABCD2345"
                    aria-label="Device code"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={8}
                    className="w-full rounded-[12px] border border-hairline bg-canvas px-4 py-3.5 pl-[calc(1rem+0.35em)] text-center font-mono text-xl font-semibold tracking-[0.35em] text-ink transition-colors placeholder:font-body placeholder:text-base placeholder:font-normal placeholder:tracking-[0.15em] placeholder:text-muted-soft focus:border-primary/50 focus:outline-none dark:bg-surface"
                  />
                  <Button
                    onClick={handleApproveQuickSignin}
                    disabled={qsBusy || qsCode.length < 8}
                    className="!rounded-[12px] w-full bg-primary text-primary-foreground hover:bg-primary-active disabled:opacity-50"
                  >
                    {qsBusy ? "Signing in device…" : "Sign in device"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQsScannerOpen(true)}
                    className="!rounded-[12px] border-hairline text-ink gap-2"
                  >
                    <Camera className="h-4 w-4" />
                    Scan QR
                  </Button>
                </div>

                {/* Status */}
                <div role="status" aria-live="polite" className="mx-auto mt-4 min-h-[20px] max-w-[28rem] text-center">
                  {qsError && (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-red-500">
                      <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                      {qsError}
                    </p>
                  )}
                  {!qsError && qsDone && (
                    <p className="flex items-center justify-center gap-1.5 text-xs text-emerald-600">
                      <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                      Approved — the other device is now signed in.
                    </p>
                  )}
                </div>

                {/* How it works — animated illustrated guide */}
                <QuickSigninGuide />
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
          <Dialog open={qsSuccessOpen} onOpenChange={setQsSuccessOpen}>
            <DialogContent className="rounded-[12px] sm:max-w-[420px]">
              <DialogHeader>
                <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                  <CircleCheck className="h-6 w-6 text-emerald-600" />
                </div>
                <DialogTitle className="text-center">Other device signed in</DialogTitle>
                <DialogDescription className="text-center">
                  The other device is now signed in as {user?.name || "you"}. It can browse,
                  book, and manage stays using your account.
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                onClick={() => setQsSuccessOpen(false)}
                className="!rounded-[8px] w-full"
              >
                Done
              </Button>
            </DialogContent>
          </Dialog>

          {/* Re-enter password before connecting a sign-in method */}
          <Dialog
            open={reauthOpen}
            onOpenChange={(open) => {
              if (reauthBusy) return
              setReauthOpen(open)
              if (!open) {
                pendingReauthRef.current = null
                setReauthPassword("")
                setReauthError("")
              }
            }}
          >
            <DialogContent className="rounded-[12px] sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Confirm it&apos;s you</DialogTitle>
                <DialogDescription>
                  Enter your password before changing how you sign in.
                </DialogDescription>
              </DialogHeader>
              <input
                type="password"
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleReauth()
                }}
                className={settingsInputClass}
                placeholder="Your password"
                aria-label="Current password"
                autoFocus
              />
              {reauthError && <p className="text-xs text-red-500">{reauthError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  className="!rounded-[8px]"
                  disabled={reauthBusy}
                  onClick={() => {
                    setReauthOpen(false)
                    pendingReauthRef.current = null
                    setReauthPassword("")
                    setReauthError("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleReauth()}
                  disabled={reauthBusy}
                  className="!rounded-[8px] bg-primary text-primary-foreground hover:bg-primary-active"
                >
                  {reauthBusy ? "Checking…" : "Continue"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete account — 30-day grace period */}
          <Dialog
            open={delOpen}
            onOpenChange={(open) => {
              if (delBusy) return
              setDelOpen(open)
              if (!open) {
                setDelError("")
                setDelPassword("")
                setDelTyped("")
              }
            }}
          >
            <DialogContent className="rounded-[12px] sm:max-w-[440px]">
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>Here&apos;s what happens:</DialogDescription>
              </DialogHeader>
              <ul className="space-y-1.5 text-sm text-muted list-disc pl-5">
                <li>Your account is deactivated right away — new bookings are blocked.</li>
                <li>It is permanently deleted after 30 days. You can cancel any time before then.</li>
                <li>
                  Booking and payment records stay in anonymized form for the hotel&apos;s
                  records (amounts and dates only).
                </li>
              </ul>
              {hasEmailIdentity ? (
                <input
                  type="password"
                  value={delPassword}
                  aria-label="Your password"
                  onChange={(e) => setDelPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleDeleteSubmit()
                  }}
                  className={settingsInputClass}
                  placeholder="Your password"
                  autoFocus
                />
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="!rounded-[8px] w-full"
                  onClick={() => void startGoogleDeleteReauth()}
                  disabled={delBusy}
                >
                  {googleReauthed
                    ? "Google confirmed — ready to delete"
                    : "Continue with Google to confirm"}
                </Button>
              )}
              <input
                value={delTyped}
                aria-label="Type DELETE to confirm"
                onChange={(e) => setDelTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleDeleteSubmit()
                }}
                className={settingsInputClass}
                placeholder="Type DELETE to confirm"
              />
              {delError && <p className="text-xs text-red-500">{delError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  className="!rounded-[8px]"
                  disabled={delBusy}
                  onClick={() => setDelOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="!rounded-[8px]"
                  onClick={() => void handleDeleteSubmit()}
                  disabled={delBusy || delTyped.trim() !== "DELETE"}
                >
                  {delBusy ? "Deleting…" : "Delete account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>
    </div>
  )
}
