import { Navigate, Outlet } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import LoadingDots from "@/components/LoadingDots"

export default function ProtectedRoute({ requireAdmin = false }) {
  const { isAuthenticated, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <LoadingDots size="lg" className="text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={requireAdmin ? "/admin" : "/login"} replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
