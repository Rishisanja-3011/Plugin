import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';
import { stationManagerApi } from '../api/stationManager';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/authStorage';

const AuthContext = createContext(null);

function formatActiveVehicleLabel(profile) {
  if (!profile) return '';

  const vehicles = Array.isArray(profile.vehicles) ? profile.vehicles : [];
  const activeVehicle =
    vehicles.find((vehicle) => vehicle?.id != null && vehicle.id === profile.activeVehicleId) ||
    vehicles.find((vehicle) => vehicle?.active) ||
    vehicles[0] ||
    null;

  const nickname = (activeVehicle?.vehicleNickname || '').trim();
  if (nickname) return nickname;

  const make = (activeVehicle?.vehicleMake ?? profile.vehicleMake ?? '').trim();
  const model = (activeVehicle?.vehicleModel ?? profile.vehicleModel ?? '').trim();
  const label = `${make} ${model}`.trim();
  if (label) return label;

  const registration = (activeVehicle?.vehicleRegistration ?? profile.vehicleRegistration ?? '').trim();
  return registration || '';
}

function mergeUserWithProfileSummary(baseUser, profile) {
  if (!profile) return baseUser;

  return {
    ...baseUser,
    fullName: profile.fullName ?? baseUser?.fullName ?? '',
    email: profile.email ?? baseUser?.email ?? '',
    phone: profile.phone ?? baseUser?.phone ?? '',
    role: profile.role ?? baseUser?.role ?? '',
    userId: profile.id ?? baseUser?.userId ?? null,
    vehicleMake: profile.vehicleMake ?? '',
    vehicleModel: profile.vehicleModel ?? '',
    vehicleRegistration: profile.vehicleRegistration ?? '',
    activeVehicleId: profile.activeVehicleId ?? null,
    activeVehicleLabel: formatActiveVehicleLabel(profile),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistUser = (nextUser) => {
    // Remove the legacy persistent PII cache. User data now lives in memory only.
    localStorage.removeItem('plugin_user');
    if (nextUser) {
      setUser(nextUser);
      return nextUser;
    }

    setUser(null);
    return null;
  };

  const syncUserProfile = (profile) => {
    setUser((prev) => {
      const nextUser = mergeUserWithProfileSummary(prev ?? {}, profile);
      return nextUser;
    });
  };

  const refreshUserProfile = async () => {
    const res = await authApi.getProfile();
    syncUserProfile(res.data);
    return res.data;
  };

  const applyAuthSession = async (data, options = {}) => {
    const { refreshProfile = data?.role === 'CUSTOMER' } = options;
    setAuthToken(data.token);
    persistUser(data);

    if (!refreshProfile) {
      return data;
    }

    try {
      const profile = await refreshUserProfile();
      return mergeUserWithProfileSummary(data, profile);
    } catch {
      return data;
    }
  };

  useEffect(() => {
    let active = true;
    localStorage.removeItem('plugin_user');
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    authApi.getProfile()
      .then((res) => {
        if (active) syncUserProfile(res.data);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    return applyAuthSession(res.data);
  };

  const googleLogin = async (idToken) => {
    const res = await authApi.google(idToken);
    return applyAuthSession(res.data);
  };

  const refreshStationManagerAccess = async () => {
    const res = await stationManagerApi.refreshSession();
    return applyAuthSession(res.data, { refreshProfile: false });
  };

  const register = async (fullName, email, password, phone) => {
    const res = await authApi.register({ fullName, email, password, phone });
    return res.data;
  };

  const logout = () => {
    clearAuthToken();
    persistUser(null);
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STATION_OPERATOR';
  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        googleLogin,
        register,
        logout,
        loading,
        isAdmin,
        isCustomer,
        syncUserProfile,
        refreshUserProfile,
        refreshStationManagerAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
