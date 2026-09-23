import { Outlet, useLocation, useNavigate } from "react-router"
import { useEffect } from "react"
import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import BottomNav from "@/components/layout/BottomNav"
import { useAuth } from "@/contexts/AuthContext"

const hideHeaderFooter = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

export default function RootLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const isAuthPage = hideHeaderFooter.includes(location.pathname)

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
      {!isAuthPage && <Header />}
      <main className={`flex-1 mx-auto w-full${isAuthPage ? "" : " max-w-container"} pb-16 md:pb-0`}>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
      {!isAuthPage && <BottomNav />}
    </div>
  )
}