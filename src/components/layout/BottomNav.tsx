import { NavLink, useLocation, useNavigate } from "react-router"
import { Home, BedDouble, Info, Phone } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Home", path: "/", icon: Home },
  { label: "Rooms", path: "/rooms", icon: BedDouble },
  { label: "About", path: "#about", icon: Info },
  { label: "Contact", path: "#contact", icon: Phone },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (location.pathname === "/") {
      e.preventDefault()
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  // About / Contact are sections on the Home page (same anchors the desktop header uses)
  const handleSectionClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    if (location.pathname === "/") {
      document.getElementById(id.slice(1))?.scrollIntoView({ behavior: "smooth" })
      return
    }
    navigate(`/${id}`)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-surface-soft border-t border-hairline dark:border-hairline/50 md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isSection = item.path.startsWith("#")
          const isActive = isSection
            ? location.hash === item.path
            : location.pathname === item.path
          return (
            <NavLink
              key={item.path}
              to={isSection ? `/${item.path}` : item.path}
              onClick={
                item.path === "/"
                  ? handleHomeClick
                  : isSection
                    ? (e) => handleSectionClick(e, item.path)
                    : undefined
              }
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
