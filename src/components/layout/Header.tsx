import { NavLink, Link, useLocation, useNavigate } from "react-router"
import { useState } from "react"
import { User, LogOut, Settings, CalendarDays, ChevronDown, Bell, CheckCheck, Tag, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage, HotelLogoIcon } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import { publicNavItems, guestNavItems } from "@/data/navigation"
import hotelAvaLogo from "@/assets/images/Hotel Ava logo.png"

interface Notification {
  id: number
  type: "booking" | "promo" | "reminder" | "system"
  title: string
  message: string
  time: string
  read: boolean
}

const mockNotifications: Notification[] = [
  {
    id: 1,
    type: "booking",
    title: "Booking Confirmed",
    message: "Your stay at Standard Room on Sep 15-16 is confirmed.",
    time: "2 min ago",
    read: false,
  },
  {
    id: 2,
    type: "promo",
    title: "Weekend Special Offer",
    message: "Get 15% off on all suites this weekend! Book now.",
    time: "1 hour ago",
    read: false,
  },
  {
    id: 3,
    type: "reminder",
    title: "Upcoming Check-in",
    message: "Don't forget! Your check-in is tomorrow at 2 PM.",
    time: "3 hours ago",
    read: true,
  },
  {
    id: 4,
    type: "system",
    title: "Profile Updated",
    message: "Your account settings have been saved successfully.",
    time: "1 day ago",
    read: true,
  },
]

const notifTypeStyles: Record<string, { bg: string; icon: React.ReactNode }> = {
  booking: { bg: "bg-gray-100", icon: <CalendarDays className="size-4 text-ink" /> },
  promo: { bg: "bg-gray-100", icon: <Tag className="size-4 text-ink" /> },
  reminder: { bg: "bg-gray-100", icon: <Clock className="size-4 text-ink" /> },
  system: { bg: "bg-gray-100", icon: <Settings className="size-4 text-ink" /> },
}

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [notifications, setNotifications] = useState(mockNotifications)

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleSignOut = async () => {
    setIsLoggingOut(true)
    await logout()
    setIsLoggingOut(false)
    setShowLogoutConfirm(false)
    navigate("/login")
  }

  const navItems = !isAuthenticated ? publicNavItems : guestNavItems

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault()
    if (location.pathname === "/") {
      const id = path.slice(1)
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: "smooth" })
      }
      return
    }
    navigate("/" + path)
  }

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-white">
      <div className="flex h-16 md:h-[72px] w-full items-center px-5 md:px-8 gap-lg">
        <Link to="/" className="flex items-center gap-2.5 mr-lg md:mr-xl flex-shrink-0">
          <img src={hotelAvaLogo} alt="Hotel Ava" className="h-10 md:h-12 w-auto mix-blend-multiply" />
          <span className="font-display font-bold text-lg text-ink hidden sm:block">Hotel Ava</span>
        </Link>

        <nav className="hidden md:flex items-center justify-end flex-1 gap-lg">
          {navItems.map((item) =>
            item.path.startsWith("#") ? (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => handleAnchorClick(e, item.path)}
                className="typo-nav-link relative px-xs py-sm text-ink hover:text-primary transition-colors duration-200 group"
              >
                {item.label}
                <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-full" />
              </a>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={item.path === "/" ? handleHomeClick : undefined}
                className={({ isActive }) =>
                  `typo-nav-link relative px-xs py-sm transition-colors duration-200 hover:text-primary group ${
                    isActive ? "text-primary" : "text-ink"
                  }`
                }
              >
                {item.label}
                <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-primary transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:w-full" />
              </NavLink>
            )
          )}
        </nav>

        <div className="flex items-center gap-sm ml-auto">
          {!isAuthenticated ? (
            <Link to="/login">
              <Button variant="default" className="bg-primary text-on-primary hover:bg-primary-active px-5 py-2.5 text-sm">
                Sign In
              </Button>
            </Link>
          ) : (
            <>
              {/* Notification bell */}
              <DropdownMenu>
                <DropdownMenuTrigger className="relative flex size-9 items-center justify-center rounded-full bg-[#f0f1f3] text-[#6b7280] hover:bg-[#e2e4e8] transition-all duration-200 cursor-pointer">
                  <Bell className="size-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center size-4 rounded-full bg-[#A4423A] text-white text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={8} positionMethod="fixed" className="w-80 !rounded-[12px] p-0 overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <span className="text-sm font-semibold text-ink">Notifications</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary hover:text-primary-active cursor-pointer flex items-center gap-1">
                        <CheckCheck className="size-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div className="max-h-80 overflow-y-auto overscroll-contain">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-50 last:border-b-0 ${!notif.read ? "bg-primary/5" : ""}`}
                      >
                        {/* Type icon */}
                        <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${notifTypeStyles[notif.type].bg}`}>
                          {notifTypeStyles[notif.type].icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink truncate">{notif.title}</span>
                            {!notif.read && (
                              <span className="shrink-0 size-2 rounded-full bg-primary" />
                            )}
                          </div>
                          <p className="text-xs text-muted mt-0.5 line-clamp-2">{notif.message}</p>
                          <span className="text-[11px] text-muted-soft mt-1 block">{notif.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-gray-100 px-4 py-2.5">
                    <button className="w-full text-center text-xs text-primary hover:text-primary-active font-medium cursor-pointer">
                      View all notifications
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full bg-[#f0f1f3] pl-1 pr-3 py-1 cursor-pointer hover:bg-[#e2e4e8] transition-all duration-200">
                <Avatar className="size-9">
                  {user?.avatar && <AvatarImage src={user.avatar} />}
                  <AvatarFallback className="bg-[#e8e2d3]">
                    <HotelLogoIcon />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-semibold text-ink leading-tight">{user?.name || "Guest"}</span>
                    <ChevronDown className="size-3.5 text-muted" />
                  </div>
                  <span className="text-[11px] text-muted leading-tight">{user?.email || ""}</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-60 !rounded-[6px]" positionMethod="fixed" style={{ transform: "translateX(-70px)" }}>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} className="flex items-center gap-2.5 cursor-pointer">
                  <User className="size-4 text-muted" />
                  <span className="text-sm">Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/my-bookings")} className="flex items-center gap-2.5 cursor-pointer">
                  <CalendarDays className="size-4 text-muted" />
                  <span className="text-sm">My Bookings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} className="flex items-center gap-2.5 cursor-pointer">
                  <Settings className="size-4 text-muted" />
                  <span className="text-sm">Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowLogoutConfirm(true)} className="flex items-center gap-2.5 cursor-pointer">
                  <LogOut className="size-4 text-muted" />
                  <span className="text-sm">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => !isLoggingOut && setShowLogoutConfirm(false)}>
          <div
            className="bg-white rounded-[16px] shadow-lg p-8 text-center animate-scale-in relative overflow-visible"
            style={{ width: "100%", maxWidth: "360px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X button */}
            <button
              type="button"
              onClick={() => !isLoggingOut && setShowLogoutConfirm(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer z-10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <h2 className="text-lg font-semibold text-ink mb-2 mt-2">Sign Out</h2>
            <p className="text-sm text-muted mb-7">Are you sure you want to sign out? You'll be redirected to the login page.</p>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 text-sm font-medium !rounded-[8px] bg-gray-100 text-ink hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="flex-1 py-2.5 text-sm font-medium !rounded-[8px] bg-primary text-on-primary hover:bg-primary-active cursor-pointer"
              >
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
