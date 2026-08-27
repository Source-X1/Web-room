const TOKEN_KEY = 'room-booking-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error || 'เกิดข้อผิดพลาด');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
  changePassword: (body) => request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),

  getRooms: () => request('/rooms'),
  createRoom: (body) => request('/rooms', { method: 'POST', body: JSON.stringify(body) }),
  updateRoom: (id, body) => request(`/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteRoom: (id) => request(`/rooms/${id}`, { method: 'DELETE' }),
  getRoomMeta: () => request('/rooms/meta'),
  getAvailability: (params) => request(`/rooms/availability?${new URLSearchParams(params)}`),
  getWeekAvailability: (params) => request(`/rooms/week-availability?${new URLSearchParams(params)}`),
  getAuditLogs: () => request('/audit-logs'),


  getBookings: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    return request(`/bookings?${qs}`);
  },
  createBooking: (body) => request('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  createRecurringBooking: (body) => request('/bookings/recurring', { method: 'POST', body: JSON.stringify(body) }),
  updateBooking: (id, body) => request(`/bookings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateBookingStatus: (id, status, reason) => request(`/bookings/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
  cancelBooking: (id) => request(`/bookings/${id}/cancel`, { method: 'POST' }),
  resetBookings: () => request('/bookings/reset', { method: 'POST' }),
  checkConflicts: (params) => request(`/bookings/check/conflicts?${new URLSearchParams(params)}`),

  getUsers: () => request('/users'),
  approveUser: (id, role) => request(`/users/${id}/approve`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  updateUserRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  getPendingCounts: () => request('/users/pending-count'),

  getNotifications: () => request('/notifications'),
  getUnreadNotificationCount: () => request('/notifications/unread-count'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  getStats: (params) => request(`/stats?${new URLSearchParams(params)}`),
  getDashboard: () => request('/stats/dashboard'),
  exportCsv: (params) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    const token = getToken();
    return fetch(`/api/stats/export?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
};
