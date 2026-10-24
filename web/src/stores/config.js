import { defineStore } from 'pinia';
import { metaApi } from '@/api';

/** 站点全局配置：城市、分类、当前城市、轮播 */
export const useConfigStore = defineStore('config', {
  state: () => ({
    cities: [],
    categories: [],
    banners: [],
    currentCity: localStorage.getItem('city') || '北京',
  }),
  actions: {
    async load() {
      try {
        const data = await metaApi.config();
        this.cities = data.cities || [];
        this.categories = data.categories || [];
        this.banners = data.banners || [];
      } catch (e) {
        /* 忽略：接口不可用时页面仍可渲染 */
      }
    },
    setCity(city) {
      this.currentCity = city;
      localStorage.setItem('city', city);
    },
  },
});
