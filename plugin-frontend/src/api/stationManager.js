import api from './axios';

export const stationManagerApi = {
  getReferenceData: () => api.get('/station-manager/reference-data'),
  trackApplication: (referenceId) => api.get(`/station-manager/status/${referenceId}`),
  getMyApplication: () => api.get('/station-manager/application'),
  submitApplication: (data) => api.post('/station-manager/application', data, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  setupAccess: (token, newPassword, confirmPassword) => api.post('/station-manager/access/setup', {
    token,
    newPassword,
    confirmPassword,
  }),
  refreshSession: () => api.post('/station-manager/session'),
};
