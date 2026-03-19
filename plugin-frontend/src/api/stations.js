import api from './axios';

export const stationsApi = {
  getAll: (page = 0, size = 20) => api.get(`/stations?page=${page}&size=${size}`),
  search: (q, page = 0, size = 20) => api.get(`/stations/search?q=${encodeURIComponent(q)}&page=${page}&size=${size}`),
  getById: (id) => api.get(`/stations/${id}`),
  getChargingPoints: (id) => api.get(`/stations/${id}/charging-points`),
  getPricing: (id) => api.get(`/stations/${id}/pricing`),
  getLiveSummary: () => api.get('/stations/live-summary'),
};
