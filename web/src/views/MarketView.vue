<template>
  <div class="min-h-screen">
    <NavBar title="二手票务集市">
      <template #right>
        <router-link to="/sell" class="text-xs text-brand-500">挂票</router-link>
      </template>
    </NavBar>

    <!-- 筛选 -->
    <div class="sticky top-12 z-30 bg-white px-3 py-2 shadow-card md:top-16">
      <div class="flex items-center gap-2">
        <div class="flex h-9 flex-1 items-center gap-2 rounded-full bg-ink-50 px-3">
          <span class="text-ink-300">🔍</span>
          <input v-model="query.keyword" class="w-full bg-transparent text-sm outline-none" placeholder="搜索演出/艺人/场馆"
                 @keyup.enter="reset" />
        </div>
        <select v-model="query.sort" class="h-9 rounded-full border border-ink-100 bg-white px-2 text-xs outline-none" @change="reset">
          <option value="time">最新发布</option>
          <option value="price_asc">价格从低到高</option>
          <option value="price_desc">价格从高到低</option>
          <option value="discount">折扣最低</option>
        </select>
      </div>
      <div class="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
        <button
          v-for="c in cityTabs"
          :key="c"
          class="shrink-0 rounded-full px-3 py-1 text-xs"
          :class="query.city === c ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'"
          @click="((query.city = c), reset())"
        >
          {{ c }}
        </button>
      </div>
    </div>

    <PullRefresh class="p-3" @refresh="onRefresh">
      <SkeletonList v-if="loading && !list.length" :count="5" />
      <template v-else>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <router-link v-for="t in list" :key="t.id" :to="`/ticket/${t.id}`" class="card p-3">
            <div class="flex gap-3">
              <div
                class="flex h-[86px] w-[64px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-brand-400 text-lg font-bold text-white"
              >
                <AppImage
                  :src="t.poster"
                  :text="t.show_title"
                  img-class="h-full w-full rounded-lg object-cover"
                />
              </div>
              <div class="min-w-0 flex-1">
                <p class="line-1 text-sm font-semibold">{{ t.show_title }}</p>
                <p class="mt-0.5 line-1 text-[11px] text-ink-500">{{ t.tier_name }} {{ t.seat_info }}</p>
                <p class="line-1 text-[11px] text-ink-500">📍 {{ t.city }} · {{ t.venue_name }}</p>
                <p class="line-1 text-[11px] text-ink-500">🕒 {{ formatDate(t.start_time, false) }}</p>
                <div class="mt-1 flex items-center gap-2">
                  <span class="text-[15px] font-bold text-brand-500">¥{{ t.sell_price }}</span>
                  <span v-if="t.original_price > t.sell_price" class="text-[11px] text-ink-300 line-through">
                    ¥{{ t.original_price }}
                  </span>
                  <span v-if="discount(t) < 10" class="tag bg-warn/15 text-warn">{{ discount(t) }}折</span>
                  <span class="tag bg-ink-50 text-ink-500">剩{{ t.quantity }}张</span>
                </div>
              </div>
            </div>
            <div class="mt-2 flex items-center justify-between border-t border-ink-50 pt-2">
              <div class="text-[11px] text-ink-500">
                <span>👤 {{ t.seller_nickname }}</span>
                <span class="ml-2">{{ fromNow(t.created_at) }}</span>
              </div>
              <div class="flex shrink-0 gap-1.5">
                <template v-if="t.seller_id !== user.userInfo?.id">
                  <button class="btn-ghost !px-2.5 !py-1 text-[11px]" @click.stop.prevent="toChat(t)">💬 私聊</button>
                  <button
                    class="btn-primary !px-3 !py-1 text-[11px]"
                    :disabled="t.quantity <= 0"
                    @click.stop.prevent="toBuy(t)"
                  >
                    {{ t.quantity > 0 ? '立即购买' : '已售罄' }}
                  </button>
                </template>
                <span v-else class="tag bg-ink-100 text-ink-500">我发布的</span>
              </div>
            </div>
          </router-link>
        </div>

        <EmptyState v-if="!list.length" icon="🛒" text="集市暂无在售票品">
          <router-link to="/sell" class="btn-primary mt-3">我要挂票</router-link>
        </EmptyState>

        <div class="py-4 text-center">
          <button v-if="hasMore" class="btn-ghost" @click="loadMore">{{ loadingMore ? '加载中...' : '加载更多' }}</button>
          <span v-else-if="list.length" class="text-xs text-ink-300">— 没有更多了 —</span>
        </div>
      </template>
    </PullRefresh>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ticketApi, chatApi } from '@/api';
import { useConfigStore } from '@/stores/config';
import { useUserStore } from '@/stores/user';
import { formatDate, fromNow } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import SkeletonList from '@/components/SkeletonList.vue';
import EmptyState from '@/components/EmptyState.vue';
import PullRefresh from '@/components/PullRefresh.vue';
import AppImage from '@/components/AppImage.vue';

const route = useRoute();
const router = useRouter();
const config = useConfigStore();
const user = useUserStore();

const cityTabs = computed(() => ['全部', ...config.cities.map((c) => c.name)]);
const query = reactive({ city: '全部', keyword: '', sort: 'time', pageNum: 1, pageSize: 10 });

const list = ref([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = computed(() => list.value.length < total.value);

function discount(t) {
  if (!t.original_price) return 10;
  return Math.round((t.sell_price / t.original_price) * 100) / 10;
}

async function fetchList(append = false) {
  append ? (loadingMore.value = true) : (loading.value = true);
  try {
    const params = { pageNum: query.pageNum, pageSize: query.pageSize, sort: query.sort };
    if (query.city !== '全部') params.city = query.city;
    if (query.keyword) params.keyword = query.keyword;
    if (route.query.showId) params.showId = route.query.showId;
    const res = await ticketApi.list(params);
    total.value = res.total;
    list.value = append ? [...list.value, ...res.list] : res.list;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function reset() {
  query.pageNum = 1;
  fetchList();
}
function loadMore() {
  query.pageNum += 1;
  fetchList(true);
}
function onRefresh(done) {
  query.pageNum = 1;
  fetchList().finally(done);
}

/** 集市卡片直接下单：未登录先跳登录，登录后进确认页 */
function toBuy(t) {
  if (!user.isLogin) return router.push('/login?redirect=' + route.fullPath);
  router.push({ path: '/confirm', query: { ticketId: t.id, qty: 1 } });
}

/** 集市卡片直接发起私聊 */
async function toChat(t) {
  if (!user.isLogin) return router.push('/login?redirect=' + route.fullPath);
  const conv = await chatApi.start({ ticketId: t.id });
  router.push(`/chat/${conv.id}`);
}

onMounted(async () => {
  if (!config.cities.length) await config.load();
  query.city = config.currentCity || '全部';
  fetchList();
});
</script>
