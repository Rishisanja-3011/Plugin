import api from './axios';

export const bookingsApi = {
  create: (data) => api.post('/bookings', data),
  modify: (id, data) => api.put(`/bookings/${id}`, data),
  cancel: (id) => api.delete(`/bookings/${id}`),
  getMy: (page = 0, size = 10) => api.get(`/bookings/my?page=${page}&size=${size}`),
  getById: (id) => api.get(`/bookings/${id}`),
  getAvailableSlots: (stationId, pointId, date) =>
    api.get(`/bookings/available-slots?stationId=${stationId}&pointId=${pointId}&date=${date}`),
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
  pay: (id) => api.post(`/bills/${id}/pay`),
  getMyUnpaidCount: () => api.get('/bills/my/unpaid-count'),
  downloadInvoice: (id) => api.get(`/bills/my/${id}/invoice`, { responseType: 'blob' }),
};

export const notificationsApi = {
  getAll: (page = 0, size = 20) => api.get(`/notifications?page=${page}&size=${size}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
};
