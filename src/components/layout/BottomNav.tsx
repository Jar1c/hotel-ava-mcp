import { NavLink, useLocation } from "react-router"
import { Home, BedDouble, Info, Phone } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Rooms", path: "/rooms", icon: BedDouble },
  { label: "About", path: "/about", icon: Info },
  { label: "Contact", path: "/contact", icon: Phone },
]

export default function BottomNav() {
  const location = useLocation()

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-surface-soft border-t border-hairline dark:border-hairline/50 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={item.path === "/" ? handleHomeClick : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 w-full h-full min-w-0 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted"
              )}
            >
              <item.icon
                className={cn(
                  "h-5 w-5 transition-all duration-200",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[10px] leading-tight transition-all duration-200",
                  isActive ? "font-semibold" : "font-medium"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
