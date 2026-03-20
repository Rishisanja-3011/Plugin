import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, loading } = useAuth();

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

  if (role === 'CUSTOMER' && user.role !== 'CUSTOMER') {
    return <Navigate to="/" replace />;
  }

  return children;
}
