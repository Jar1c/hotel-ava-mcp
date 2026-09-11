import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { authApi } from "@/services/api"

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
  login: (email: string, password: string, name?: string) => Promise<User | undefined>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  setRole: (role: UserRole) => void
  updateUser: (fields: Partial<Pick<User, "name" | "avatar">>) => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem("auth_user")
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(() => {
    const hasToken = !!sessionStorage.getItem("access_token")
    const hasCachedUser = !!localStorage.getItem("auth_user")
    // Token but no cached user → need to verify before showing anything
    return hasToken && !hasCachedUser
  })
  const verifyRef = useRef(0)

  useEffect(() => {
    const token = sessionStorage.getItem("access_token")
    if (!token) {
      setLoading(false)
      return
    }

    const callId = ++verifyRef.current

    // Background verify — don't block UI, show cached data immediately
    authApi.getProfile()
      .then((profile) => {
        if (callId !== verifyRef.current) return // stale call — ignore
        const userObj: User = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: (profile.role || "guest") as UserRole,
          avatar: profile.avatar_url || "",
        }
        setUser(userObj)
        localStorage.setItem("auth_user", JSON.stringify(userObj))
      })
      .catch((err) => {
        if (callId !== verifyRef.current) return // stale call — ignore
        // Only clear tokens on 401 (actual auth failure)
        // Network errors, timeouts, race conditions should NOT log the user out
        const is401 = err?.message?.includes("401") || err?.message?.includes("Unauthorized")
        if (is401) {
          sessionStorage.removeItem("access_token")
          sessionStorage.removeItem("refresh_token")
          localStorage.removeItem("auth_user")
          setUser(null)
        }
        // Non-401 errors: keep cached data, user stays logged in
      })
      .finally(() => {
        if (callId !== verifyRef.current) return
        setLoading(false)
      })
  }, [])

  // Cross-tab auth sync: detect when another tab logs in/out
  // REMOVED: storage event listener was syncing auth across tabs
  // Instead, we use sessionStorage for tokens so each tab has its own session

  const role: UserRole = user?.role ?? "public"
  const isAuthenticated = user !== null
  const isAdmin = user?.role === "admin"

  const login = useCallback(async (email: string, password: string, _name?: string) => {
    const res = await authApi.login({ email, password })

    sessionStorage.setItem("access_token", res.access_token)
    sessionStorage.setItem("refresh_token", res.refresh_token)

    const userObj: User = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: (res.user.role || "guest") as UserRole,
      avatar: res.user.avatar_url || "",
    }
    setUser(userObj)
    localStorage.setItem("auth_user", JSON.stringify(userObj))
    setLoading(false)
    return userObj
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    try {
      await authApi.register({ email, password, name })
    } catch (err: any) {
      const msg = err.message || "Registration failed"
      if (msg.includes("already registered")) {
        throw new Error("An account with this email already exists. Please sign in instead.")
      }
      if (msg.includes("rate limit")) {
        throw new Error("Too many attempts. Please wait a moment and try again.")
      }
      throw new Error(msg)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    sessionStorage.removeItem("access_token")
    sessionStorage.removeItem("refresh_token")
    localStorage.removeItem("auth_user")
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

  const updateUser = useCallback(
    (fields: Partial<Pick<User, "name" | "avatar">>) => {
      if (!user) return
      setUser({ ...user, ...fields })
    },
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, isAdmin, login, register, logout, setRole, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
