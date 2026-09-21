import { useState } from "react"
import { NavLink, Link } from "react-router"
import { Menu, X, CalendarDays, User, Home, BedDouble, Info, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/AuthContext"
import hotelAvaLogo from "@/assets/images/Hotel Ava logo.png"

const publicItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Rooms & Suites", path: "/rooms", icon: BedDouble },
  { label: "About", path: "/about", icon: Info },
  { label: "Contact Us", path: "/contact", icon: Phone },
]

const guestItems = [
  { label: "My Bookings", path: "/bookings", icon: CalendarDays },
  { label: "Profile", path: "/profile", icon: User },
]

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "/": Home,
  "/rooms": BedDouble,
  "/about": Info,
  "/contact": Phone,
  "/bookings": CalendarDays,
  "/profile": User,
}

export default function MobileNav() {
  const [open, setOpen] = useState(false)
  const { isAuthenticated } = useAuth()

  const navItems = isAuthenticated ? guestItems : publicItems

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (window.location.pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
    setOpen(false)
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} className="cursor-pointer">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] bg-white dark:bg-surface-soft border-r border-[#e2e4e8] dark:border-hairline/50 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="px-5 py-5 flex items-center justify-between">
          <Link to="/" onClick={() => setOpen(false)}>
            <img src={hotelAvaLogo} alt="Hotel Ava" className="h-10 w-auto mix-blend-multiply dark:mix-blend-normal" />
          </Link>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-[6px] hover:bg-[#f5f6f8] dark:hover:bg-surface-strong transition-colors text-[#6b7280] dark:text-muted cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-[#e2e4e8] dark:bg-hairline/50" />

        <nav className="flex flex-col gap-0.5 px-3 mt-4 flex-1">
          {navItems.map((item) => {
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
                      : "text-[#6b7280] dark:text-muted hover:bg-[#f5f6f8] dark:hover:bg-surface-strong hover:text-[#1a1d26] dark:hover:text-ink"
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
