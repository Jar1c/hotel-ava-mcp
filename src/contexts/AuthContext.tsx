import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react"
import { authApi, syncSessionHashes, type LoginChallenge, type LoginResponse, type TrackLoginResult } from "@/services/api"
import { supabase } from "@/lib/supabase"
import LoginChallengeDialog from "@/components/auth/LoginChallengeDialog"

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
  /** Clear local auth state without touching the server. */
  clearSession: () => void
  /** True exactly once after a logout started from THIS device (consumes the flag). */
  consumeLogoutSuppress: () => boolean
  /** Pending step-up verification (unfamiliar device/location) — drives the dialog. */
  pendingChallenge: LoginChallenge | null
  setChallenge: (challenge: LoginChallenge | null) => void
  /** Finish a sign-in verified server-side (OTP step-up / quick sign-in). */
  completeSession: (res: LoginResponse) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const PROFILE_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/** Real display name — reject empty, emails, and the "Guest" placeholder */
function isUsableName(name?: string | null): boolean {
  const n = (name || "").trim()
  if (!n || n.includes("@")) return false
  if (n.toLowerCase() === "guest") return false
  return true
}

function emailLocalPart(email?: string | null): string {
  return (email || "").split("@")[0].trim()
}

/** Enough to render header identity (real name OR any email) */
function hasDisplayIdentity(u?: { name?: string; email?: string } | null): boolean {
  if (!u) return false
  return isUsableName(u.name) || !!(u.email || "").trim()
}

function readCachedUser(): User | null {
  try {
    const cached = localStorage.getItem("auth_user")
    if (!cached) return null
    const parsed = JSON.parse(cached)
    if (!hasDisplayIdentity(parsed)) return null
    const { timestamp: _ts, ...userFields } = parsed
    return userFields as User
  } catch { return null }
}

function getCachedProfile(): { user: User; timestamp: number } | null {
  try {
    const raw = localStorage.getItem("auth_user")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!hasDisplayIdentity(parsed)) return null
    const { timestamp, ...userFields } = parsed
    return { user: userFields as User, timestamp: timestamp || 0 }
  } catch { return null }
}

function setCachedProfile(user: User) {
  // Persist any renderable identity — never a fully empty/Guest-only user
  if (!hasDisplayIdentity(user)) return
  localStorage.setItem("auth_user", JSON.stringify({ ...user, timestamp: Date.now() }))
}

/**
 * Build a display-ready User from the Supabase session (client-side only).
 * Prefer system name from localStorage cache path (caller); this is only for
 * the brief moment before /auth/profile returns. Role defaults to "guest";
 * verifySession upgrades it (e.g. admin) in background.
 * Name priority after profile load: profile.name (system) > Google > email.
 */
function userFromSession(sbUser: {
  id: string
  email?: string | null
  user_metadata?: Record<string, any>
  app_metadata?: Record<string, any>
}): User {
  const meta = sbUser.user_metadata || {}
  const appMeta = sbUser.app_metadata || {}
  const email = sbUser.email || ""
  // Prefer system/user_metadata name, then Google full_name, then email local —
  // name may stay "" when there's no email either; callers use hasDisplayIdentity.
  const name =
    (meta.name || "").trim() ||
    (meta.full_name || "").trim() ||
    emailLocalPart(email)
  const role: UserRole =
    appMeta.role === "admin" || appMeta.claims?.role === "admin" ? "admin" : "guest"
  return {
    id: sbUser.id,
    email,
    name: isUsableName(name) ? name : "",
    role,
    avatar: meta.picture || meta.avatar_url || "",
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Hydrate from localStorage synchronously — if we already have a renderable
  // identity, start with loading=false so the header never re-skeletons.
  const initialCached = readCachedUser()
  const [user, setUserState] = useState<User | null>(() => initialCached ?? null)
  const [loading, setLoading] = useState(!hasDisplayIdentity(initialCached))
  const verifyRef = useRef(0)
  // Live user snapshot — updated synchronously in applyUser (not in an effect)
  const userRef = useRef<User | null>(initialCached ?? null)
  // Set while a logout started from THIS device so the remote-logout
  // awareness listener never shows a dialog for the user's own sign-out.
  const logoutSuppressRef = useRef(false)

  // Step-up verification for unfamiliar device/location logins — persisted so
  // a reload while waiting for the email still shows the code screen.
  const [pendingChallenge, setPendingChallenge] = useState<LoginChallenge | null>(() => {
    try {
      const raw = localStorage.getItem("pending_login_challenge")
      return raw ? (JSON.parse(raw) as LoginChallenge) : null
    } catch {
      return null
    }
  })

  const setChallenge = useCallback((challenge: LoginChallenge | null) => {
    try {
      if (challenge) localStorage.setItem("pending_login_challenge", JSON.stringify(challenge))
      else localStorage.removeItem("pending_login_challenge")
    } catch {
      /* ignore */
    }
    setPendingChallenge(challenge)
  }, [])

  /** Single writer for user state — keeps userRef in sync immediately.
   *  Treat undefined as null so a bad call can never leave a phantom
   *  authenticated user (undefined !== null → isAuthenticated stuck true). */
  const applyUser = useCallback((next: User | null | undefined) => {
    const value = next ?? null
    userRef.current = value
    setUserState(value)
  }, [])

  /**
   * Merge a fetched profile into the current user WITHOUT wiping good fields.
   * Old bug: empty profile.name/email/avatar_url replaced a good user → header "…".
   */
  const mergeIdentity = useCallback((incoming: Partial<User> & { id?: string }, prev: User | null): User | null => {
    const baseId = incoming.id || prev?.id || ""
    if (!baseId && !prev) return null

    const email = (incoming.email || "").trim() || (prev?.email || "").trim()
    const rawName = (incoming.name || "").trim()
    const name =
      (isUsableName(rawName) ? rawName : "") ||
      (isUsableName(prev?.name) ? prev!.name : "") ||
      emailLocalPart(email)
    const avatar = (incoming.avatar || "").trim() || (prev?.avatar || "").trim() || ""
    const role = (incoming.role || prev?.role || "guest") as UserRole

    const merged: User = {
      id: baseId || prev?.id || "",
      email,
      // Keep "" rather than invent "Guest" — Header uses email / "Account"
      name: isUsableName(name) ? name : "",
      role,
      avatar,
      name_changed_at: incoming.name_changed_at ?? prev?.name_changed_at ?? "",
    }

    // Never replace a renderable user with an empty one (the "…" bug)
    if (!hasDisplayIdentity(merged) && hasDisplayIdentity(prev)) return prev
    return merged
  }, [])

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
   * so that Google name/avatar are never lost. Never downgrades identity.
   */
  const verifySession = useCallback(async (sessionUser?: { id?: string; email?: string | null; user_metadata?: Record<string, string>; app_metadata?: Record<string, any> }) => {
    const callId = ++verifyRef.current
    try {
      const profile = await authApi.getProfile()
      if (callId !== verifyRef.current) return

      // Get Google metadata — use passed sessionUser (from onAuthStateChange) or fetch
      let googleName = ""
      let googleAvatar = ""
      if (sessionUser?.app_metadata?.providers?.includes("google")) {
        const meta = sessionUser.user_metadata || {}
        googleName = meta.full_name || meta.name || ""
        googleAvatar = meta.picture || meta.avatar_url || ""
      } else {
        try {
          const { data: { user: sbUser } } = await supabase.auth.getUser()
          if (sbUser?.app_metadata?.providers?.includes("google")) {
            const meta = sbUser.user_metadata || {}
            googleName = meta.full_name || meta.name || ""
            googleAvatar = meta.picture || meta.avatar_url || ""
          }
        } catch { /* ignore */ }
      }

      const isGoogleUser = !!googleName || !!googleAvatar
      const prev = userRef.current
      const email = (profile.email || "").trim() || (sessionUser?.email || "").trim() || (prev?.email || "").trim()
      const nameCandidate =
        (profile.name || "").trim() ||
        (googleName || "").trim() ||
        (isUsableName(prev?.name) ? prev!.name : "") ||
        emailLocalPart(email)

      const userObj: User = {
        id: profile.id || prev?.id || "",
        email,
        name: isUsableName(nameCandidate) ? nameCandidate : "",
        role: (profile.role || prev?.role || "guest") as UserRole,
        avatar: (profile.avatar_url || "").trim() || (isGoogleUser ? googleAvatar : "") || (prev?.avatar || ""),
        name_changed_at: profile.name_changed_at || prev?.name_changed_at || "",
      }

      // NEVER apply an identity-less user over a good one (header "…" regression)
      const next = hasDisplayIdentity(userObj)
        ? userObj
        : (hasDisplayIdentity(prev) ? prev : null)
      if (next) {
        applyUser(next)
        setCachedProfile(next)
      } else if (!prev) {
        applyUser(null)
      }
      setLoading(false)

      // Only persist Google data to DB if DB is empty (first-time setup)
      if (isGoogleUser) {
        const updates: Record<string, string> = {}
        if (!profile.avatar_url && googleAvatar) updates.avatar_url = googleAvatar
        if (!profile.name && googleName) updates.name = googleName
        if (Object.keys(updates).length > 0) {
          authApi.updateProfile(updates).catch(() => {})
        }
        if (profile.name && googleName && profile.name !== googleName) {
          supabase.auth
            .updateUser({ data: { name: profile.name, full_name: profile.name } })
            .catch(() => {})
        }
      }
    } catch (err: any) {
      if (callId !== verifyRef.current) return
      const is401 = err?.message?.includes("401") || err?.message?.includes("Unauthorized")
      if (is401) {
        // Hard logout only when backend rejects the token
        sessionStorage.removeItem("access_token")
        sessionStorage.removeItem("refresh_token")
        localStorage.removeItem("auth_user")
        applyUser(null)
      } else {
        // Profile endpoint failed — fall back to Supabase session + cached identity
        try {
          const { data: { user: sbUser } } = await supabase.auth.getUser()
          if (callId !== verifyRef.current) return
          const prev = userRef.current
          if (sbUser) {
            const meta = sbUser.user_metadata || {}
            const fbName =
              (meta.name || "").trim() ||
              (meta.full_name || "").trim() ||
              emailLocalPart(sbUser.email) ||
              (isUsableName(prev?.name) ? prev!.name : "")
            const fallbackUser: User = {
              id: sbUser.id,
              email: (sbUser.email || "").trim() || (prev?.email || ""),
              name: isUsableName(fbName) ? fbName : "",
              role: prev?.role || "guest",
              avatar: meta.picture || meta.avatar_url || prev?.avatar || "",
            }
            const next = hasDisplayIdentity(fallbackUser)
              ? fallbackUser
              : (hasDisplayIdentity(prev) ? prev : null)
            if (next) {
              applyUser(next)
              setCachedProfile(next)
            }
          }
        } catch { /* no Supabase session either — keep whatever we have */ }
      }
    } finally {
      if (callId !== verifyRef.current) return
      setLoading(false)
    }
  }, [applyUser])

  useEffect(() => {
    let mounted = true

    // Listen for Supabase auth state changes (covers Google OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      // Mirror on EVERY event that carries a session — including
      // TOKEN_REFRESHED. Skipping that event left a rotated pair stale in
      // sessionStorage; the next API 401 then refreshed with a spent token,
      // GoTrue revoked the family, and the user was signed out mid-session.
      if (session?.access_token) {
        sessionStorage.setItem("access_token", session.access_token)
        sessionStorage.setItem("refresh_token", session.refresh_token || "")
        // Re-check revocation after a client-side rotation: the server-side
        // fast check is hash-based, so a rotated token would slip past it and
        // resurrect a session that was revoked on another device. The sync
        // matches this device's row instead (and refreshes its hashes).
        if (event === "TOKEN_REFRESHED") {
          void syncSessionHashes(session.access_token, session.refresh_token || "")
        }
      }

      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.access_token) {

        // Track new-device logins for OAuth/Google sign-ins (password logins
        // are tracked server-side in /api/auth/login; backend dedups by device).
        // INITIAL_SESSION is intentionally skipped — a restored session is not a login.
        if (event === "SIGNED_IN") {
          logoutSuppressRef.current = false
          // Step-up gate: unfamiliar device/location → tear down this fresh
          // session and ask for the emailed code. Plain fetch only (calling a
          // supabase auth method inside this callback can deadlock the client);
          // signOut is deferred out of the callback for the same reason.
          let gate: TrackLoginResult | null = null
          try {
            gate = await authApi.trackLogin()
          } catch {
            gate = null
          }
          if (gate?.verification_required && gate.challenge_id) {
            sessionStorage.removeItem("access_token")
            sessionStorage.removeItem("refresh_token")
            setChallenge({
              challenge: "otp",
              challenge_id: gate.challenge_id,
              email_masked: gate.email_masked || "",
              reason: gate.reason || "",
            })
            setTimeout(() => {
              // LOCAL scope: this teardown must only kill the session created
              // for this attempt. The default global scope revoked every
              // session of the user — a new-device check on one browser
              // signed out ALL their other devices.
              supabase.auth.signOut({ scope: "local" }).catch(() => {})
            }, 0)
            return
          }
        }

        // Check if we have a cached user with a valid identity (name or email)
        const cachedProfile = getCachedProfile()

        if (cachedProfile?.user) {
          // Show cached user immediately — no loading spinner
          applyUser(cachedProfile.user)
          setLoading(false)
          // Always re-verify on reload so a bad/placeholder name can't stick for 5 min
          verifySession(session.user)
        } else {
          // No usable cache — show session user if name/email is real, else keep
          // loading=true (header skeleton) until verifySession fills the identity.
          const fromSession = userFromSession(session.user)
          if (hasDisplayIdentity(fromSession)) {
            applyUser(fromSession)
            setLoading(false)
          }
          verifySession(session.user)
        }
      } else if (event === "SIGNED_OUT") {
        // Only hard-logout when Supabase explicitly signs out — not when a
        // transient INITIAL_SESSION comes back empty (that wiped the user → "Guest")
        sessionStorage.removeItem("access_token")
        sessionStorage.removeItem("refresh_token")
        localStorage.removeItem("auth_user")
        applyUser(null)
        setLoading(false)
      }
    })

    // On mount: restore from Supabase first (localStorage session survives tab close).
    // sessionStorage alone is per-tab — leaving the site emptied it and left a
    // half-logged-in user (empty name → header "Guest").
    syncSupabaseSession().then(async (token) => {
      if (!mounted) return

      // Revocation gate BEFORE restoring: ask the backend about this device's
      // session row. It matches by device (not by token hash), so it catches
      // "logged out from another device" even after the token rotated — the
      // case that used to auto sign-in the user again on every reload.
      if (token) {
        const ok = await syncSessionHashes(token, sessionStorage.getItem("refresh_token") || "")
        if (!mounted) return
        if (!ok) {
          // Revoked elsewhere — kill the browser session too so this tab can
          // never rehydrate it. (The revoked event already fired the modal.)
          supabase.auth.signOut({ scope: "local" }).catch(() => {})
          sessionStorage.removeItem("access_token")
          sessionStorage.removeItem("refresh_token")
          localStorage.removeItem("auth_user")
          applyUser(null)
          setLoading(false)
          return
        }
      }

      const hasSbSession = !!sessionStorage.getItem("access_token")
      const cachedProfile = getCachedProfile()

      const restoreFromCache = () => {
        if (!cachedProfile?.user) return false
        applyUser(cachedProfile.user)
        setLoading(false)
        return true
      }

      if (hasSbSession) {
        if (restoreFromCache()) {
          const cacheAge = Date.now() - (cachedProfile!.timestamp || 0)
          // An EMPTY avatar must always re-verify, even when the cache is fresh.
          // Email/password logins create no Supabase session, so onAuthStateChange
          // never fires — without this the header keeps the placeholder forever.
          const missingAvatar = !(cachedProfile!.user.avatar || "").trim()
          if (cacheAge >= PROFILE_CACHE_TTL || missingAvatar) {
            supabase.auth.getSession().then(({ data: { session } }) => {
              verifySession(session?.user)
            }).catch(() => verifySession())
          }
          return
        }
        // No usable cache — show Supabase session user if name/email is real;
        // otherwise leave loading=true so the header shows a skeleton, not "…".
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mounted) return
          if (session?.user) {
            const fromSession = userFromSession(session.user)
            if (hasDisplayIdentity(fromSession)) {
              applyUser(fromSession)
              setLoading(false)
            }
            verifySession(session.user)
          } else {
            verifySession()
          }
        }).catch(() => verifySession())
        return
      }

      // No backend token yet — still prefer a fresh local cache so the header
      // never flashes signed-out/"Guest" while Supabase rehydrates.
      if (restoreFromCache()) {
        void supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mounted || !session?.access_token) return
          sessionStorage.setItem("access_token", session.access_token)
          sessionStorage.setItem("refresh_token", session.refresh_token || "")
          verifySession(session.user)
        })
        return
      }

      // Last resort: wait for Supabase session. Keep loading=true (skeleton)
      // when the session user has no real identity yet — verifySession will finish it.
      void supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return
        if (session?.user) {
          sessionStorage.setItem("access_token", session.access_token)
          sessionStorage.setItem("refresh_token", session.refresh_token || "")
          const fromSession = userFromSession(session.user)
          if (hasDisplayIdentity(fromSession)) {
            applyUser(fromSession)
            setLoading(false)
          }
          verifySession(session.user)
        } else {
          setLoading(false)
        }
      }).catch(() => setLoading(false))
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [syncSupabaseSession, verifySession, applyUser, setChallenge])

  const role: UserRole = user?.role ?? "public"
  const isAuthenticated = user !== null
  const isAdmin = user?.role === "admin"

  const login = useCallback(async (email: string, password: string, _name?: string) => {
    const res = await authApi.login({ email, password })

    sessionStorage.setItem("access_token", res.access_token)
    sessionStorage.setItem("refresh_token", res.refresh_token)
    logoutSuppressRef.current = false

    // Also open a Supabase session in the browser (best-effort). Without it an
    // email/password login leaves no persisted session, so onAuthStateChange
    // never fires and the header can never re-verify name/avatar later — the
    // avatar placeholder would stick until the next manual login.
    supabase.auth
      .signInWithPassword({ email, password })
      .then(({ data, error }) => {
        if (error || !data.session) {
          console.debug("[auth] no browser Supabase session:", error?.message || "no session")
          return
        }
        // Adopt the browser session's pair as THE pair. The Flask-issued pair
        // above would otherwise rotate on its own chain and collide with this
        // one (GoTrue reuse detection → both revoked → sudden logout).
        sessionStorage.setItem("access_token", data.session.access_token)
        sessionStorage.setItem("refresh_token", data.session.refresh_token || "")
      })
      .catch(() => {
        /* Flask session above already works on its own */
      })

    const userObj: User = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: (res.user.role || "guest") as UserRole,
      avatar: res.user.avatar_url || "",
      name_changed_at: res.user.name_changed_at || "",
    }
    applyUser(userObj)
    setCachedProfile(userObj)
    setLoading(false)
    return userObj
  }, [applyUser])

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

  /** Clear local auth state without touching the server. */
  const clearSession = useCallback(() => {
    sessionStorage.removeItem("access_token")
    sessionStorage.removeItem("refresh_token")
    localStorage.removeItem("auth_user")
    applyUser(null)
    setLoading(false)
  }, [applyUser])

  const consumeLogoutSuppress = useCallback(() => {
    const wasSet = logoutSuppressRef.current
    logoutSuppressRef.current = false
    return wasSet
  }, [])

  const logout = useCallback(async () => {
    // Flag BEFORE the server revoke — its realtime UPDATE must not be
    // mistaken for a remote logout on this same device.
    logoutSuppressRef.current = true
    // Cross-tab/webview copy: the suppress flag is in-memory, but a sibling
    // tab (e.g. a second Instagram in-app webview sharing this storage)
    // receives the same realtime UPDATE. A short-lived timestamp lets it
    // recognize this device's OWN logout instead of showing the banner.
    localStorage.setItem("hotelava:logout_at", String(Date.now()))
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    // Clear Supabase session (prevents auto-login on reload).
    // LOCAL scope: sign out THIS device only — other devices stay signed in
    // (the Settings → Devices list is where you end other sessions).
    try {
      await supabase.auth.signOut({ scope: "local" })
    } catch {
      // ignore
    }
    clearSession()
  }, [clearSession])

  /** Finish a sign-in that was verified server-side (OTP step-up / quick sign-in). */
  const completeSession = useCallback(async (res: LoginResponse) => {
    sessionStorage.setItem("access_token", res.access_token)
    sessionStorage.setItem("refresh_token", res.refresh_token)
    logoutSuppressRef.current = false
    setChallenge(null)
    const userObj: User = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: (res.user.role || "guest") as UserRole,
      avatar: res.user.avatar_url || "",
      name_changed_at: res.user.name_changed_at || "",
    }
    applyUser(userObj)
    setCachedProfile(userObj)
    setLoading(false)
    // Browser Supabase session (best-effort) — keeps reload/re-verify working
    try {
      const { error } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      })
      if (error) console.debug("[auth] setSession:", error.message)
    } catch {
      /* Flask session above already works on its own */
    }
  }, [applyUser, setChallenge])

  const setRole = useCallback(
    (newRole: UserRole) => {
      const prev = userRef.current
      if (!prev) {
        const mock: User = { id: "mock-1", name: "Guest", email: "guest@hotelava.com", role: newRole }
        applyUser(mock)
        return
      }
      applyUser({ ...prev, role: newRole })
    },
    [applyUser]
  )

  const updateUser = useCallback(
    (fields: Partial<Pick<User, "name" | "avatar" | "name_changed_at">>) => {
      const prev = userRef.current
      if (!prev) return
      const merged = mergeIdentity({ ...fields }, prev)
      if (!merged) return
      applyUser(merged)
      setCachedProfile(merged)
      // System name wins over Google — mirror into Supabase user_metadata so
      // instant session display (userFromSession) shows system name next load
      if (fields.name && fields.name.trim()) {
        supabase.auth
          .updateUser({ data: { name: fields.name, full_name: fields.name } })
          .catch(() => {})
      }
    },
    [applyUser, mergeIdentity]
  )

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, isAdmin, login, register, logout, setRole, updateUser, loading, clearSession, consumeLogoutSuppress, pendingChallenge, setChallenge, completeSession }}>
      {children}
      {pendingChallenge && (
        <LoginChallengeDialog
          challenge={pendingChallenge}
          onVerified={completeSession}
          onClose={() => setChallenge(null)}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
