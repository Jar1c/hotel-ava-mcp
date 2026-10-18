import { Navigate, Outlet } from "react-router"
import { useAuth } from "@/contexts/AuthContext"
import LoadingDots from "@/components/LoadingDots"

/**
 * requireAdmin + allowStaff = the admin portal entry (role in admin|staff).
 * Staff who reach an admin-only route are bounced to their front desk
 * (/admin/bookings) by AdminOnly inside the admin layout.
 */
export default function ProtectedRoute({ requireAdmin = false, allowStaff = false }) {
  const { isAuthenticated, isAdmin, isStaff, loading } = useAuth()

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

  if (requireAdmin && !isAdmin && !(allowStaff && isStaff)) {
    return <Navigate to={isStaff ? "/admin/bookings" : "/"} replace />
  }

  return <Outlet />
}
