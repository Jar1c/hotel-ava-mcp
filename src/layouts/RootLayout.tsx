import { Outlet } from "react-router-dom"
import Header from "@/components/layout/Header"
import Footer from "@/components/layout/Footer"

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full" style={{ maxWidth: "var(--container-max)" }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}