import { useState, useRef, useEffect } from "react"
import { Outlet, useNavigate } from "react-router"
import { Search, Bell, Calendar, DoorOpen, Users, Hash, CheckCheck, Settings, Tag, Clock } from "lucide-react"
import AdminSidebar from "@/components/admin/AdminSidebar"
import { useAuth } from "@/contexts/AuthContext"
import { useNotifications } from "@/contexts/NotificationContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HotelLogoIcon } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDistanceToNow } from "date-fns"
import type { NotificationData } from "@/services/api"

const searchSuggestions = [
  { icon: <Calendar className="w-4 h-4" />, label: "Bookings", description: "Search by guest name or booking ID", category: "bookings" },
  { icon: <DoorOpen className="w-4 h-4" />, label: "Rooms", description: "Search by room number or type", category: "rooms" },
  { icon: <Users className="w-4 h-4" />, label: "Guests", description: "Search by guest email or name", category: "guests" },
  { icon: <Hash className="w-4 h-4" />, label: "Booking ID", description: "e.g. BK-001, BK-002", category: "bookings" },
]

const notifTypeStyles: Record<string, { bg: string; icon: React.ReactNode }> = {
  booking: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Calendar className="size-4 text-ink" /> },
  promo: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Tag className="size-4 text-ink" /> },
  reminder: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Clock className="size-4 text-ink" /> },
  system: { bg: "bg-gray-100 dark:bg-surface-strong", icon: <Settings className="size-4 text-ink" /> },
}

function formatTime(dateStr: string) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
  } catch {
    return "just now"
  }
}

export default function Admin() {
  const { user } = useAuth()
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } = useNotifications()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleNotifOpenChange = (open: boolean) => {
    setNotifOpen(open)
    if (open) fetchNotifications()
  }

  const handleNotifClick = (notif: NotificationData) => {
    if (!notif.read) markRead(notif.id)
    setNotifOpen(false)
    if (notif.booking_id || notif.type === "booking") {
      navigate("/admin/bookings")
    }
  }

  const filteredSuggestions = searchQuery
    ? searchSuggestions.filter(
        (s) =>
          s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchSuggestions

  return (
    <div className="flex h-screen bg-[#f0f1f3] overflow-hidden">
      <AdminSidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between h-[60px] bg-white px-6 flex-shrink-0 border-b border-[#e2e4e8]">
          {/* Smart Search */}
          <div ref={searchRef} className="relative w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9ca3af] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search bookings, rooms, guests..."
                className="w-full rounded-[5px] border border-[#e2e4e8] bg-[#f5f6f8] py-2 pl-9 pr-4 text-sm text-[#1a1d26] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
              />
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e4e8] rounded-[6px] shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-[#e2e4e8]">
                  <p className="text-[10px] font-semibold text-[#b0b3b8] uppercase tracking-wider">
                    {searchQuery ? "Results" : "Quick Search"}
                  </p>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {filteredSuggestions.length > 0 ? (
                    filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        onClick={() => {
                          setSearchQuery("")
                          setShowDropdown(false)
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#f5f6f8] transition-colors duration-150 text-left"
                      >
                        <div className="flex items-center justify-center size-8 rounded-[5px] bg-[#f0f1f3] text-[#6b7280]">
                          {suggestion.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1a1d26] truncate">{suggestion.label}</p>
                          <p className="text-[11px] text-[#9ca3af] truncate">{suggestion.description}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center">
                      <p className="text-sm text-[#9ca3af]">No results found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notification bell — live unread + dropdown */}
            <DropdownMenu open={notifOpen} onOpenChange={handleNotifOpenChange}>
              <DropdownMenuTrigger className="relative flex size-9 items-center justify-center rounded-[5px] text-[#6b7280] hover:bg-[#f5f6f8] transition-colors cursor-pointer">
                <Bell className="size-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[#A4423A] text-white text-[10px] font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={8} positionMethod="fixed" className="w-80 !rounded-[12px] p-0 overflow-hidden dark:bg-surface-soft dark:border-hairline/50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-hairline/50">
                  <span className="text-sm font-semibold text-ink dark:text-ink-dark">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => markAllRead()}
                      className="text-xs text-primary hover:text-primary-active cursor-pointer flex items-center gap-1"
                    >
                      <CheckCheck className="size-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto overscroll-contain">
                  {notifications.length === 0 && loading ? (
                    <div className="divide-y divide-gray-50">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="px-4 py-3 space-y-2">
                          <div className="h-3.5 w-24 rounded bg-gray-200" />
                          <div className="h-3 w-48 rounded bg-gray-200" />
                        </div>
                      ))}
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">No notifications yet</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-strong transition-colors cursor-pointer border-b border-gray-50 dark:border-hairline/50 last:border-b-0 ${!notif.read ? "bg-primary/5" : ""}`}
                      >
                        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${notifTypeStyles[notif.type]?.bg || "bg-gray-100"}`}>
                          {notifTypeStyles[notif.type]?.icon || <Bell className="size-4 text-ink" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink truncate">{notif.title}</span>
                            {!notif.read && <span className="shrink-0 size-2 rounded-full bg-primary" />}
                          </div>
                          <p className="text-xs text-muted mt-0.5">{notif.message}</p>
                          <span className="text-[11px] text-muted-soft mt-1 block">{formatTime(notif.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="border-t border-gray-100 dark:border-hairline/50 px-4 py-2.5">
                  <button
                    onClick={() => { setNotifOpen(false); navigate("/admin/bookings") }}
                    className="w-full text-center text-xs text-primary hover:text-primary-active font-medium cursor-pointer"
                  >
                    View all notifications
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#1a1d26] leading-tight">{user?.name || "Admin"}</p>
                <p className="text-[11px] text-[#9ca3af]">{user?.email || "admin@hotelava.com"}</p>
              </div>
              <Avatar className="size-9">
                {user?.avatar && <AvatarImage src={user.avatar} />}
                <AvatarFallback className="bg-[#e8e2d3]">
                  <HotelLogoIcon />
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
