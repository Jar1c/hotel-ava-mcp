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
  { label: "Rooms", path: "/rooms" },
]

export const guestNavItems: NavItem[] = [
  { label: "Home", path: "/" },
  { label: "Rooms", path: "/rooms" },
  { label: "My Bookings", path: "/bookings" },
]

export const adminNavItems: NavItem[] = [
  { label: "Admin Dashboard", path: "/admin" },
]

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Support",
    links: [
      { label: "Help Center", path: "/help" },
      { label: "Cancellation Options", path: "/cancellation" },
      { label: "Safety Information", path: "/safety" },
      { label: "Accessibility", path: "/accessibility" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", path: "/about" },
      { label: "Careers", path: "/careers" },
      { label: "Press", path: "/press" },
      { label: "Blog", path: "/blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", path: "/privacy" },
      { label: "Terms of Service", path: "/terms" },
      { label: "Cookie Policy", path: "/cookies" },
    ],
  },
]