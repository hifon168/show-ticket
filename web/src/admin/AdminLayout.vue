<template>
  <div class="flex min-h-screen bg-ink-50">
    <!-- ============ 侧边栏（桌面） ============ -->
    <aside class="hidden w-52 shrink-0 bg-ink-900 text-white md:flex md:flex-col">
      <div class="flex h-16 items-center gap-2 px-5 text-lg font-bold">
        <span>🎫</span><span>票星球后台</span>
      </div>
      <nav class="flex-1 px-2">
        <router-link
          v-for="m in menus"
          :key="m.path"
          :to="m.path"
          class="mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition"
          :class="$route.path === m.path ? 'bg-brand-500' : 'hover:bg-white/10'"
        >
          <span>{{ m.icon }}</span><span>{{ m.text }}</span>
        </router-link>
      </nav>
      <div class="border-t border-white/10 p-3 text-xs">
        <p>{{ user.userInfo?.nickname }}</p>
        <button class="mt-2 w-full rounded bg-white/10 py-1.5 hover:bg-white/20" @click="goFront">返回前台</button>
        <button class="mt-1 w-full rounded bg-white/10 py-1.5 hover:bg-white/20" @click="logout">退出登录</button>
      </div>
    </aside>

    <!-- ============ 主内容 ============ -->
    <div class="flex min-w-0 flex-1 flex-col">
      <!-- 移动端顶栏 -->
      <header class="flex h-14 items-center gap-2 bg-ink-900 px-3 text-white md:hidden">
        <span class="text-lg">🎫</span>
        <span class="flex-1 font-semibold">票星球后台</span>
        <button @click="drawer = !drawer">☰</button>
      </header>

      <!-- 移动端抽屉 -->
      <div v-if="drawer" class="fixed inset-0 z-50 flex md:hidden" @click.self="drawer = false">
        <div class="w-56 bg-ink-900 p-3 text-white">
          <router-link
            v-for="m in menus"
            :key="m.path"
            :to="m.path"
            class="mb-1 block rounded-lg px-3 py-2.5 text-sm"
            :class="$route.path === m.path ? 'bg-brand-500' : ''"
            @click="drawer = false"
          >
            {{ m.icon }} {{ m.text }}
          </router-link>
          <button class="mt-3 w-full rounded bg-white/10 py-2 text-sm" @click="goFront">返回前台</button>
          <button class="mt-1 w-full rounded bg-white/10 py-2 text-sm" @click="logout">退出登录</button>
        </div>
      </div>

      <main class="flex-1 overflow-x-auto p-3 md:p-6">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const user = useUserStore();
const drawer = ref(false);

const menus = [
  { path: '/admin/dashboard', icon: '📊', text: '数据概览' },
  { path: '/admin/shows', icon: '🎭', text: '演出管理' },
  { path: '/admin/invite', icon: '🎟️', text: '邀请码管理' },
  { path: '/admin/users', icon: '👥', text: '用户管理' },
  { path: '/admin/messages', icon: '📝', text: '留言审核' },
  { path: '/admin/orders', icon: '📋', text: '订单管理' },
  { path: '/admin/tickets', icon: '🛒', text: '二手票管理' },
  { path: '/admin/banners', icon: '🖼️', text: '轮播管理' },
];

function logout() {
  user.logout();
  router.replace('/admin/login');
}
function goFront() {
  router.push('/');
}
</script>
