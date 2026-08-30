import { NavLink } from "react-router"
import { LayoutDashboard, Calendar, DoorOpen, Users, CalendarDays, BarChart3, LogOut, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import { useNavigate } from "react-router"

const mainItems = [
  { label: "Dashboard", path: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Bookings", path: "/admin/bookings", icon: Calendar },
  { label: "Rooms", path: "/admin/rooms", icon: DoorOpen },
  { label: "Guests", path: "/admin/guests", icon: Users },
  { label: "Calendar", path: "/admin/calendar", icon: CalendarDays },
]

const otherItems = [
  { label: "Analytics", path: "/admin/analytics", icon: BarChart3 },
  { label: "Settings", path: "/admin/settings", icon: Settings },
]

export default function AdminSidebar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate("/admin")
  }

  return (
    <aside className="w-60 flex-shrink-0 bg-white border-r border-[#e2e4e8] flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-[6px] bg-[#82285f]">
            <span className="text-[#FBF9F4] text-xs font-bold font-display">HA</span>
          </div>
          <span className="text-[15px] font-bold text-[#1a1d26] font-display tracking-tight">Hotel Ava</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-3 mt-1">
        {mainItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "bg-[#82285f] text-white"
                  : "text-[#6b7280] hover:bg-[#f5f6f8] hover:text-[#1a1d26]"
              )
            }
          >
            <item.icon className="size-[17px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Divider + Other section */}
      <div className="px-3 mt-6">
        <p className="px-3 mb-1.5 text-[10px] font-semibold text-[#b0b3b8] uppercase tracking-wider">Other</p>
        {otherItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                isActive
                  ? "bg-[#82285f] text-white"
                  : "text-[#6b7280] hover:bg-[#f5f6f8] hover:text-[#1a1d26]"
              )
            }
          >
            <item.icon className="size-[17px]" />
            {item.label}
          </NavLink>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      <div className="px-3 pb-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-[5px] px-3 py-2.5 text-[13px] font-medium text-[#A4423A] hover:bg-[#A4423A]/5 transition-all duration-200"
        >
          <LogOut className="size-[17px]" />
          Log Out
        </button>
      </div>
    </aside>
  )
}
