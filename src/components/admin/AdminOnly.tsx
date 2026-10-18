import { Navigate, Outlet } from "react-router"
import { useAuth } from "@/contexts/AuthContext"

/**
 * Wraps admin-only routes inside the admin layout. Staff accounts are bounced
 * to their front desk (/admin/bookings) — the sidebar never shows these links
 * to them, and the backend rejects their tokens on these endpoints anyway.
 */
export default function AdminOnly() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/admin/bookings" replace />
  return <Outlet />
}
