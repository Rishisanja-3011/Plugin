import api from './axios';

export const energyApi = {
  getCurrent: (region = 'IN-WE') => api.get('/energy/current', { params: { region } }),
  getForecast: (region = 'IN-WE', hours = 24) => api.get('/energy/forecast', { params: { region, hours } }),
  getChargingOptions: (payload) => api.post('/optimization/charging-options', payload),
  getOperatorDashboard: (region = 'IN-WE', stationId) =>
    api.get('/operator/energy/dashboard', { params: { region, ...(stationId ? { stationId } : {}) } }),
  saveOperatorDecision: (payload) => api.post('/operator/energy/decisions', payload),
  getGridDashboard: (region = 'IN-WE', stationId) =>
    api.get('/grid/dashboard', { params: { region, ...(stationId ? { stationId } : {}) } }),
  publishGridSignal: (payload) => api.post('/grid/signals', payload),
};
