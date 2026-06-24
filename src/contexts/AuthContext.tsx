import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

export type UserRole = "public" | "guest" | "admin"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
}

interface AuthContextValue {
  user: User | null
  role: UserRole
  isAuthenticated: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  setRole: (role: UserRole) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const role: UserRole = user?.role ?? "public"
  const isAuthenticated = user !== null
  const isAdmin = user?.role === "admin"

  const login = useCallback(async (_email: string, _password: string) => {
    const mockRole: UserRole = _email.startsWith("admin") ? "admin" : "guest"
    setUser({
      id: "mock-1",
      name: _email.split("@")[0],
      email: _email,
      role: mockRole,
    })
  }, [])

  const logout = useCallback(() => {
    setUser(null)
  }, [])

  const setRole = useCallback(
    (newRole: UserRole) => {
      if (!user) {
        setUser({ id: "mock-1", name: "Guest", email: "guest@hotelava.com", role: newRole })
        return
      }
      setUser({ ...user, role: newRole })
    },
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, isAdmin, login, logout, setRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}