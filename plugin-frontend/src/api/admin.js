import api from './axios';

export const adminApi = {
  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'),

  // Stations
  getAllStations: (page = 0, size = 20) => api.get(`/admin/stations?page=${page}&size=${size}`),
  createStation: (data) => api.post('/admin/stations', data),
  updateStation: (id, data) => api.put(`/admin/stations/${id}`, data),
  toggleStation: (id) => api.patch(`/admin/stations/${id}/toggle`),
  deleteStation: (id) => api.delete(`/admin/stations/${id}`),

  // Charging Points
  getChargingPoints: (stationId) => api.get(`/admin/charging-points/station/${stationId}`),
  createChargingPoint: (data) => api.post('/admin/charging-points', data),
  updateChargingPoint: (id, data) => api.put(`/admin/charging-points/${id}`, data),
  updatePointStatus: (id, status) => api.patch(`/admin/charging-points/${id}/status?status=${status}`),
  deleteChargingPoint: (id) => api.delete(`/admin/charging-points/${id}`),

  // Pricing
  getAllPricing: () => api.get('/admin/pricing'),
  getPricingByStation: (stationId) => api.get(`/admin/pricing/station/${stationId}`),
  createOrUpdatePricing: (data) => api.post('/admin/pricing', data),
  deletePricing: (id) => api.delete(`/admin/pricing/${id}`),

  // Bookings
  getAllBookings: (page = 0, size = 20, status = '') => {
    const query = new URLSearchParams({ page, size });
    if (status && status !== 'ALL') query.append('status', status);
    return api.get(`/admin/bookings?${query.toString()}`);
  },
  getBookingStats: () => api.get('/admin/bookings/stats'),

  //Customers
  getCustomers: (page = 0, size = 20, params = {}) => {
    const query = new URLSearchParams({ page, size });
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.append(key, value);
    });
    return api.get(`/admin/customers?${query.toString()}`);
  },
  updateCustomerStatus: (id, active) => api.patch(`/admin/customers/${id}/status?active=${active}`),
  getBookingsByStation: (stationId, page = 0, size = 20) =>
    api.get(`/admin/bookings/station/${stationId}?page=${page}&size=${size}`),
  cancelBooking: (id, data) => api.post(`/admin/bookings/${id}/cancel`, data),
  approveRescheduleRequest: (id) => api.post(`/admin/bookings/${id}/reschedule/approve`),
  rejectRescheduleRequest: (id) => api.post(`/admin/bookings/${id}/reschedule/reject`),

  // Sessions
  getAllSessions: (page = 0, size = 20) => api.get(`/admin/sessions?page=${page}&size=${size}`),
  endSession: (id) => api.post(`/admin/sessions/${id}/end`),

  // Bills
  getAllBills: (page = 0, size = 20, params = {}) => {
    const query = new URLSearchParams({ page, size });
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.append(key, value);
    });
    return api.get(`/admin/bills?${query.toString()}`);
  },
  markBillPaid: (id) => api.post(`/admin/bills/${id}/pay`),
  downloadBillInvoice: (id) => api.get(`/admin/bills/${id}/invoice`, { responseType: 'blob' }),

  // Revenue
  getRevenue: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.get(`/admin/revenue?${query}`);
  },

  // Audit
  getAuditLogs: (page = 0, size = 30, entityType = '') => {
    let url = `/admin/audit-logs?page=${page}&size=${size}`;
    if (entityType) url += `&entityType=${entityType}`;
    return api.get(url);
  },

  // Station manager applications
  getStationManagerApplications: (page = 0, size = 20, params = {}) => {
    const query = new URLSearchParams({ page, size });
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      query.append(key, value);
    });
    return api.get(`/admin/station-manager-applications?${query.toString()}`);
  },
  getStationManagerApplication: (id) => api.get(`/admin/station-manager-applications/${id}`),
  approveStationManagerApplication: (id, notes) =>
    api.post(`/admin/station-manager-applications/${id}/approve`, { notes }),
  rejectStationManagerApplication: (id, notes) =>
    api.post(`/admin/station-manager-applications/${id}/reject`, { notes }),
  issueStationManagerCredentials: (id) =>
    api.post(`/admin/station-manager-applications/${id}/issue-credentials`),
  downloadStationManagerFile: (id, slotType) => api.get(
    `/admin/station-manager-applications/${id}/files/${slotType}`,
    { responseType: 'blob' }
  ),
  downloadStationManagerBusinessDocument: (id, documentType) => api.get(
    `/admin/station-manager-applications/${id}/business-documents/${documentType}/file`,
    { responseType: 'blob' }
  ),
};
