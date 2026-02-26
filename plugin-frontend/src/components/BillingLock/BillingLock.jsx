import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { billsApi } from '../../api/bookings';
import { useAuth } from '../../context/AuthContext';

const BillingLockContext = createContext({ hasUnpaid: false, loading: false });

export function useBillingLock() {
  return useContext(BillingLockContext);
}

export default function BillingLock({ children }) {
  const { user, loading, isCustomer } = useAuth();
  const location = useLocation();
  const [lockState, setLockState] = useState({ loading: false, hasUnpaid: false, checkedPath: null });
  const isBillingPage = location.pathname === '/customer/billing';

  useEffect(() => {
    if (loading || !user || !isCustomer) {
      setLockState({ loading: false, hasUnpaid: false, checkedPath: location.pathname });
      return;
    }
    let cancelled = false;
    const refreshLock = (showLoading = false) => {
      if (showLoading) {
        setLockState((prev) => ({ ...prev, loading: true, checkedPath: location.pathname }));
      }
      billsApi.getMyUnpaidCount()
        .then((res) => {
          if (cancelled) return;
          const count = res.data?.count ?? 0;
          setLockState({ loading: false, hasUnpaid: count > 0, checkedPath: location.pathname });
        })
        .catch(() => {
          if (cancelled) return;
          setLockState({ loading: false, hasUnpaid: false, checkedPath: location.pathname });
        });
    };

    refreshLock(true);
    const pollInterval = setInterval(() => {
      refreshLock(false);
    }, 1000);

    return () => { cancelled = true; clearInterval(pollInterval); };
  }, [loading, user, isCustomer, location.pathname]);

  if (loading || !user || !isCustomer) {
    return (
      <BillingLockContext.Provider value={{ hasUnpaid: false, loading: false }}>
        {children}
      </BillingLockContext.Provider>
    );
  }

  const isStale = lockState.checkedPath !== location.pathname;

  if (lockState.loading || isStale) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton-pulse" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      </div>
    );
  }

  if (lockState.hasUnpaid && !isBillingPage) {
    return <Navigate to="/customer/billing" replace />;
  }

  return (
    <BillingLockContext.Provider value={{ hasUnpaid: lockState.hasUnpaid, loading: lockState.loading }}>
      {children}
    </BillingLockContext.Provider>
  );
}
