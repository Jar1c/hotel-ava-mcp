import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { LogOut } from "lucide-react"
import { notificationsApi, devicesApi, type NotificationData } from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { supabase } from "@/lib/supabase"
import { playNotificationSound, unlockNotificationSound } from "@/lib/notificationSound"
import NewLoginDialog from "@/components/security/NewLoginDialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface NotificationContextValue {
  notifications: NotificationData[]
  unreadCount: number
  /** Unread booking-type rows — drives the red "new bookings" nav badges. */
  unreadBookingCount: number
  loading: boolean
  ringNonce: number
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  /** Clear the red "new bookings" nav badge once the Bookings screen is opened. */
  markBookingNotificationsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  /** Confirm a flagged sign-in: trust the device + remove its alert. */
  trustDevice: (notif: NotificationData) => Promise<void>
  /** The open "New login" security dialog, if any. */
  newLoginNotif: NotificationData | null
  openNewLoginDialog: (notif: NotificationData) => void
  closeNewLoginDialog: () => void
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

/** Only surface toasts for notifications created within this window */
const TOAST_FRESH_MS = 20_000

function notifTarget(isAdmin: boolean, notif: NotificationData): string {
  if (notif.type === "review") {
    // "How was your stay?" toast → the review prompt lives in My Bookings
    return isAdmin ? "/admin/reviews" : "/my-bookings"
  }
  if (notif.booking_id || notif.type === "booking") {
    return isAdmin ? "/admin/bookings" : "/my-bookings"
  }
  return isAdmin ? "/admin/dashboard" : "/"
}

function isFresh(notif: NotificationData): boolean {
  const t = Date.parse(notif.created_at)
  if (Number.isNaN(t)) return false
  return Date.now() - t < TOAST_FRESH_MS
}

/** Hex SHA-256 — matches the access_hash the backend stores per session. */
async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, isAdmin, clearSession, consumeLogoutSuppress } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [ringNonce, setRingNonce] = useState(0)
  const [newLoginNotif, setNewLoginNotif] = useState<NotificationData | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const seededRef = useRef(false)

  // Red nav badge on "Bookings" / "My Bookings" — capped at 9+ by the caller.
  const unreadBookingCount = useMemo(
    () => notifications.filter((n) => !n.read && n.type === "booking").length,
    [notifications],
  )

  // Browsers only allow audio after a gesture — arm it on the first one.
  useEffect(() => {
    const arm = () => unlockNotificationSound()
    window.addEventListener("pointerdown", arm, { once: true, capture: true })
    window.addEventListener("keydown", arm, { once: true, capture: true })
    return () => {
      window.removeEventListener("pointerdown", arm, { capture: true })
      window.removeEventListener("keydown", arm, { capture: true })
    }
  }, [])

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silently fail
    }
  }, [])

  const trustDevice = useCallback(async (notif: NotificationData) => {
    if (notif.device_id) {
      try {
        await devicesApi.trust(notif.device_id)
      } catch {
        // best effort — the alert is still resolved locally
      }
    }
    try {
      await notificationsApi.delete(notif.id)
    } catch {
      // silently fail
    }
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id))
    if (!notif.read) setUnreadCount((c) => Math.max(0, c - 1))
  }, [])

  // Keep latest handlers in refs so fetch/realtime effects don't churn
  const toastRef = useRef(toast)
  const navigateRef = useRef(navigate)
  const isAdminRef = useRef(isAdmin)
  const markReadRef = useRef(markRead)
  const trustDeviceRef = useRef(trustDevice)
  useEffect(() => {
    toastRef.current = toast
    navigateRef.current = navigate
    isAdminRef.current = isAdmin
    markReadRef.current = markRead
    trustDeviceRef.current = trustDevice
  }, [toast, navigate, isAdmin, markRead, trustDevice])

  const showToast = useCallback((notif: NotificationData) => {
    if (seenIdsRef.current.has(notif.id)) return
    // Never popup historical rows — only brand-new inserts (or poll fallback within 20s)
    if (!isFresh(notif)) {
      seenIdsRef.current.add(notif.id)
      return
    }
    seenIdsRef.current.add(notif.id)
    const bell = document.querySelector<HTMLElement>("[data-notification-bell]")
    const rect = bell?.getBoundingClientRect()
    setRingNonce((n) => n + 1)
    playNotificationSound()
    const isDeviceAlert = Boolean(notif.device_id)
    toastRef.current({
      title: notif.title,
      description: notif.message,
      variant: "default",
      // Security alerts need reading time + a decision, not a quick glance
      duration: isDeviceAlert ? 20000 : 7000,
      origin: rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : undefined,
      onClick: () => {
        void markReadRef.current(notif.id)
        if (isDeviceAlert) {
          setNewLoginNotif(notif)
          return
        }
        navigateRef.current(notifTarget(isAdminRef.current, notif))
      },
      ...(isDeviceAlert
        ? {
            actions: [
              {
                label: "This was me",
                primary: true,
                onClick: () => void trustDeviceRef.current(notif),
              },
              {
                label: "Not you?",
                onClick: () => {
                  void markReadRef.current(notif.id)
                  setNewLoginNotif(notif)
                },
              },
            ],
          }
        : {}),
    })
  }, [])

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      setLoading(true)
      const data = await notificationsApi.getAll()
      // Always seed seen IDs from a full list — history never toasts
      data.forEach((n) => seenIdsRef.current.add(n.id))
      seededRef.current = true
      // Poll fallback: toast only brand-new rows that realtime missed
      // (after the first seed, seen already has history; showToast re-checks fresh)
      if (seededRef.current) {
        // no-op on seed path; freshness handled inside showToast for any unseen id
      }
      setNotifications(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const { count } = await notificationsApi.getUnreadCount()
      setUnreadCount(count)
    } catch {
      // silently fail
    }
  }, [isAuthenticated])

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      // silently fail
    }
  }, [])

  const markBookingNotificationsRead = useCallback(async () => {
    const targets = notifications.filter((n) => !n.read && n.type === "booking")
    if (targets.length === 0) return
    try {
      await Promise.all(targets.map((n) => notificationsApi.markRead(n.id)))
    } catch {
      // Partial failure — the next poll reconciles the count.
    }
    setNotifications((prev) => prev.map((n) => (n.type === "booking" ? { ...n, read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - targets.length))
  }, [notifications])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await notificationsApi.delete(id)
      setNotifications((prev) => {
        const deleted = prev.find((n) => n.id === id)
        if (deleted && !deleted.read) {
          setUnreadCount((c) => Math.max(0, c - 1))
        }
        return prev.filter((n) => n.id !== id)
      })
    } catch {
      // silently fail
    }
  }, [])

  const openNewLoginDialog = useCallback((notif: NotificationData) => setNewLoginNotif(notif), [])
  const closeNewLoginDialog = useCallback(() => setNewLoginNotif(null), [])

  /** Dialog: "Yes, this was me" → trust the device, clear the alert. */
  const confirmTrustedDevice = useCallback(
    async (notif: NotificationData) => {
      await trustDevice(notif)
      setNewLoginNotif(null)
      toastRef.current({
        title: "Device confirmed",
        description: "You won't be asked about this device again.",
        variant: "success",
      })
    },
    [trustDevice],
  )

  /** Dialog: "No, secure my account" → read the alert + open device management. */
  const secureAccount = useCallback(
    (notif: NotificationData) => {
      void markRead(notif.id)
      setNewLoginNotif(null)
      navigateRef.current("/settings?tab=devices")
    },
    [markRead],
  )

  // ── Remote-logout awareness (live, no reload) ──────────────────────────────
  const [revokedOpen, setRevokedOpen] = useState(false)
  const revocationHandledRef = useRef(false)

  // Re-arm after every (re-)login so the next remote logout is caught
  useEffect(() => {
    if (isAuthenticated) revocationHandledRef.current = false
  }, [isAuthenticated])

  // Keep the realtime socket's JWT on the current token. The socket authenticates
  // once at setup — after an auto-refresh its old JWT expires and postgres_changes
  // (notifications AND the remote-logout match) silently stop arriving.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        supabase.realtime.setAuth(sessionStorage.getItem("access_token"))
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  /** This device's session was ended elsewhere: tell the user + land on home. */
  const handleRemoteRevoked = useCallback(() => {
    // A sign-out started from this device — not a remote one
    if (consumeLogoutSuppress()) return
    if (revocationHandledRef.current) return
    revocationHandledRef.current = true
    clearSession()
    setRevokedOpen(true)
    // No auto-redirect to /login — the modal is the awareness; home stays open.
    // (Batched with clearSession, so a protected page never flashes /login first.)
    navigateRef.current("/")
  }, [clearSession, consumeLogoutSuppress])

  // Fallback when realtime misses it: api layer saw "Session revoked" on refresh
  useEffect(() => {
    const onRevoked = () => handleRemoteRevoked()
    window.addEventListener("hotelava:session-revoked", onRevoked)
    return () => window.removeEventListener("hotelava:session-revoked", onRevoked)
  }, [handleRemoteRevoked])

  // Supabase Realtime — INSERT only (new events, not history replay)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

    // Realtime runs RLS with the socket's JWT — without this it connects anon
    // and every postgres_changes event on notifications is filtered out.
    supabase.realtime.setAuth(sessionStorage.getItem("access_token"))

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notif = payload.new as NotificationData
          if (!notif?.id || seenIdsRef.current.has(notif.id)) return

          setNotifications((prev) => {
            if (prev.some((n) => n.id === notif.id)) return prev
            return [notif, ...prev].slice(0, 30)
          })
          setUnreadCount((c) => c + 1)
          // Freshness gate: realtime should always be fresh; poll-fallback IDs are seeded
          showToast(notif);
        }
      )
      .on(
        // Remote logout — fires the instant another device revokes a session.
        // Match by access_hash: only THIS device's row triggers the dialog.
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as { revoked?: boolean; access_hash?: string }
          if (!row?.revoked || !row.access_hash) return
          const token = sessionStorage.getItem("access_token")
          if (!token) return
          void sha256Hex(token).then((hash) => {
            if (hash === row.access_hash) handleRemoteRevoked()
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isAuthenticated, user?.id, showToast, handleRemoteRevoked])

  // Initial fetch + light polling (list/badge only — toast via realtime + freshness)
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      seededRef.current = false
      seenIdsRef.current = new Set()
      return
    }

    seededRef.current = false
    seenIdsRef.current = new Set()
    void fetchUnreadCount()
    void fetchNotifications()

    // 30s poll (was 8s) — realtime channel covers immediacy; skip when hidden
    const poll = setInterval(() => {
      if (document.visibilityState === "hidden") return
      void fetchUnreadCount()
      void fetchNotifications()
    }, 30000)

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void fetchUnreadCount()
        void fetchNotifications()
      }
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      clearInterval(poll)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [isAuthenticated, fetchUnreadCount, fetchNotifications])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadBookingCount,
        loading,
        ringNonce,
        fetchNotifications,
        fetchUnreadCount,
        markRead,
        markAllRead,
        markBookingNotificationsRead,
        deleteNotification,
        trustDevice,
        newLoginNotif,
        openNewLoginDialog,
        closeNewLoginDialog,
      }}
    >
      {children}
      <NewLoginDialog
        notif={newLoginNotif}
        onClose={closeNewLoginDialog}
        onTrust={confirmTrustedDevice}
        onSecureAccount={secureAccount}
      />
      {/* Live awareness: session ended from another device */}
      <Dialog
        open={revokedOpen}
        onOpenChange={(o) => {
          if (!o) setRevokedOpen(false)
        }}
      >
        <DialogContent className="!rounded-[16px] !max-w-[400px] !p-0 overflow-hidden">
          <div className="p-6 pb-4">
            <div className="flex justify-center mb-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-primary) 10%, transparent)",
                }}
              >
                <LogOut className="h-6 w-6 text-ink" />
              </div>
            </div>
            <DialogHeader className="text-center">
              <DialogTitle className="text-lg font-semibold text-ink">
                Signed out on this device
              </DialogTitle>
              <DialogDescription className="text-sm text-muted mt-2 leading-relaxed">
                Your session was ended from another device. Please sign in again to continue.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6">
            <Button
              onClick={() => {
                setRevokedOpen(false)
                navigateRef.current("/login")
              }}
              className="w-full !rounded-[10px] h-11 font-medium"
              style={{ backgroundColor: "var(--color-primary)", color: "#FBF9F4" }}
            >
              Sign in again
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider")
  return ctx
}
