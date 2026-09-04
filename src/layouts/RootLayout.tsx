import { Outlet, useLocation } from "react-router"
import { useEffect } from "react"
import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"
import { useAuth } from "@/contexts/AuthContext"

const hideHeaderFooter = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"]

export default function RootLayout() {
  const location = useLocation()
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

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {!isAuthPage && <Header />}
      <main className={`flex-1 mx-auto w-full${isAuthPage ? "" : " max-w-container"}`}>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
    </div>
  )
}