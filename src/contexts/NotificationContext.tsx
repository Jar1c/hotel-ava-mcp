import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { useNavigate } from "react-router"
import { notificationsApi, type NotificationData } from "@/services/api"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { supabase } from "@/lib/supabase"

interface NotificationContextValue {
  notifications: NotificationData[]
  unreadCount: number
  loading: boolean
  fetchNotifications: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

/** Only surface toasts for notifications created within this window */
const TOAST_FRESH_MS = 20_000

function notifTarget(isAdmin: boolean, notif: NotificationData): string {
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

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, isAdmin } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationData[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const seededRef = useRef(false)

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id)
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // silently fail
    }
  }, [])

  // Keep latest handlers in refs so fetch/realtime effects don't churn
  const toastRef = useRef(toast)
  const navigateRef = useRef(navigate)
  const isAdminRef = useRef(isAdmin)
  const markReadRef = useRef(markRead)
  useEffect(() => {
    toastRef.current = toast
    navigateRef.current = navigate
    isAdminRef.current = isAdmin
    markReadRef.current = markRead
  }, [toast, navigate, isAdmin, markRead])

  const showToast = useCallback((notif: NotificationData) => {
    if (seenIdsRef.current.has(notif.id)) return
    // Never popup historical rows — only brand-new inserts (or poll fallback within 20s)
    if (!isFresh(notif)) {
      seenIdsRef.current.add(notif.id)
      return
    }
    seenIdsRef.current.add(notif.id)
    toastRef.current({
      title: notif.title,
      description: notif.message,
      variant: "default",
      duration: 7000,
      onClick: () => {
        void markReadRef.current(notif.id)
        navigateRef.current(notifTarget(isAdminRef.current, notif))
      },
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

  // Supabase Realtime — INSERT only (new events, not history replay)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return

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
          showToast(notif)
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isAuthenticated, user?.id, showToast])

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
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markRead,
        markAllRead,
        deleteNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider")
  return ctx
}
