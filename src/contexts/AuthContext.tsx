import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { authApi } from "@/services/api"
import { supabase } from "@/lib/supabase"

export type UserRole = "public" | "guest" | "admin"

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar?: string
  name_changed_at?: string
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
  updateUser: (fields: Partial<Pick<User, "name" | "avatar" | "name_changed_at">>) => void
  loading: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/** Decode JWT payload (no verification — used for instant UI only) */
function decodeJwt(token: string): Record<string, any> | null {
  try {
    return JSON.parse(atob(token.split(".")[1]))
  } catch {
    return null
  }
}

/** Build a User object from a Supabase JWT payload */
function userFromJwt(payload: Record<string, any>): User {
  const email = payload.email || ""
  return {
    id: payload.sub || "",
    email,
    name: payload.name || payload.full_name || email.split("@")[0] || "Guest",
    role: "guest",
    avatar: payload.avatar_url || payload.picture || "",
    name_changed_at: "",
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem("auth_user")
      return cached ? JSON.parse(cached) : null
    } catch { return null }
  })
  const [loading, setLoading] = useState(true)
  const verifyRef = useRef(0)

  // Sync Supabase session → sessionStorage (for Flask backend)
  const syncSupabaseSession = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        sessionStorage.setItem("access_token", session.access_token)
        sessionStorage.setItem("refresh_token", session.refresh_token || "")
        return session.access_token
      }
    } catch {
      // ignore
    }
    return sessionStorage.getItem("access_token")
  }, [])

  /**
   * Fetch profile from backend, but MERGE with Google OAuth metadata
   * so that Google name/avatar are never lost.
   */
  const verifySession = useCallback(async () => {
    const callId = ++verifyRef.current
    try {
      const profile = await authApi.getProfile()
      if (callId !== verifyRef.current) return

      // Get Google metadata from Supabase (always available for OAuth users)
      let googleName = ""
      let googleAvatar = ""
      try {
        const { data: { user: sbUser } } = await supabase.auth.getUser()
        if (sbUser?.app_metadata?.providers?.includes("google")) {
          const meta = sbUser.user_metadata || {}
          googleName = meta.full_name || meta.name || ""
          googleAvatar = meta.picture || meta.avatar_url || ""
        }
      } catch { /* ignore */ }

      // For Google users: only use Google avatar as DEFAULT (when DB is empty).
      // If user has manually selected an avatar, respect their choice.
      const isGoogleUser = !!googleAvatar
      const name = isGoogleUser && googleName ? googleName : (profile.name || "")
      const avatar = (profile.avatar_url || "") || (isGoogleUser ? googleAvatar : "")
      console.log("[auth] verifySession:", { isGoogleUser, name, avatar: avatar?.substring(0, 60), dbAvatar: profile.avatar_url?.substring(0, 60) })

      // Only persist Google data to DB if DB is empty (first-time setup)
      if (isGoogleUser) {
        const updates: Record<string, string> = {}
        if (!profile.avatar_url && googleAvatar) updates.avatar_url = googleAvatar
        if (!profile.name && googleName) updates.name = googleName
        if (Object.keys(updates).length > 0) {
          authApi.updateProfile(updates).catch(() => {})
        }
      }

      const userObj: User = {
        id: profile.id,
        email: profile.email,
        name,
        role: (profile.role || "guest") as UserRole,
        avatar,
        name_changed_at: profile.name_changed_at || "",
      }
      setUser(userObj)
      localStorage.setItem("auth_user", JSON.stringify(userObj))
    } catch (err: any) {
      if (callId !== verifyRef.current) return
      const is401 = err?.message?.includes("401") || err?.message?.includes("Unauthorized")
      if (is401) {
        sessionStorage.removeItem("access_token")
        sessionStorage.removeItem("refresh_token")
        localStorage.removeItem("auth_user")
        setUser(null)
      }
    } finally {
      if (callId !== verifyRef.current) return
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Listen for Supabase auth state changes (covers Google OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.access_token) {
        // Copy token to sessionStorage for Flask backend
        sessionStorage.setItem("access_token", session.access_token)
        sessionStorage.setItem("refresh_token", session.refresh_token || "")

        // Check if we have a cached user with a valid name (not just email prefix)
        const cached = localStorage.getItem("auth_user")
        let cachedUser: User | null = null
        try { cachedUser = cached ? JSON.parse(cached) : null } catch { /* ignore */ }
        const hasValidCachedName = cachedUser?.name && !cachedUser.name.includes("@")

        if (hasValidCachedName) {
          // Already have a good cached user (reload or new tab) — use it
          setUser(cachedUser!)
          setLoading(false)
          if (event === "INITIAL_SESSION") {
            verifySession()
          }
        } else {
          // Fresh sign-in or no valid cache — use JWT for instant data
          const payload = decodeJwt(session.access_token)
          if (payload) {
            const instantUser = userFromJwt(payload)
            setUser(instantUser)
            localStorage.setItem("auth_user", JSON.stringify(instantUser))
          }
          setLoading(false)
          verifySession()
        }
      } else if (event === "SIGNED_OUT") {
        sessionStorage.removeItem("access_token")
        sessionStorage.removeItem("refresh_token")
        localStorage.removeItem("auth_user")
        setUser(null)
        setLoading(false)
      }
    })

    // On mount: check existing session
    syncSupabaseSession().then(() => {
      if (!mounted) return
      const token = sessionStorage.getItem("access_token")
      if (token) {
        if (user) {
          // Have cached user — show immediately, no loading spinner
          setLoading(false)
        }
        // Fetch backend profile to sync role (but Google name/avatar are preserved)
        verifySession()
      } else {
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [syncSupabaseSession, verifySession])

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
      name_changed_at: res.user.name_changed_at || "",
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
    // Clear Supabase session (prevents auto-login on reload)
    try {
      await supabase.auth.signOut()
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
    (fields: Partial<Pick<User, "name" | "avatar" | "name_changed_at">>) => {
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
