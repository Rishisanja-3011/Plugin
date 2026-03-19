import api from './axios';

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/profile'),
  updateProfile: (data) => api.put('/profile', data),
  deleteVehicle: (id) => api.delete(`/profile/vehicles/${id}`),
  changePassword: (data) => api.post('/profile/change-password', data),
  deleteAccount: (password) => api.post('/profile/delete', { password }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  sendOtp: (email, deliveryMethod) => api.post('/auth/forgot-password/send-otp', { email, deliveryMethod }),
  verifyOtp: (email, otp) => api.post('/auth/forgot-password/verify-otp', { email, otp }),
  resetPassword: (data) => api.post('/auth/forgot-password/reset', data),
  confirmRegistrationOtp: (email, otp) => api.post('/auth/confirm-otp', { email, otp }),
  resendRegistrationOtp: (email) => api.post('/auth/resend-otp', { email }),
};
