import { Link, useLocation, useNavigate } from "react-router"
import { LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { useNotifications } from "@/contexts/NotificationContext"
import hotelAvaLogo from "@/assets/images/Hotel Ava logo.png"

const mainItems = [
  { label: "Dashboard", path: "/admin/dashboard" },
  { label: "Bookings", path: "/admin/bookings" },
  { label: "Rooms", path: "/admin/rooms" },
  { label: "Guests", path: "/admin/guests" },
  { label: "Calendar", path: "/admin/calendar" },
  { label: "Reviews", path: "/admin/reviews" },
  { label: "AI Assistant", path: "/admin/ai" },
]

const otherItems = [
  { label: "Settings", path: "/admin/settings" },
]

/** Red "new bookings" pill — 9 and up reads as 9+. */
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#A4423A] px-1.5 text-[10px] font-bold leading-none text-white tabular-nums">
      {count >= 9 ? "9+" : count}
    </span>
  )
}

const navItemClass =
  "flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50 focus-visible:ring-offset-1"

export default function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth()
  const { unreadBookingCount } = useNotifications()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate("/admin")
  }

  const itemActive = (item: { path: string }) => {
    const basePath = item.path.split("?")[0]
    return location.pathname === basePath || location.pathname.startsWith(`${basePath}/`)
  }

  const renderItems = (items: { label: string; path: string }[], withBadge = false) =>
    items.map((item) => {
      const active = itemActive(item)
      return (
        <Link
          key={item.path}
          to={item.path}
          onClick={onNavigate}
          className={cn(
            navItemClass,
            // Active = full maroon block + white text — unmistakable selection.
            active
              ? "bg-[#82285f] text-white"
              : "text-[#6b7280] hover:bg-[#f5f6f8] hover:text-[#1a1d26]",
          )}
        >
          {item.label}
          {withBadge && item.label === "Bookings" && <CountBadge count={unreadBookingCount} />}
        </Link>
      )
    })

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-[#e2e4e8] flex flex-col sticky top-0 h-[calc(100vh-var(--capstone-h,0px))]">
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src={hotelAvaLogo} alt="" className="size-8" />
          <span className="text-[15px] font-bold text-[#1a1d26] font-display tracking-tight">Hotel Ava</span>
        </div>
      </div>

      {/* Main nav — text-only */}
      <nav className="flex flex-col gap-0.5 px-3 mt-1">
        {renderItems(mainItems, true)}
      </nav>

      {/* Divider + Other section */}
      <div className="px-3 mt-6">
        <p className="px-3 mb-1.5 text-[13px] font-medium text-[#9ca3af]">Other</p>
        {renderItems(otherItems)}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      <div className="px-3 pb-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[5px] px-3 py-2.5 text-[13px] font-medium text-[#A4423A] hover:bg-[#A4423A]/5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82285f]/50 focus-visible:ring-offset-1"
        >
          <LogOut className="size-[17px]" />
          Log Out
        </button>
      </div>
    </aside>
  )
}
