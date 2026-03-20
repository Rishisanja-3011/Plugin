import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/auth';

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
    if (nextUser) {
      localStorage.setItem('plugin_user', JSON.stringify(nextUser));
      setUser(nextUser);
      return nextUser;
    }

    localStorage.removeItem('plugin_user');
    setUser(null);
    return null;
  };

  const syncUserProfile = (profile) => {
    setUser((prev) => {
      const nextUser = mergeUserWithProfileSummary(prev ?? {}, profile);
      localStorage.setItem('plugin_user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const refreshUserProfile = async () => {
    const res = await authApi.getProfile();
    syncUserProfile(res.data);
    return res.data;
  };

  useEffect(() => {
    const stored = localStorage.getItem('plugin_user');
    const token = localStorage.getItem('plugin_token');
    if (stored && token) {
      try {
        const parsedUser = JSON.parse(stored);
        setUser(parsedUser);
        authApi.getProfile()
          .then((res) => {
            syncUserProfile(res.data);
          })
          .catch(() => {
            // Keep the last known user state; axios auth handling will redirect on real auth failures.
          });
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const data = res.data;
    localStorage.setItem('plugin_token', data.token);
    persistUser(data);

    try {
      const profile = await refreshUserProfile();
      return mergeUserWithProfileSummary(data, profile);
    } catch {
      return data;
    }
  };

  const register = async (fullName, email, password, phone) => {
    const res = await authApi.register({ fullName, email, password, phone });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('plugin_token');
    persistUser(null);
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'STATION_OPERATOR';
  const isCustomer = user?.role === 'CUSTOMER';

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, isAdmin, isCustomer, syncUserProfile, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
