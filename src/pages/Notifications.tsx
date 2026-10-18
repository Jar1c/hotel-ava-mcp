import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { format, formatDistanceToNow } from "date-fns"
import {
  Bell,
  CalendarDays,
  CheckCheck,
  Clock,
  RefreshCw,
  Settings,
  ShieldAlert,
  Star,
  Tag,
  Trash2,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useNotifications } from "@/contexts/NotificationContext"
import { notificationsApi, type NotificationData } from "@/services/api"

const notifTypeStyles: Record<string, { bg: string; icon: React.ReactNode }> = {
  booking: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <CalendarDays className="size-4 text-ink" /> },
  review: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Star className="size-4 text-star-rating" /> },
  promo: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Tag className="size-4 text-ink" /> },
  reminder: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Clock className="size-4 text-ink" /> },
  system: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Settings className="size-4 text-ink" /> },
}

const relativeTime = (dateStr: string) => {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return "just now"
  }
}

const absoluteTime = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "MMM d, yyyy · h:mm a")
  } catch {
    return ""
  }
}

/**
 * Full-page notification center — shared by guest (/notifications) and
 * admin (/admin/notifications). The bell dropdown shows the latest 30;
 * this page loads the full history (200) with All/Unread tabs, delete,
 * refresh, and the same click-through + device-trust actions as the bell.
 */
export default function Notifications() {
  const { isAdmin } = useAuth()
  const {
    notifications: liveNotifications,
    loading: ctxLoading,
    markRead: ctxMarkRead,
    markAllRead: ctxMarkAllRead,
    deleteNotification,
    trustDevice,
    openNewLoginDialog,
    fetchNotifications,
    fetchUnreadCount,
  } = useNotifications()
  const navigate = useNavigate()

  const [items, setItems] = useState<NotificationData[]>([])
  const [tab, setTab] = useState<"all" | "unread">("all")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await notificationsApi.getAll(200)
      setItems(data)
    } catch {
      // silently fail — the bell list stays as fallback
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Merge realtime arrivals from the context list (context keeps the newest 30;
  // this page may hold far more, so only prepend what's genuinely new).
  useEffect(() => {
    setItems((prev) => {
      const known = new Set(prev.map((n) => n.id))
      const fresh = liveNotifications.filter((n) => !known.has(n.id))
      if (fresh.length === 0) return prev
      return [...fresh, ...prev]
    })
  }, [liveNotifications])

  const unread = useMemo(() => items.filter((n) => !n.read).length, [items])
  const visible = useMemo(
    () => (tab === "unread" ? items.filter((n) => !n.read) : items),
    [items, tab],
  )

  const markRead = useCallback(
    (id: string) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
      void ctxMarkRead(id)
    },
    [ctxMarkRead],
  )

  const markAll = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    void ctxMarkAllRead()
  }, [ctxMarkAllRead])

  const remove = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((n) => n.id !== id))
      void deleteNotification(id)
    },
    [deleteNotification],
  )

  const onTrust = useCallback(
    (notif: NotificationData) => {
      setItems((prev) => prev.filter((n) => n.id !== notif.id))
      void trustDevice(notif)
    },
    [trustDevice],
  )

  const onItemClick = useCallback(
    (notif: NotificationData) => {
      // Security alerts are resolved with their own buttons, not by jumping away
      if (notif.device_id) return
      if (!notif.read) markRead(notif.id)
      if (notif.type === "review") {
        navigate(isAdmin ? "/admin/reviews" : "/my-bookings")
      } else if (notif.booking_id || notif.type === "booking") {
        navigate(isAdmin ? "/admin/bookings" : "/my-bookings")
      }
    },
    [markRead, navigate, isAdmin],
  )

  const refreshing = loading && items.length > 0

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-10">
      {/* Title + actions */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold text-ink">Notifications</h1>
          <p className="text-sm text-muted mt-1">
            {unread > 0 ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void load()
              void fetchNotifications()
              void fetchUnreadCount()
            }}
            className="flex items-center gap-1.5 rounded-[8px] border border-hairline px-3 py-2 text-[13px] font-medium text-ink hover:bg-gray-50 dark:hover:bg-surface-strong transition-colors cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="flex items-center gap-1.5 rounded-[8px] bg-primary px-3 py-2 text-[13px] font-medium text-white hover:bg-primary-active transition-colors cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex items-center gap-1 border-b border-hairline">
        {([
          { value: "all" as const, label: "All", count: items.length },
          { value: "unread" as const, label: "Unread", count: unread },
        ]).map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`relative px-4 py-2.5 text-[13px] font-medium cursor-pointer transition-colors ${
              tab === t.value ? "text-primary" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-muted-soft">({t.count})</span>
            {tab === t.value && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-4 overflow-hidden rounded-[12px] border border-hairline bg-white dark:bg-surface-soft">
        {loading && items.length === 0 ? (
          <div className="divide-y divide-hairline/60">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3.5 px-5 py-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-gray-200 dark:bg-surface-strong relative overflow-hidden">
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-gray-200 dark:bg-surface-strong relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                  </div>
                  <div className="h-3 w-64 max-w-full rounded bg-gray-200 dark:bg-surface-strong relative overflow-hidden">
                    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" style={{ animationDelay: "0.15s" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-14 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-gray-100 dark:bg-surface-strong">
              <Bell className="size-5 text-muted" />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">
              {tab === "unread" ? "You're all caught up" : "No notifications yet"}
            </p>
            <p className="mt-1 text-[13px] text-muted">
              {tab === "unread"
                ? "Every notification has been read."
                : "Booking updates and reminders will appear here."}
            </p>
          </div>
        ) : (
          visible.map((notif) => (
            <div
              key={notif.id}
              onClick={() => onItemClick(notif)}
              className={`group flex items-start gap-3.5 border-b border-hairline/60 px-5 py-4 last:border-b-0 transition-colors ${
                notif.device_id
                  ? "cursor-default"
                  : "cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-strong"
              } ${!notif.read ? "bg-primary/5" : ""}`}
            >
              {/* Type icon */}
              <div
                className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  notif.device_id ? "bg-[#A4423A]/10" : notifTypeStyles[notif.type]?.bg || "bg-gray-100 dark:bg-surface-strong"
                }`}
              >
                {notif.device_id ? (
                  <ShieldAlert className="size-4 text-[#A4423A]" />
                ) : (
                  notifTypeStyles[notif.type]?.icon || <Bell className="size-4 text-ink" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">{notif.title}</span>
                  {!notif.read && <span className="shrink-0 size-2 rounded-full bg-primary" />}
                </div>
                <p className="text-[13px] text-muted mt-0.5 leading-relaxed">{notif.message}</p>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-soft">
                  <span>{relativeTime(notif.created_at)}</span>
                  {absoluteTime(notif.created_at) && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{absoluteTime(notif.created_at)}</span>
                    </>
                  )}
                </div>
                {notif.device_id && (
                  <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onTrust(notif)}
                      className="rounded-[6px] bg-primary text-white px-2.5 py-1 text-xs font-medium hover:bg-primary-active transition-colors cursor-pointer"
                    >
                      This was me
                    </button>
                    <button
                      onClick={() => {
                        markRead(notif.id)
                        openNewLoginDialog(notif)
                      }}
                      className="rounded-[6px] border border-hairline px-2.5 py-1 text-xs font-medium text-ink hover:bg-gray-50 dark:hover:bg-surface-strong transition-colors cursor-pointer"
                    >
                      Not you?
                    </button>
                  </div>
                )}
              </div>

              {/* Delete */}
              {!notif.device_id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(notif.id)
                  }}
                  aria-label="Delete notification"
                  className="shrink-0 rounded-[6px] p-1.5 text-muted opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-surface-strong hover:text-[#A4423A] transition-all cursor-pointer focus-visible:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {ctxLoading && items.length === 0 && !loading && (
        <p className="mt-3 text-center text-xs text-muted-soft">Syncing…</p>
      )}
    </div>
  )
}
