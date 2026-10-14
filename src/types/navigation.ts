export interface NavItem {
  label: string
  path: string
  requiresAuth?: boolean
  requiresAdmin?: boolean
  icon?: string
}

export type NavigationGroup = 'public' | 'guest' | 'admin'
