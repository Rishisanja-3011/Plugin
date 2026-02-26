import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { billsApi } from '../../api/bookings';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [billingCheck, setBillingCheck] = useState({ loading: false, hasUnpaid: false });
  const isBillingPage = location.pathname === '/customer/billing';
  const isCustomerRoute = role === 'CUSTOMER';

  useEffect(() => {
    if (loading || !user || !isCustomerRoute || isBillingPage) {
      setBillingCheck({ loading: false, hasUnpaid: false });
      return;
    }
    let cancelled = false;
    setBillingCheck((prev) => ({ ...prev, loading: true }));
    billsApi.getMyUnpaidCount()
      .then((res) => {
        if (cancelled) return;
        const count = res.data?.count ?? 0;
        setBillingCheck({ loading: false, hasUnpaid: count > 0 });
      })
      .catch(() => {
        if (cancelled) return;
        setBillingCheck({ loading: false, hasUnpaid: false });
      });
    return () => { cancelled = true; };
  }, [loading, user, isCustomerRoute, isBillingPage]);

  if (loading) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton-pulse" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'ADMIN' && user.role !== 'ADMIN' && user.role !== 'STATION_OPERATOR') {
    return <Navigate to="/" replace />;
  }

  if (isCustomerRoute && user.role !== 'CUSTOMER') {
    return <Navigate to="/" replace />;
  }

  if (isCustomerRoute && !isBillingPage) {
    if (billingCheck.loading) {
      return (
        <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skeleton-pulse" style={{ width: 48, height: 48, borderRadius: '50%' }} />
        </div>
      );
    }
    if (billingCheck.hasUnpaid) {
      return <Navigate to="/customer/billing" replace />;
    }
  }

  return children;
}
