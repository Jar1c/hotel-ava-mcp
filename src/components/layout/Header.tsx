import { NavLink, Link } from "react-router-dom"
import { Menu, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import MobileNav from "./MobileNav"
import { useAuth } from "@/contexts/AuthContext"
import { publicNavItems, guestNavItems, adminNavItems } from "@/data/navigation"

export default function Header() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth()

  const navItems = !isAuthenticated ? publicNavItems : isAdmin ? [...guestNavItems, ...adminNavItems] : guestNavItems

  return (
    <header className="sticky top-0 z-50 w-full border-b border-hairline bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 md:h-[72px] w-full items-center px-base" style={{ maxWidth: "var(--container-max)" }}>
        <div className="flex md:hidden items-center">
          <MobileNav />
        </div>

        <Link to="/" className="typo-display-lg text-secondary mr-lg md:mr-xl whitespace-nowrap">
          Hotel Ava
        </Link>

        <nav className="hidden md:flex items-center justify-center flex-1 gap-lg">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `typo-nav-link relative px-xs py-sm transition-colors hover:text-primary ${
                  isActive ? "text-primary after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-primary" : "text-ink"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-sm ml-auto">
          {!isAuthenticated ? (
            <a href="/login" target="_blank" rel="noopener noreferrer">
              <Button variant="default" className="bg-primary text-on-primary hover:bg-primary-active">
                Sign In
              </Button>
            </a>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger>
                <button className="flex items-center gap-2 rounded-full border border-hairline p-1 hover:shadow-dropdown transition-shadow cursor-pointer bg-canvas">
                  <Menu className="h-4 w-4 text-ink" />
                  <Avatar className="size-7">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-primary text-on-primary text-xs">
                      {user?.name?.charAt(0).toUpperCase() || <User className="h-3.5 w-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{user?.name || "Guest"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Link to="/bookings" className="w-full">My Bookings</Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem>
                    <Link to="/admin" className="w-full">Admin Dashboard</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>Log Out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}