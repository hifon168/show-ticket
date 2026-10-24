<template>
  <div class="min-h-screen">
    <!-- ============ 移动端头部：城市 + 搜索 ============ -->
    <div class="sticky top-0 z-30 bg-brand-gradient px-3 pb-3 pt-3 md:hidden">
      <div class="flex items-center gap-2">
        <button class="flex items-center text-sm text-white" @click="cityPicker = true">
          📍 {{ city }} <span class="ml-0.5 text-[10px]">▾</span>
        </button>
        <div class="flex h-9 flex-1 items-center gap-2 rounded-full bg-white/95 px-3" @click="goSearch">
          <span class="text-ink-300">🔍</span>
          <span class="text-sm text-ink-300">搜索演出 / 艺人 / 场馆</span>
        </div>
      </div>
    </div>

    <PullRefresh class="px-3 pb-4" :loading="loading" @refresh="onRefresh">
      <!-- ============ 轮播（前三个热门演出） ============ -->
      <section class="mt-3">
        <div class="relative h-[72px] overflow-hidden rounded-xl2 md:h-32">
          <div
            v-if="topHot.length"
            class="flex h-full transition-transform duration-500"
            :style="{ transform: `translateX(-${current * 100}%)` }"
          >
            <router-link
              v-for="s in topHot"
              :key="s.id"
              :to="`/show/${s.id}`"
              class="relative h-full w-full shrink-0"
            >
              <AppImage :src="s.poster" :text="s.title" img-class="h-full w-full object-cover" />
              <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white">
                <p class="line-1 text-sm font-bold">{{ s.title }}</p>
                <p class="line-1 text-[11px] opacity-90">{{ s.city }} · {{ s.venue_name }} · ¥{{ s.min_price }} 起</p>
              </div>
            </router-link>
          </div>
          <div v-else class="skeleton h-full w-full"></div>
          <!-- 指示点 -->
          <div class="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1.5">
            <span
              v-for="(s, i) in topHot"
              :key="i"
              class="h-1.5 rounded-full bg-white transition-all"
              :class="i === current ? 'w-4 opacity-100' : 'w-1.5 opacity-60'"
            ></span>
          </div>
        </div>
      </section>

      <!-- ============ 分类导航 ============ -->
      <section class="mt-4 grid grid-cols-5 gap-y-3 rounded-xl2 bg-white p-3 shadow-card">
        <button
          v-for="c in categories"
          :key="c.value"
          class="flex flex-col items-center gap-1"
          @click="$router.push({ path: '/shows', query: { category: c.value } })"
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-xl">{{ c.icon }}</span>
          <span class="text-xs text-ink-700">{{ c.label }}</span>
        </button>
      </section>

      <!-- ============ 快捷入口：二手集市 / 我要卖票 ============ -->
      <section class="mt-3 grid grid-cols-2 gap-3">
        <router-link to="/market" class="flex items-center gap-2 rounded-xl2 bg-white p-3 shadow-card">
          <span class="text-2xl">🛒</span>
          <div>
            <p class="text-sm font-semibold">二手票务集市</p>
            <p class="text-[11px] text-ink-500">低价转票 · 私聊议价</p>
          </div>
        </router-link>
        <router-link to="/sell" class="flex items-center gap-2 rounded-xl2 bg-white p-3 shadow-card">
          <span class="text-2xl">💰</span>
          <div>
            <p class="text-sm font-semibold">我要挂票</p>
            <p class="text-[11px] text-ink-500">闲置票快速变现</p>
          </div>
        </router-link>
      </section>

      <!-- ============ 即将上演（横向滚动） ============ -->
      <section class="mt-5">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[17px] font-bold">⏰ 即将上演</h2>
          <router-link to="/shows" class="text-xs text-ink-500">更多 ›</router-link>
        </div>
        <div v-if="loading" class="no-scrollbar flex gap-3 overflow-x-auto">
          <div v-for="i in 3" :key="i" class="w-40 shrink-0">
            <div class="skeleton h-52 w-full rounded-xl2"></div>
          </div>
        </div>
        <div v-else class="no-scrollbar flex gap-3 overflow-x-auto pb-1">
          <router-link
            v-for="s in upcoming"
            :key="s.id"
            :to="`/show/${s.id}`"
            class="w-40 shrink-0 overflow-hidden rounded-xl2 bg-white shadow-card md:w-48"
          >
            <div class="flex h-32 items-center justify-center bg-gradient-to-br from-brand-300 to-accent text-2xl font-bold text-white md:h-40">
              <AppImage :src="s.poster" :text="s.title" placeholder-class="text-2xl" />
            </div>
            <div class="p-2">
              <p class="line-1 text-[13px] font-semibold">{{ s.title }}</p>
              <p class="mt-0.5 line-1 text-[11px] text-ink-500">{{ formatDate(s.start_time, false) }}</p>
              <p class="mt-1 text-[13px] font-bold text-brand-500">¥{{ s.min_price }} 起</p>
            </div>
          </router-link>
        </div>
      </section>

      <!-- ============ 近期上新榜单 ============ -->
      <section class="mt-5">
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-[17px] font-bold">🆕 近期上新榜</h2>
          <span class="text-xs text-ink-300">每日同步更新</span>
        </div>
        <div class="card divide-y divide-ink-50">
          <router-link
            v-for="(s, i) in newest.slice(0, 6)"
            :key="s.id"
            :to="`/show/${s.id}`"
            class="flex items-center gap-3 p-3"
          >
            <span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
              :class="i < 3 ? 'bg-brand-500 text-white' : 'bg-ink-100 text-ink-500'"
            >
              {{ i + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="line-1 text-sm font-medium">{{ s.title }}</p>
              <p class="line-1 text-[11px] text-ink-500">{{ s.city }} · {{ s.venue_name }}</p>
            </div>
            <span class="shrink-0 text-xs font-semibold text-brand-500">¥{{ s.min_price }}起</span>
          </router-link>
          <div v-if="loading" class="p-3"><div class="skeleton h-5 w-full"></div></div>
        </div>
      </section>

      <!-- ============ 热门推荐（除轮播前三个外的其余热门） ============ -->
      <section class="mt-5">
        <h2 class="mb-2 text-[17px] font-bold">🔥 热门推荐</h2>
        <SkeletonList v-if="loading" :count="4" />
        <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ShowCard v-for="s in restHot" :key="s.id" :show="s" />
        </div>
        <EmptyState v-if="!loading && !restHot.length" icon="🎭" text="暂无演出数据" />
      </section>
    </PullRefresh>

    <!-- 城市选择弹层（移动端） -->
    <div v-if="cityPicker" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40" @click.self="cityPicker = false">
      <div class="w-full max-w-lg rounded-t-2xl bg-white p-4">
        <h3 class="mb-3 text-center font-semibold">选择城市</h3>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="c in config.cities"
            :key="c.id"
            class="rounded-full px-3 py-1.5 text-sm"
            :class="c.name === city ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'"
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { showApi } from '@/api';
import { useConfigStore } from '@/stores/config';
import { formatDate } from '@/utils';
import ShowCard from '@/components/ShowCard.vue';
import SkeletonList from '@/components/SkeletonList.vue';
import EmptyState from '@/components/EmptyState.vue';
import PullRefresh from '@/components/PullRefresh.vue';
import AppImage from '@/components/AppImage.vue';

const router = useRouter();
const config = useConfigStore();

const loading = ref(true);
const upcoming = ref([]);
const newest = ref([]);
const hot = ref([]);
const current = ref(0);
const cityPicker = ref(false);

const city = computed(() => config.currentCity);
const categories = computed(() => config.categories);
// 轮播展示前三个热门演出
const topHot = computed(() => hot.value.slice(0, 3));
const restHot = computed(() => hot.value.slice(3));

let timer = null;

async function loadData() {
  loading.value = true;
  try {
    const data = await showApi.home({ city: city.value });
    upcoming.value = data.upcoming || [];
    newest.value = data.newest || [];
    hot.value = data.hot || [];
  } finally {
    loading.value = false;
  }
}

function onRefresh(done) {
  loadData().finally(done);
}

function goSearch() {
  router.push('/search');
}
function selectCity(name) {
  config.setCity(name);
  cityPicker.value = false;
  loadData();
}

// 轮播自动播放
function startAuto() {
  stopAuto();
  timer = setInterval(() => {
    if (topHot.value.length) current.value = (current.value + 1) % topHot.value.length;
  }, 4000);
}
function stopAuto() {
  clearInterval(timer);
}

onMounted(() => {
  loadData();
  startAuto();
});
onBeforeUnmount(stopAuto);
</script>
