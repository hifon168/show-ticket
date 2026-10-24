import { defineStore } from 'pinia';
import { authApi } from '@/api';

/** 用户状态：token + 用户信息 + 登录态 */
export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    userInfo: null,
    loaded: false,
  }),
  getters: {
    isLogin: (s) => !!s.token && !!s.userInfo,
    isAdmin: (s) => !!s.userInfo && s.userInfo.role === 1,
  },
  actions: {
    setToken(token) {
      this.token = token;
      localStorage.setItem('token', token);
    },
    logout() {
      this.token = '';
      this.userInfo = null;
      localStorage.removeItem('token');
    },
    /** 拉取当前用户信息（已登录时调用） */
    async fetchUser() {
      if (!this.token) {
        this.loaded = true;
        return null;
      }
      try {
        this.userInfo = await authApi.me();
      } catch (e) {
        this.logout();
      }
      this.loaded = true;
      return this.userInfo;
    },
    async login(payload) {
      const data = await authApi.login(payload);
      this.setToken(data.token);
      this.userInfo = data.user;
      return data;
    },
    async adminLogin(payload) {
      const data = await authApi.adminLogin(payload);
      this.setToken(data.token);
      this.userInfo = data.user;
      return data;
    },
  },
});
