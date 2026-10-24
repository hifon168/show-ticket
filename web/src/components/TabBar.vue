<template>
  <!-- 移动端底部导航（桌面端隐藏，改用顶部导航） -->
  <nav
    class="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-100 bg-white md:hidden"
  >
    <ul class="flex">
      <li v-for="item in tabs" :key="item.path" class="flex-1">
        <router-link
          :to="item.path"
          class="flex flex-col items-center justify-center py-1.5 text-[11px] transition"
          :class="active === item.path ? 'text-brand-500' : 'text-ink-500'"
        >
          <span class="text-[20px] leading-6">{{ item.icon }}</span>
          <span>{{ item.text }}</span>
        </router-link>
      </li>
    </ul>
  </nav>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const tabs = [
  { path: '/', icon: '🏠', text: '首页' },
  { path: '/shows', icon: '🎫', text: '演出' },
  { path: '/market', icon: '🛒', text: '集市' },
  { path: '/orders', icon: '📋', text: '订单' },
  { path: '/user', icon: '👤', text: '我的' },
];
const route = useRoute();
const active = computed(() => route.path);
</script>
