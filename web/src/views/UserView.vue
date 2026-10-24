<template>
  <div class="min-h-screen pb-20">
    <!-- ============ 头部用户信息 ============ -->
    <div class="bg-brand-gradient px-4 pb-8 pt-6 text-white">
      <div class="flex items-center gap-3">
        <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/25 text-xl font-bold">
          {{ (user.userInfo?.nickname || 'U').slice(0, 1) }}
        </span>
        <div class="flex-1">
          <p class="text-lg font-bold">{{ user.userInfo?.nickname }}</p>
          <p class="text-xs opacity-90">{{ maskPhone(user.userInfo?.phone) }}</p>
        </div>
        <router-link to="/profile" class="rounded-full bg-white/20 px-3 py-1 text-xs">编辑资料</router-link>
      </div>

      <!-- 统计 -->
      <div class="mt-4 grid grid-cols-4 gap-2 text-center">
        <div v-for="s in statItems" :key="s.text">
          <p class="text-lg font-bold">{{ stats[s.key] || 0 }}</p>
          <p class="text-[11px] opacity-90">{{ s.text }}</p>
        </div>
      </div>
    </div>

    <div class="-mt-4 px-3">
      <!-- ============ 我的订单入口 ============ -->
      <div class="card p-3">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">我的订单</h3>
          <router-link to="/orders" class="text-xs text-ink-500">全部订单 ›</router-link>
        </div>
        <div class="grid grid-cols-4 text-center text-[11px]">
          <router-link v-for="o in orderEntries" :key="o.status" :to="{ path: '/orders', query: { tab: o.status } }" class="py-1">
            <div class="text-xl">{{ o.icon }}</div>
            <div class="mt-0.5 text-ink-700">{{ o.text }}</div>
          </router-link>
        </div>
      </div>

      <!-- ============ 功能菜单 ============ -->
      <div class="card mt-3 divide-y divide-ink-50">
        <router-link v-for="m in menus" :key="m.text" :to="m.path" class="flex items-center gap-3 p-3.5 text-sm">
          <span class="text-lg">{{ m.icon }}</span>
          <span class="flex-1">{{ m.text }}</span>
          <span class="text-ink-300">›</span>
        </router-link>
      </div>

      <!-- ============ 管理员入口 ============ -->
      <router-link
        v-if="user.isAdmin"
        to="/admin/dashboard"
        class="card mt-3 flex items-center gap-3 p-3.5 text-sm"
      >
        <span class="text-lg">⚙️</span>
        <span class="flex-1 font-semibold text-brand-500">后台管理系统</span>
        <span class="text-ink-300">›</span>
      </router-link>

      <button class="btn-ghost mt-4 w-full !py-3 text-brand-500" @click="logout">退出登录</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { userApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { maskPhone } from '@/utils';

const router = useRouter();
const user = useUserStore();

const stats = reactive({ favorites: 0, history: 0, tickets: 0, pendingOrders: 0 });
const statItems = [
  { key: 'favorites', text: '收藏' },
  { key: 'history', text: '足迹' },
  { key: 'tickets', text: '挂票' },
  { key: 'pendingOrders', text: '待支付' },
];
const orderEntries = [
  { status: 0, icon: '⏳', text: '待支付' },
  { status: 1, icon: '🎫', text: '已支付' },
  { status: 3, icon: '✅', text: '已完成' },
  { status: 4, icon: '↩️', text: '退款' },
];
const menus = [
  { path: '/market', icon: '🛒', text: '二手票务集市' },
  { path: '/mine/tickets', icon: '💰', text: '我挂出的票' },
  { path: '/favorites', icon: '❤️', text: '我的收藏' },
  { path: '/history', icon: '🕘', text: '浏览记录' },
  { path: '/chat', icon: '💬', text: '私聊消息' },
  { path: '/messages', icon: '📝', text: '我的留言' },
  { path: '/profile', icon: '👤', text: '个人资料' },
];

async function loadStats() {
  try {
    Object.assign(stats, await userApi.stats());
  } catch (e) {
    /* ignore */
  }
}

function logout() {
  user.logout();
  router.replace('/login');
}

onMounted(loadStats);
</script>
