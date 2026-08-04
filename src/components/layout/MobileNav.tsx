import { useState } from "react"
import { NavLink, Link } from "react-router"
import { Menu, X, CalendarDays, User, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import hotelAvaLogo from "@/assets/images/Hotel Ava logo.png"

const userItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "My Bookings", path: "/bookings", icon: CalendarDays },
  { label: "Profile", path: "/profile", icon: User },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/": Home,
  "/bookings": CalendarDays,
  "/profile": User,
}

export default function MobileNav() {
  const [open, setOpen] = useState(false)

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
    setOpen(false)
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
      </Button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-[#e2e4e8] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-5 py-5 flex items-center justify-between">
          <Link to="/" onClick={() => setOpen(false)}>
            <img src={hotelAvaLogo} alt="Hotel Ava" className="h-10 w-auto mix-blend-multiply" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-[6px] hover:bg-[#f5f6f8] transition-colors text-[#6b7280]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-[#e2e4e8]" />

        <nav className="flex flex-col gap-0.5 px-3 mt-4 flex-1">
          {userItems.map((item) => {
            const Icon = iconMap[item.path]
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={item.path === "/" ? handleHomeClick : () => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-[5px] px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                    isActive
                      ? "bg-[#82285f]/10 text-[#82285f]"
                      : "text-[#6b7280] hover:bg-[#f5f6f8] hover:text-[#1a1d26]"
                  )
                }
              >
                {Icon && <Icon className="size-[17px]" />}
                {item.label}
              </NavLink>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
