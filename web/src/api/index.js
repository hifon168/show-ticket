/**
 * 统一接口层：axios 实例 + 各业务模块 API
 * 说明：后端统一返回 { code, message, data }，code !== 0 视为业务失败
 */
import axios from 'axios';

const http = axios.create({
  baseURL: '/api',
  timeout: 20000,
});

// 请求拦截：自动带上 token
http.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token') || '';
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// 响应拦截：拆包 data，业务失败统一 toast
http.interceptors.response.use(
  (res) => {
    // 二进制响应（如 Excel 模板下载）不做业务拆包，直接返回 Blob
    if (res.config.responseType === 'blob') return res.data;

    const body = res.data || {};
    if (body.code === 0) return body.data;
    // 业务错误
    const msg = body.message || '请求失败';
    window.$toast && window.$toast(msg);
    return Promise.reject(new Error(msg));
  },
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('token');
      window.$toast && window.$toast('登录已过期，请重新登录');
    } else {
      window.$toast && window.$toast(err.message || '网络异常');
    }
    return Promise.reject(err);
  }
);

/* ============================ 站点配置 ============================ */
export const metaApi = {
  config: () => http.get('/meta/config'),
  cities: () => http.get('/meta/cities'),
};

/* ============================ 用户认证 ============================ */
export const authApi = {
  login: (data) => http.post('/auth/login', data),
  adminLogin: (data) => http.post('/auth/admin-login', data),
  register: (data) => http.post('/auth/register', data),
  checkInvite: (inviteCode) => http.post('/auth/check-invite', { inviteCode }),
  me: () => http.get('/auth/me'),
  updateProfile: (data) => http.put('/auth/profile', data),
  updatePassword: (data) => http.put('/auth/password', data),
};

/* ============================ 演出 ============================ */
export const showApi = {
  home: (params) => http.get('/shows/home', { params }),
  list: (params) => http.get('/shows', { params }),
  search: (params) => http.get('/shows/search', { params }),
  suggest: (params) => http.get('/shows/search/suggest', { params }),
  detail: (id) => http.get(`/shows/${id}`),
  favorite: (id) => http.post(`/shows/${id}/favorite`),
};

/* ============================ 订单 / 支付 ============================ */
export const orderApi = {
  create: (data) => http.post('/orders', data),
  list: (params) => http.get('/orders', { params }),
  sold: (params) => http.get('/orders/sold', { params }),
  detail: (id) => http.get(`/orders/${id}`),
  pay: (id, data) => http.post(`/orders/${id}/pay`, data),
  cancel: (id) => http.post(`/orders/${id}/cancel`),
  confirm: (id) => http.post(`/orders/${id}/confirm`),
  refund: (id, data) => http.post(`/orders/${id}/refund`, data),
};

/* ============================ 支付 ============================ */
export const paymentApi = {
  /** 测试模式：应用内「模拟支付」确认（等同渠道异步回调） */
  mockConfirm: (orderId) => http.post('/pay/mock/confirm', { orderId }),
};

/* ============================ 二手票 / 挂票 ============================ */
export const ticketApi = {
  list: (params) => http.get('/tickets', { params }),
  mine: (params) => http.get('/tickets/mine', { params }),
  detail: (id) => http.get(`/tickets/${id}`),
  create: (data) => http.post('/tickets', data),
  update: (id, data) => http.put(`/tickets/${id}`, data),
  setStatus: (id, status) => http.post(`/tickets/${id}/status`, { status }),
  remove: (id) => http.delete(`/tickets/${id}`),
};

/* ============================ 用户中心 ============================ */
export const userApi = {
  stats: () => http.get('/user/stats'),
  favorites: (params) => http.get('/user/favorites', { params }),
  history: (params) => http.get('/user/history', { params }),
  clearHistory: () => http.delete('/user/history'),
  deleteHistory: (showId) => http.delete(`/user/history/${showId}`),
  messages: (params) => http.get('/user/messages', { params }),
  addMessage: (data) => http.post('/user/messages', data),
  publicMessages: () => http.get('/user/messages/public'),
};

/* ============================ 私聊转票 ============================ */
export const chatApi = {
  start: (data) => http.post('/chat/start', data),
  conversations: () => http.get('/chat/conversations'),
  messages: (id) => http.get(`/chat/${id}/messages`),
  send: (id, data) => http.post(`/chat/${id}/send`, data),
  unread: () => http.get('/chat/unread'),
};

/* ============================ 后台管理 ============================ */
export const adminApi = {
  stats: () => http.get('/admin/stats'),

  shows: (params) => http.get('/admin/shows', { params }),
  showDetail: (id) => http.get(`/admin/shows/${id}`),
  createShow: (data) => http.post('/admin/shows', data),
  updateShow: (id, data) => http.put(`/admin/shows/${id}`, data),
  deleteShow: (id) => http.delete(`/admin/shows/${id}`),

  createTier: (data) => http.post('/admin/tiers', data),
  updateTier: (id, data) => http.put(`/admin/tiers/${id}`, data),
  deleteTier: (id) => http.delete(`/admin/tiers/${id}`),

  inviteCodes: (params) => http.get('/admin/invite-codes', { params }),
  createInviteCodes: (data) => http.post('/admin/invite-codes', data),
  deleteInviteCode: (id) => http.delete(`/admin/invite-codes/${id}`),

  users: (params) => http.get('/admin/users', { params }),
  setUserStatus: (id, status) => http.put(`/admin/users/${id}/status`, { status }),

  messages: (params) => http.get('/admin/messages', { params }),
  auditMessage: (id, data) => http.put(`/admin/messages/${id}`, data),
  deleteMessage: (id) => http.delete(`/admin/messages/${id}`),

  orders: (params) => http.get('/admin/orders', { params }),
  /** 下载订单导入模板（返回 blob） */
  orderTemplate: () => http.get('/admin/orders/template', { responseType: 'blob' }),
  /** Excel 批量导入订单 */
  importOrders: (formData) =>
    http.post('/admin/orders/import', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }),
  tickets: (params) => http.get('/admin/tickets', { params }),
  setTicketStatus: (id, status) => http.post(`/admin/tickets/${id}/status`, { status }),
  deleteTicket: (id) => http.delete(`/admin/tickets/${id}`),

  banners: () => http.get('/admin/banners'),
  createBanner: (data) => http.post('/admin/banners', data),
  updateBanner: (id, data) => http.put(`/admin/banners/${id}`, data),
  deleteBanner: (id) => http.delete(`/admin/banners/${id}`),

  syncLogs: (params) => http.get('/admin/sync-logs', { params }),
  runSync: () => http.post('/admin/sync'),
  syncStatus: () => http.get('/admin/sync-status'),
};

export default http;
