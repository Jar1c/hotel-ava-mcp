import { useState, useRef, useEffect } from "react"
import { Outlet } from "react-router"
import { Search, Bell, Calendar, DoorOpen, Users, Hash } from "lucide-react"
import AdminSidebar from "@/components/admin/AdminSidebar"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { HotelLogoIcon } from "@/components/ui/avatar"

const searchSuggestions = [
  { icon: <Calendar className="w-4 h-4" />, label: "Bookings", description: "Search by guest name or booking ID", category: "bookings" },
  { icon: <DoorOpen className="w-4 h-4" />, label: "Rooms", description: "Search by room number or type", category: "rooms" },
  { icon: <Users className="w-4 h-4" />, label: "Guests", description: "Search by guest email or name", category: "guests" },
  { icon: <Hash className="w-4 h-4" />, label: "Booking ID", description: "e.g. BK-001, BK-002", category: "bookings" },
]

export default function Admin() {
  const { user } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredSuggestions = searchQuery
    ? searchSuggestions.filter(
        (s) =>
          s.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchSuggestions

  return (
    <div className="flex h-screen bg-[#f0f1f3] overflow-hidden">
      <AdminSidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between h-[60px] bg-white px-6 flex-shrink-0 border-b border-[#e2e4e8]">
          {/* Smart Search */}
          <div ref={searchRef} className="relative w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#9ca3af] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search bookings, rooms, guests..."
                className="w-full rounded-[5px] border border-[#e2e4e8] bg-[#f5f6f8] py-2 pl-9 pr-4 text-sm text-[#1a1d26] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#82285f]/15 focus:border-[#82285f] transition-all"
              />
            </div>

            {/* Dropdown */}
            {showDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e4e8] rounded-[6px] shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-[#e2e4e8]">
                  <p className="text-[10px] font-semibold text-[#b0b3b8] uppercase tracking-wider">
                    {searchQuery ? "Results" : "Quick Search"}
                  </p>
                </div>
                <div className="max-h-[280px] overflow-y-auto">
                  {filteredSuggestions.length > 0 ? (
                    filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.label}
                        onClick={() => {
                          setSearchQuery("")
                          setShowDropdown(false)
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#f5f6f8] transition-colors duration-150 text-left"
                      >
                        <div className="flex items-center justify-center size-8 rounded-[5px] bg-[#f0f1f3] text-[#6b7280]">
                          {suggestion.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1a1d26] truncate">{suggestion.label}</p>
                          <p className="text-[11px] text-[#9ca3af] truncate">{suggestion.description}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-6 text-center">
                      <p className="text-sm text-[#9ca3af]">No results found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            {/* Notification bell */}
            <button className="relative flex size-9 items-center justify-center rounded-[5px] text-[#6b7280] hover:bg-[#f5f6f8] transition-colors">
              <Bell className="size-[18px]" />
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[#A4423A]" />
            </button>

            {/* User */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#1a1d26] leading-tight">{user?.name || "Admin"}</p>
                <p className="text-[11px] text-[#9ca3af]">{user?.email || "admin@hotelava.com"}</p>
              </div>
              <Avatar className="size-9">
                {user?.avatar && <AvatarImage src={user.avatar} />}
                <AvatarFallback className="bg-[#e8e2d3]">
                  <HotelLogoIcon />
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
