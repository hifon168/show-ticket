<template>
  <div class="app-shell min-h-screen bg-ink-50">
    <!-- ================= 桌面端顶部导航（≥768px 显示） ================= -->
    <header v-if="!isAdmin" class="sticky top-0 z-40 hidden border-b border-ink-100 bg-white md:block">
      <div class="mx-auto flex h-16 max-w-[1200px] items-center gap-6 px-6">
        <router-link to="/" class="flex shrink-0 items-center gap-2">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient text-white">🎫</span>
          <span class="text-lg font-bold">票星球</span>
        </router-link>

        <nav class="flex items-center gap-1 text-sm">
          <router-link
            v-for="n in navs"
            :key="n.path"
            :to="n.path"
            class="rounded-lg px-3 py-2 text-ink-700 transition hover:bg-ink-50"
            :class="route.path === n.path ? 'bg-brand-50 font-semibold text-brand-500' : ''"
          >
            {{ n.text }}
          </router-link>
        </nav>

        <div class="flex-1">
          <div
            class="flex h-10 items-center gap-2 rounded-full border border-ink-100 bg-ink-50 px-4"
            @click="$router.push('/search')"
          >
            <span class="text-ink-300">🔍</span>
            <input
              :value="keyword"
              readonly
              placeholder="搜索演出 / 艺人 / 场馆"
              class="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div class="flex shrink-0 items-center gap-3 text-sm">
          <button class="btn-ghost" @click="pickCity">📍 {{ city }}</button>
          <router-link v-if="!user.isLogin" to="/login" class="btn-primary">登录 / 注册</router-link>
          <div v-else class="flex items-center gap-2">
            <router-link to="/user" class="flex items-center gap-2">
              <span
                class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600"
              >
                {{ (user.userInfo.nickname || 'U').slice(0, 1) }}
              </span>
              <span class="hidden lg:inline">{{ user.userInfo.nickname }}</span>
            </router-link>
            <button class="text-xs text-ink-300 hover:text-ink-500" @click="user.logout()">退出</button>
          </div>
        </div>
      </div>
    </header>

    <!-- ================= 页面主体 ================= -->
    <main :class="isAdmin ? '' : 'pb-16 md:pb-0'">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- 移动端底部 Tab -->
    <TabBar v-if="!isAdmin" />
    <AppToast ref="toastRef" />

    <!-- 城市选择弹层 -->
    <div v-if="cityPicker" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" @click.self="cityPicker = false">
      <div class="w-full max-w-lg rounded-t-2xl bg-white p-4 md:rounded-2xl">
        <h3 class="mb-3 text-center font-semibold">选择城市</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in config.cities"
            :key="c.id"
            class="rounded-full px-3 py-1.5 text-sm transition"
            :class="c.name === city ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100'"
            @click="selectCity(c.name)"
          >
            {{ c.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import TabBar from '@/components/TabBar.vue';
import AppToast from '@/components/AppToast.vue';
import { useUserStore } from '@/stores/user';
import { useConfigStore } from '@/stores/config';

const route = useRoute();
const router = useRouter();
const user = useUserStore();
const config = useConfigStore();

const navs = [
  { path: '/', text: '首页' },
  { path: '/shows', text: '演出' },
  { path: '/market', text: '二手集市' },
  { path: '/orders', text: '我的订单' },
  { path: '/user', text: '个人中心' },
];

const isAdmin = computed(() => route.path.startsWith('/admin'));
const city = computed(() => config.currentCity);
const keyword = ref('');
const cityPicker = ref(false);
const toastRef = ref(null);

function pickCity() {
  cityPicker.value = true;
}
function selectCity(name) {
  config.setCity(name);
  cityPicker.value = false;
}

onMounted(async () => {
  await config.load();
  if (localStorage.getItem('token')) await user.fetchUser();
});
</script>
