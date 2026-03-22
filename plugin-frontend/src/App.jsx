import { useEffect, useLayoutEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar/Navbar';
import Footer from './components/Footer/Footer';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute';
import BillingLock from './components/BillingLock/BillingLock';

// Public pages
import Landing from './pages/Landing/Landing';
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import ForgotPassword from './pages/ForgotPassword/ForgotPassword';
import EmailInbox from './pages/EmailInbox/EmailInbox';
import Search from './pages/Search/Search';
import StationDetails from './pages/StationDetails/StationDetails';
import StationManagerApply from './pages/StationManagerApply/StationManagerApply';
import StationManagerApplyIntro from './pages/StationManagerApplyIntro/StationManagerApplyIntro';

// Customer pages
import CustomerDashboard from './pages/customer/Dashboard/Dashboard';
import BookingFlow from './pages/customer/BookingFlow/BookingFlow';
import MyBookings from './pages/customer/MyBookings/MyBookings';
import SessionStatus from './pages/customer/SessionStatus/SessionStatus';
import Billing from './pages/customer/Billing/Billing';
import Profile from './pages/customer/Profile/Profile';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard/Dashboard';
import AdminStations from './pages/admin/Stations/Stations';
import AdminChargingPoints from './pages/admin/ChargingPoints/ChargingPoints';
import AdminPricing from './pages/admin/Pricing/Pricing';
import AdminBookings from './pages/admin/Bookings/Bookings';
import AdminCustomers from './pages/admin/Customers/Customers';
import AdminSessions from './pages/admin/Sessions/Sessions';
import AdminRevenue from './pages/admin/Revenue/Revenue';
import AdminAnalytics from './pages/admin/Analytics/Analytics';
import AdminAuditLogs from './pages/admin/AuditLogs/AuditLogs';
import AdminNotifications from './pages/admin/Notifications/Notifications';
import AdminStationManagerApplications from './pages/admin/StationManagerApplications/StationManagerApplications';

export default function App() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';
  const isAdminRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (!window?.history || !('scrollRestoration' in window.history)) {
      return undefined;
    }

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.search]);

  return (
    <>
      <BillingLock>
        <Navbar />
        <Routes location={location}>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/email-inbox" element={<EmailInbox />} />
          <Route path="/search" element={<Search />} />
          <Route path="/stations/:id" element={<StationDetails />} />
          <Route path="/station-manager/apply" element={<StationManagerApplyIntro />} />
          <Route path="/station-manager/apply/form" element={<StationManagerApply />} />

          {/* Customer */}
          <Route path="/customer/dashboard" element={<ProtectedRoute role="CUSTOMER"><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/customer/book/:stationId" element={<ProtectedRoute role="CUSTOMER"><BookingFlow /></ProtectedRoute>} />
          <Route path="/customer/bookings" element={<ProtectedRoute role="CUSTOMER"><MyBookings /></ProtectedRoute>} />
          <Route path="/customer/sessions" element={<ProtectedRoute role="CUSTOMER"><SessionStatus /></ProtectedRoute>} />
          <Route path="/customer/billing" element={<ProtectedRoute role="CUSTOMER"><Billing /></ProtectedRoute>} />
          <Route path="/customer/profile" element={<ProtectedRoute role="CUSTOMER"><Profile /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<ProtectedRoute role="ADMIN"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/station-manager-applications" element={<ProtectedRoute roles={['ADMIN']}><AdminStationManagerApplications /></ProtectedRoute>} />
          <Route path="/admin/station-manager-applications/:id" element={<ProtectedRoute roles={['ADMIN']}><AdminStationManagerApplications /></ProtectedRoute>} />
          <Route path="/admin/stations" element={<ProtectedRoute role="ADMIN"><AdminStations /></ProtectedRoute>} />
          <Route path="/admin/charging-points" element={<ProtectedRoute role="ADMIN"><AdminChargingPoints /></ProtectedRoute>} />
          <Route path="/admin/pricing" element={<ProtectedRoute role="ADMIN"><AdminPricing /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute role="ADMIN"><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/customers" element={<ProtectedRoute role="ADMIN"><AdminCustomers /></ProtectedRoute>} />
          <Route path="/admin/sessions" element={<ProtectedRoute role="ADMIN"><AdminSessions /></ProtectedRoute>} />
          <Route path="/admin/revenue" element={<ProtectedRoute role="ADMIN"><AdminRevenue /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute role="ADMIN"><AdminAnalytics /></ProtectedRoute>} />
          <Route path="/admin/audit-logs" element={<ProtectedRoute role="ADMIN"><AdminAuditLogs /></ProtectedRoute>} />
          <Route path="/admin/notifications" element={<ProtectedRoute role="ADMIN"><AdminNotifications /></ProtectedRoute>} />
        </Routes>
        <Footer compact={isLogin} userSide={!isAdminRoute} adminSide={isAdminRoute} />
      </BillingLock>
    </>
  );
}
