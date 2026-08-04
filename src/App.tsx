import { BrowserRouter, Routes, Route } from 'react-router'
import RootLayout from './layouts/RootLayout'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Rooms from './pages/Rooms'
import RoomDetail from './pages/RoomDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import VerifyEmail from './pages/VerifyEmail'
import Booking from './pages/Booking'
import BookingConfirmation from './pages/BookingConfirmation'
import MyBookings from './pages/MyBookings'
import Settings from './pages/Settings'
import NotFound from './pages/NotFound'
import Admin from './pages/Admin'
import AdminLogin from './pages/admin/AdminLogin'
import Dashboard from './pages/admin/Dashboard'
import Bookings from './pages/admin/Bookings'
import AdminRooms from './pages/admin/Rooms'
import Guests from './pages/admin/Guests'
import Calendar from './pages/admin/Calendar'
import Analytics from './pages/admin/Analytics'
import AdminSettings from './pages/admin/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone pages — no navbar/footer */}
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />

        {/* User side */}
        <Route element={<RootLayout />}>
          <Route index element={<Home />} />
          <Route path="rooms" element={<Rooms />} />
          <Route path="rooms/:id" element={<RoomDetail />} />
          <Route path="booking/:id" element={<Booking />} />
          <Route path="booking/confirmation/:id" element={<BookingConfirmation />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
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
    </BrowserRouter>
  )
}
