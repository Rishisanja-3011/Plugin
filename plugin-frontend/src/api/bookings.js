import api from './axios';

export const bookingsApi = {
  create: (data) => api.post('/bookings', data),
  modify: (id, data) => api.put(`/bookings/${id}`, data),
  cancel: (id, data) => api.post(`/bookings/${id}/cancel`, data),
  requestReschedule: (id, data) => api.post(`/bookings/${id}/reschedule-request`, data),
  getMy: (page = 0, size = 10) => api.get(`/bookings/my?page=${page}&size=${size}`),
  getById: (id) => api.get(`/bookings/${id}`),
};

export const sessionsApi = {
  start: (bookingId) => api.post(`/sessions/start/${bookingId}`),
  end: (sessionId) => api.post(`/sessions/end/${sessionId}`),
  getMy: (page = 0, size = 10) => api.get(`/sessions/my?page=${page}&size=${size}`),
  getMyActive: () => api.get('/sessions/my/active'),
  getById: (id) => api.get(`/sessions/${id}`),
};

export const billsApi = {
  getMy: (page = 0, size = 10) => api.get(`/bills/my?page=${page}&size=${size}`),
  getById: (id) => api.get(`/bills/${id}`),
  payFromWallet: (id) => api.post(`/bills/my/${id}/wallet-pay`),
  getMyUnpaidCount: () => api.get('/bills/my/unpaid-count'),
  downloadInvoice: (id) => api.get(`/bills/my/${id}/invoice?t=${Date.now()}`, {
    responseType: 'blob',
  }),
  downloadStatement: ({ from, to } = {}) => {
    const query = new URLSearchParams();
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return api.get(`/bills/my/statement${suffix}`, {
      responseType: 'blob',
    });
  },
};

export const notificationsApi = {
  getAll: (page = 0, size = 20) => api.get(`/notifications?page=${page}&size=${size}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
};
