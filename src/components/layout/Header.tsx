import { NavLink, Link, useLocation, useNavigate } from "react-router"
import { useState } from "react"
import { User, LogOut, Settings, CalendarDays, ChevronDown, Bell } from "lucide-react"
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

export default function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [logoutStage, setLogoutStage] = useState<"idle" | "loading" | "done">("idle")

  const handleSignOut = async () => {
    setLogoutStage("loading")
    await logout()
    setLogoutStage("done")
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
      <div className="max-w-container mx-auto flex h-16 md:h-[72px] w-full items-center px-base">
        <Link to="/" className="mr-lg md:mr-xl flex-shrink-0">
          <img src={hotelAvaLogo} alt="Hotel Ava" className="h-10 md:h-12 w-auto mix-blend-multiply" />
        </Link>

        <nav className="hidden md:flex items-center justify-center flex-1 gap-lg">
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
              <Button variant="default" className="bg-primary text-on-primary hover:bg-primary-active">
                Sign In
              </Button>
            </Link>
          ) : (
            <>
              {/* Notification bell */}
              <button className="relative flex size-9 items-center justify-center rounded-full bg-[#f0f1f3] text-[#6b7280] hover:bg-[#e2e4e8] transition-all duration-200">
                <Bell className="size-[18px]" />
                <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#A4423A]" />
              </button>

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
                <DropdownMenuItem onClick={handleSignOut} className="flex items-center gap-2.5 cursor-pointer">
                  <LogOut className="size-4 text-muted" />
                  <span className="text-sm">Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Sign Out Modal */}
      {logoutStage !== "idle" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 animate-fade-in" onClick={() => setLogoutStage("idle")}>
          <div
            className="bg-white rounded-[12px] shadow-lg p-8 text-center animate-scale-in relative overflow-visible"
            style={{ width: "100%", maxWidth: "360px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X button */}
            <button
              type="button"
              onClick={() => setLogoutStage("idle")}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-gray-100 transition-colors cursor-pointer z-10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {logoutStage === "loading" ? (
              <>
                <div className="mx-auto mb-5 flex items-center justify-center w-14 h-14 rounded-full bg-gray-100">
                  <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" />
                </div>
                <div className="space-y-2.5 flex flex-col items-center">
                  <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-ink mb-2 mt-2">Signed Out</h2>
                <p className="text-sm text-muted mb-7">You have been signed out of your account.</p>
                <Button
                  onClick={() => navigate("/login")}
                  className="w-full py-2.5 text-sm font-medium !rounded-[4px] bg-ink text-white hover:bg-ink/90"
                >
                  Login Again
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
