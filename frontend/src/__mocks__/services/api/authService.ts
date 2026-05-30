export const authService = {
  login: () => Promise.resolve({ success: true, token: 'test', user: {} }),
  register: () => Promise.resolve({ success: true }),
  getProfile: () => Promise.resolve({ success: true, user: null }),
  refreshToken: () => Promise.resolve({ success: true, token: 'refreshed' }),
  changePassword: () => Promise.resolve({ success: true }),
};
