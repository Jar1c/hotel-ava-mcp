import { NavLink } from "react-router-dom"
import { Menu } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { publicNavItems, guestNavItems, adminNavItems } from "@/data/navigation"

export default function MobileNav() {
  const { isAuthenticated, isAdmin, logout } = useAuth()

  const items = !isAuthenticated ? publicNavItems : isAdmin ? [...guestNavItems, ...adminNavItems] : guestNavItems

  return (
    <Sheet>
      <SheetTrigger>
        <Button variant="ghost" size="icon-sm" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px]">
        <nav className="flex flex-col gap-4 mt-lg">
          {items.map((item) => (
            <SheetClose key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `typo-nav-link px-base py-sm rounded-sm transition-colors hover:bg-surface-soft ${
                    isActive ? "text-primary" : "text-ink"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </SheetClose>
          ))}
          {!isAuthenticated && (
            <SheetClose>
              <NavLink to="/login">
                <Button className="w-full mt-md">Sign In</Button>
              </NavLink>
            </SheetClose>
          )}
          {isAuthenticated && (
            <SheetClose>
              <Button variant="secondary" onClick={logout} className="w-full mt-md">
                Log Out
              </Button>
            </SheetClose>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}