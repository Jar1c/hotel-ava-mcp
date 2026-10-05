import { Outlet, useLocation, useNavigate } from "react-router"
import { useEffect, useState } from "react"
import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import BottomNav from "@/components/layout/BottomNav"
import InactivityGuard from "@/components/InactivityGuard"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { authApi } from "@/services/api"

const hideHeaderFooter = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

function deletionDateLabel(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return "soon"
  return new Date(t).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
}

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [cancelBusy, setCancelBusy] = useState(false)
  const isAuthPage = hideHeaderFooter.includes(location.pathname)

  const cancelDeletion = async () => {
    setCancelBusy(true)
    try {
      await authApi.deleteCancel()
      await refreshUser()
      toast({
        title: "Deletion cancelled",
        description: "Your account is back to normal.",
        variant: "success",
      })
    } catch {
      toast({
        title: "Couldn't cancel deletion",
        description: "Please try again.",
        variant: "error",
      })
    } finally {
      setCancelBusy(false)
    }
  }

  // Scroll to top on route change (pathname only, not hash)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // Clean up stale scroll-lock inline styles left by unmounted Base UI components
  useEffect(() => {
    document.documentElement.removeAttribute("data-base-ui-scroll-locked")
    document.documentElement.style.overflow = ""
    document.body.style.overflow = ""
    document.body.style.pointerEvents = ""
  }, [location.pathname, isAuthenticated])

  // Fallback after Google OAuth: if the OAuth redirectTo didn't land on the
  // intended page (or landed on home), navigate to the stored return path.
  // Guard: only consume within 10 minutes, and only when authenticated.
  useEffect(() => {
    if (!isAuthenticated) return
    const target = sessionStorage.getItem("postOAuthReturnTo")
    const savedAt = Number(sessionStorage.getItem("postOAuthReturnToAt") || 0)
    if (!target) return
    sessionStorage.removeItem("postOAuthReturnTo")
    sessionStorage.removeItem("postOAuthReturnToAt")
    if (!savedAt || Date.now() - savedAt > 10 * 60 * 1000) return
    if (target !== location.pathname + location.search) {
      navigate(target, { replace: true })
    }
  }, [isAuthenticated, location.pathname, location.search, navigate])

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[10000] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-[6px] focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      {!isAuthPage && <Header />}
      {!isAuthPage && isAuthenticated && user?.scheduled_deletion_at && (
        <div className="bg-red-50 border-b border-red-200 dark:bg-red-500/10 dark:border-red-500/30">
          <div className="mx-auto w-full max-w-container px-4 py-2 flex items-center justify-between gap-3 text-sm text-red-800 dark:text-red-300">
            <span>
              Your account is scheduled for deletion on{" "}
              <strong>{deletionDateLabel(user.scheduled_deletion_at)}</strong>.
              Cancel any time before then.
            </span>
            <button
              type="button"
              onClick={() => void cancelDeletion()}
              disabled={cancelBusy}
              className="shrink-0 font-semibold underline hover:no-underline disabled:opacity-60"
            >
              {cancelBusy ? "Cancelling…" : "Cancel deletion"}
            </button>
          </div>
        </div>
      )}
      <main id="main-content" tabIndex={-1} className={`flex-1 mx-auto w-full${isAuthPage ? "" : " max-w-container"} pb-16 md:pb-0`}>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
      {!isAuthPage && <BottomNav />}
      <InactivityGuard />
    </div>
  )
}