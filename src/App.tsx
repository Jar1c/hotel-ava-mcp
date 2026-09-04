import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route } from "react-router"
import RootLayout from "./layouts/RootLayout"
import ProtectedRoute from "./components/ProtectedRoute"
import LoadingDots from "./components/LoadingDots"

const Home = lazy(() => import("./pages/Home"))
const Rooms = lazy(() => import("./pages/Rooms"))
const RoomDetail = lazy(() => import("./pages/RoomDetail"))
const Login = lazy(() => import("./pages/Login"))
const Register = lazy(() => import("./pages/Register"))
const Profile = lazy(() => import("./pages/Profile"))
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"))
const Booking = lazy(() => import("./pages/Booking"))
const BookingConfirmation = lazy(() => import("./pages/BookingConfirmation"))
const PaymentFailed = lazy(() => import("./pages/PaymentFailed"))
const MyBookings = lazy(() => import("./pages/MyBookings"))
const Settings = lazy(() => import("./pages/Settings"))
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"))
const ResetPassword = lazy(() => import("./pages/ResetPassword"))
const NotFound = lazy(() => import("./pages/NotFound"))

// Admin — lazy loaded separately (includes heavy recharts)
const Admin = lazy(() => import("./pages/Admin"))
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"))
const Dashboard = lazy(() => import("./pages/admin/Dashboard"))
const Bookings = lazy(() => import("./pages/admin/Bookings"))
const AdminRooms = lazy(() => import("./pages/admin/Rooms"))
const Guests = lazy(() => import("./pages/admin/Guests"))
const Calendar = lazy(() => import("./pages/admin/Calendar"))
const Analytics = lazy(() => import("./pages/admin/Analytics"))
const AdminSettings = lazy(() => import("./pages/admin/Settings"))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F6F8]">
      <LoadingDots size="lg" className="text-primary" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Standalone pages — no navbar/footer */}
          <Route path="verify-email" element={<VerifyEmail />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />

          {/* User side */}
          <Route element={<RootLayout />}>
            <Route index element={<Home />} />
            <Route path="rooms" element={<Rooms />} />
            <Route path="rooms/:id" element={<RoomDetail />} />
            <Route path="booking/failed" element={<PaymentFailed />} />
            <Route path="*" element={<NotFound />} />

            {/* Authenticated user routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="booking/:id" element={<Booking />} />
              <Route path="booking/confirmation/:id" element={<BookingConfirmation />} />
              <Route path="my-bookings" element={<MyBookings />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          {/* Admin side — completely separate */}
          <Route path="admin">
            <Route index element={<AdminLogin />} />
            <Route element={<ProtectedRoute requireAdmin />}>
              <Route element={<Admin />}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="rooms" element={<AdminRooms />} />
                <Route path="guests" element={<Guests />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
