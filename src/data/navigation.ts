export interface FooterLinkGroup {
  title: string
  links: { label: string; path: string }[]
}

export interface NavItem {
  label: string
  path: string
  requiresAuth?: boolean
  requiresAdmin?: boolean
  icon?: string
}

export type NavigationGroup = "public" | "guest" | "admin"

export const publicNavItems: NavItem[] = [
  { label: "Home", path: "/" },
  { label: "Rooms & Suites", path: "/rooms" },
  { label: "About", path: "#about" },
  { label: "Contact Us", path: "#contact" },
]

export const guestNavItems: NavItem[] = [
  { label: "Home", path: "/" },
  { label: "Rooms & Suites", path: "/rooms" },
  { label: "About", path: "#about" },
  { label: "Contact Us", path: "#contact" },
]

export const adminNavItems: NavItem[] = [
  { label: "Dashboard", path: "/admin/dashboard" },
  { label: "Bookings", path: "/admin/bookings" },
  { label: "Rooms", path: "/admin/rooms" },
]

export const footerLinkGroups: FooterLinkGroup[] = [
  // NOTE: The "Accommodation" group is rendered dynamically in Footer.tsx —
  // its links are built from the live room list (/api/rooms/public), not
  // hardcoded, so they always point at real room pages.
  {
    title: "Quick Links",
    links: [
      { label: "Home", path: "/" },
      { label: "Rooms & Suites", path: "/rooms" },
      { label: "About Us", path: "/#about" },
      { label: "Contact Us", path: "/#contact" },
    ],
  },
  {
    title: "Policies",
    links: [
      { label: "Terms & Conditions", path: "/terms" },
      { label: "Privacy Policy", path: "/privacy" },
      { label: "Data Privacy", path: "/privacy" },
      { label: "Hotel Policies", path: "/terms" },
    ],
  },
]