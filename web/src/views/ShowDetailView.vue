<template>
  <div class="min-h-screen bg-white pb-36 md:pb-0">
    <NavBar :title="show.title || '演出详情'">
      <template #right>
        <button @click="toggleFav">{{ favorited ? '❤️' : '🤍' }}</button>
      </template>
    </NavBar>

    <!-- 骨架屏 -->
    <div v-if="loading" class="p-3">
      <div class="skeleton h-52 w-full rounded-xl2 md:h-72"></div>
      <div class="skeleton mt-3 h-6 w-3/4"></div>
      <div class="skeleton mt-2 h-4 w-1/2"></div>
      <div class="skeleton mt-4 h-24 w-full"></div>
    </div>

    <template v-else>
      <div class="md:mx-auto md:flex md:max-w-[1100px] md:gap-6 md:p-6">
        <!-- ============ 海报（桌面左侧） ============ -->
        <div class="relative h-52 bg-gradient-to-br from-brand-400 to-accent md:h-80 md:w-80 md:shrink-0 md:rounded-xl2">
          <AppImage
            :src="show.poster"
            :text="show.title"
            img-class="h-full w-full object-cover md:rounded-xl2"
            placeholder-class="text-5xl"
          />
          <span class="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white">
            {{ categoryText }}
          </span>
        </div>

        <!-- ============ 信息区 ============ -->
        <div class="flex-1 p-3 md:p-0">
          <h1 class="text-[19px] font-bold leading-6 md:text-2xl">{{ show.title }}</h1>
          <p v-if="show.subtitle" class="mt-1 text-xs text-ink-500">{{ show.subtitle }}</p>

          <!-- 价格条 -->
          <div class="mt-3 flex items-center justify-between rounded-xl2 bg-brand-50 p-3">
            <div>
              <span class="text-xl font-bold text-brand-500">¥{{ show.min_price }}</span>
              <span class="text-sm text-brand-400"> 起</span>
              <span class="ml-2 text-xs text-ink-500">最高 ¥{{ show.max_price }}</span>
            </div>
            <span class="text-xs text-ink-500">👀 {{ show.view_count }} 人想看</span>
          </div>

          <!-- 演出信息 -->
          <ul class="mt-3 space-y-2 rounded-xl2 bg-ink-50 p-3 text-sm">
            <li class="flex gap-2"><span class="w-14 shrink-0 text-ink-500">艺人</span><span class="flex-1">{{ show.artist || '—' }}</span></li>
            <li class="flex gap-2"><span class="w-14 shrink-0 text-ink-500">时间</span><span class="flex-1">{{ formatDate(show.start_time) }}</span></li>
            <li class="flex gap-2"><span class="w-14 shrink-0 text-ink-500">场馆</span><span class="flex-1">{{ show.venue_name }}</span></li>
            <li class="flex gap-2"><span class="w-14 shrink-0 text-ink-500">地址</span><span class="flex-1">{{ show.city }} {{ show.address }}</span></li>
          </ul>

          <!-- 票档选择 -->
          <div v-if="tiers.length" class="mt-4">
            <h3 class="mb-2 text-sm font-semibold">选择票档</h3>
            <div class="grid gap-2 md:grid-cols-2">
              <button
                v-for="t in tiers"
                :key="t.id"
                class="flex items-center justify-between rounded-xl2 border p-3 text-left transition"
                :class="selectedTier && selectedTier.id === t.id ? 'border-brand-500 bg-brand-50' : 'border-ink-100'"
                @click="selectedTier = t"
              >
                <div>
                  <p class="text-sm font-medium">{{ t.name }}</p>
                  <p class="text-[11px] text-ink-500">{{ t.description || '数量有限' }}</p>
                </div>
                <div class="text-right">
                  <p class="text-[15px] font-bold text-brand-500">¥{{ t.price }}</p>
                  <p class="text-[11px] text-ink-300">剩 {{ t.stock }}</p>
                </div>
              </button>
            </div>
          </div>

          <!-- 数量 -->
          <div class="mt-4 flex items-center gap-3">
            <span class="text-sm">购买数量</span>
            <div class="flex items-center gap-2">
              <button class="h-7 w-7 rounded-full bg-ink-100" @click="qty = Math.max(1, qty - 1)">-</button>
              <span class="w-8 text-center text-sm">{{ qty }}</span>
              <button class="h-7 w-7 rounded-full bg-ink-100" @click="qty = Math.min(6, qty + 1)">+</button>
            </div>
            <span class="text-xs text-ink-300">每单最多 6 张</span>
          </div>

          <!-- 二手在售 -->
          <div v-if="show.resale && show.resale.cnt > 0" class="mt-4 rounded-xl2 bg-white p-3 shadow-card">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold">二手转票 {{ show.resale.cnt }} 个在售</p>
                <p class="text-[11px] text-ink-500">最低 ¥{{ show.resale.min_price }} · 可私聊议价</p>
              </div>
              <router-link :to="{ path: '/market', query: { showId: show.id } }" class="btn-ghost !py-1 text-xs">
                去看看 ›
              </router-link>
            </div>
          </div>

          <!-- 演出介绍 -->
          <div class="mt-4">
            <h3 class="mb-2 text-sm font-semibold">演出介绍</h3>
            <div class="mb-3 overflow-hidden rounded-xl2">
              <AppImage
                :src="show.poster"
                :text="show.title"
                img-class="h-48 w-full object-cover md:h-60"
                placeholder-class="text-4xl"
              />
            </div>
            <p class="whitespace-pre-line text-sm leading-6 text-ink-700">{{ show.description || '暂无简介' }}</p>
          </div>

          <!-- 桌面端购买按钮 -->
          <div class="mt-5 hidden md:block">
            <button class="btn-primary w-full !py-3 text-base" @click="buy">立即购票</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ 移动端底部购买栏 ============ -->
    <div
      class="action-bar flex items-center gap-2 border-t border-ink-100 bg-white px-3 py-2 md:hidden"
    >
      <button class="flex flex-col items-center px-2 text-[11px] text-ink-500" @click="toggleFav">
        <span class="text-lg">{{ favorited ? '❤️' : '🤍' }}</span>收藏
      </button>
      <router-link to="/market" class="flex flex-col items-center px-2 text-[11px] text-ink-500">
        <span class="text-lg">🛒</span>转票
      </router-link>
      <div class="flex-1 text-right">
        <span class="text-xs text-ink-500">合计</span>
        <span class="ml-1 text-lg font-bold text-brand-500">¥{{ totalAmount }}</span>
      </div>
      <button class="btn-primary !px-6 !py-2.5" @click="buy">立即购票</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate, CATEGORY_TEXT } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import AppImage from '@/components/AppImage.vue';

const route = useRoute();
const router = useRouter();
const user = useUserStore();

const loading = ref(true);
const show = ref({});
const tiers = ref([]);
const selectedTier = ref(null);
const favorited = ref(false);
const qty = ref(1);

const categoryText = computed(() => CATEGORY_TEXT[show.value.category] || '演出');
const totalAmount = computed(() =>
  selectedTier.value ? (Number(selectedTier.value.price) * qty.value).toFixed(2) : 0
);

async function load() {
  loading.value = true;
  try {
    const res = await showApi.detail(route.params.id);
    show.value = res;
    tiers.value = res.tiers || [];
    favorited.value = res.favorited;
    selectedTier.value = tiers.value[0] || null;
  } finally {
    loading.value = false;
  }
}

async function toggleFav() {
  if (!user.isLogin) return router.push('/login?redirect=' + route.fullPath);
  const res = await showApi.favorite(show.value.id);
  favorited.value = res.favorited;
  window.$toast && window.$toast(res.favorited ? '已收藏' : '已取消收藏');
}

function buy() {
  if (!user.isLogin) return router.push('/login?redirect=' + route.fullPath);
  router.push({ path: '/seat-select', query: { showId: show.value.id } });
}

onMounted(load);
</script>
