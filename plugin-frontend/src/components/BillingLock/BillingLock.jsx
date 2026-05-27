import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { billsApi } from '../../api/bookings';
import { useAuth } from '../../context/AuthContext';

const BillingLockContext = createContext({ hasUnpaid: false, loading: false });
const BILLING_LOCK_CACHE_KEY = 'plugin_has_unpaid';
const BILLING_LOCK_REFRESH_INTERVAL_MS = 1000;

function readCachedBillingLock() {
  const cached = sessionStorage.getItem(BILLING_LOCK_CACHE_KEY);
  if (cached === '1') return true;
  if (cached === '0') return false;
  return null;
}

export function useBillingLock() {
  return useContext(BillingLockContext);
}

export default function BillingLock({ children }) {
  const { user, loading, isCustomer } = useAuth();
  const location = useLocation();
  const [lockState, setLockState] = useState(() => {
    const cached = readCachedBillingLock();
    return {
      loading: false,
      hasUnpaid: cached ?? false,
      initialized: cached !== null,
    };
  });
  const isBillingPage = location.pathname === '/customer/billing';

  useEffect(() => {
    if (loading || !user || !isCustomer) {
      sessionStorage.removeItem(BILLING_LOCK_CACHE_KEY);
      setLockState({ loading: false, hasUnpaid: false, initialized: false });
      return;
    }

    let cancelled = false;
    const refreshLock = () => {
      billsApi.getMyUnpaidCount()
        .then((res) => {
          if (cancelled) return;
          const count = res.data?.count ?? 0;
          const hasUnpaid = count > 0;
          sessionStorage.setItem(BILLING_LOCK_CACHE_KEY, hasUnpaid ? '1' : '0');
          setLockState({ loading: false, hasUnpaid, initialized: true });
        })
        .catch(() => {
          if (cancelled) return;
          setLockState((prev) => ({ ...prev, loading: false, initialized: true }));
        });
    };

    refreshLock();
    const pollInterval = setInterval(() => {
      refreshLock();
    }, BILLING_LOCK_REFRESH_INTERVAL_MS);

    return () => { cancelled = true; clearInterval(pollInterval); };
  }, [loading, user, isCustomer]);

  if (loading || !user || !isCustomer) {
    return (
      <BillingLockContext.Provider value={{ hasUnpaid: false, loading: false }}>
        {children}
      </BillingLockContext.Provider>
    );
  }

  if (lockState.hasUnpaid && !isBillingPage) {
    return <Navigate to="/customer/billing" replace />;
  }

  return (
    <BillingLockContext.Provider value={{ hasUnpaid: lockState.hasUnpaid, loading: false }}>
      {children}
    </BillingLockContext.Provider>
  );
}
