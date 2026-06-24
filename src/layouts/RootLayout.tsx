import { Outlet, useLocation } from "react-router-dom"
import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"

const hideHeaderFooter = ["/login", "/register"]

export default function RootLayout() {
  const location = useLocation()
  const isAuthPage = hideHeaderFooter.includes(location.pathname)

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {!isAuthPage && <Header />}
      <main className="flex-1 mx-auto w-full" style={{ maxWidth: "var(--container-max)" }}>
        <Outlet />
      </main>
      {!isAuthPage && <Footer />}
    </div>
  )
}