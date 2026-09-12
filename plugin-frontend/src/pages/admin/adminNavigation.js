const ADMIN_LINKS = [
  { to: '/admin/dashboard', icon: '\u{1F4CA}', label: 'Dashboard' },
  { to: '/grid/dashboard', icon: '\u26A1', label: 'Grid operations' },
  { to: '/admin/grid-operators', icon: '\u{1F465}', label: 'Grid operators' },
  { to: '/admin/energy', icon: '\u{1F33F}', label: 'Grid Energy' },
  { to: '/admin/station-manager-applications', icon: '\u{1F4DD}', label: 'Station KYC' },
  { to: '/admin/station-managers', icon: '\u{1F465}', label: 'Station Managers' },
  { to: '/admin/stations', icon: '\u{1F3E2}', label: 'Stations' },
  { to: '/admin/charging-points', icon: '\u{1F50C}', label: 'Charging Points' },
  { to: '/admin/pricing', icon: '\u{1F4B2}', label: 'Pricing' },
  { to: '/admin/bookings', icon: '\u{1F4CB}', label: 'Bookings' },
  { to: '/admin/customers', icon: '\u{1F465}', label: 'Customers' },
  { to: '/admin/sessions', icon: '\u26A1', label: 'Sessions' },
  { to: '/admin/revenue', icon: '\u{1F4B0}', label: 'Revenue' },
  { to: '/admin/analytics', icon: '\u{1F4C8}', label: 'Analytics' },
  { to: '/admin/audit-logs', icon: '\u{1F4DD}', label: 'Audit Logs' },
];

const STATION_MANAGER_LINKS = [
  { to: '/admin/dashboard', icon: '\u{1F4CA}', label: 'Dashboard' },
  { to: '/admin/energy', icon: '\u{1F33F}', label: 'Grid Energy' },
  { to: '/admin/re-kyc', icon: '\u{1F4DD}', label: 'Re-KYC' },
  { to: '/admin/stations', icon: '\u{1F3E2}', label: 'My Station' },
  { to: '/admin/charging-points', icon: '\u{1F50C}', label: 'Charging Points' },
  { to: '/admin/pricing', icon: '\u{1F4B2}', label: 'Pricing' },
];

export function getAdminSidebarLinks(role) {
  return role === 'STATION_OPERATOR' ? STATION_MANAGER_LINKS : ADMIN_LINKS;
}

export function getPanelTitle(role) {
  return role === 'STATION_OPERATOR' ? 'Manager Panel' : 'Admin Panel';
}
