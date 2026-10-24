<template>
  <div class="min-h-screen">
    <!-- 顶部筛选栏 -->
    <div class="sticky top-0 z-30 bg-white shadow-card md:top-16">
      <!-- 城市横向选择 -->
      <div class="no-scrollbar flex gap-2 overflow-x-auto px-3 py-2">
        <button
          v-for="c in cityTabs"
          :key="c"
          class="shrink-0 rounded-full px-3 py-1.5 text-xs transition"
          :class="query.city === c ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'"
          @click="setFilter('city', c)"
        >
          {{ c }}
        </button>
      </div>
      <!-- 类型 / 日期 / 排序 -->
      <div class="flex items-center gap-1 border-t border-ink-50 px-2 py-1.5 text-xs">
        <div class="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
          <button
            v-for="c in categoryTabs"
            :key="c.value"
            class="shrink-0 rounded-full px-2.5 py-1"
            :class="query.category === c.value ? 'bg-brand-50 font-semibold text-brand-500' : 'text-ink-700'"
            @click="setFilter('category', c.value)"
          >
            {{ c.label }}
          </button>
        </div>
        <select
          v-model="query.date"
          class="rounded-md border border-ink-100 bg-white px-2 py-1 text-xs outline-none"
          @change="reset"
        >
          <option value="">全部时间</option>
          <option value="today">今天</option>
          <option value="tomorrow">明天</option>
          <option value="weekend">本周末</option>
          <option value="week">近一周</option>
          <option value="month">近一月</option>
        </select>
        <select
          v-model="query.sort"
          class="rounded-md border border-ink-100 bg-white px-2 py-1 text-xs outline-none"
          @change="reset"
        >
          <option value="hot">按热度</option>
          <option value="time">按时间</option>
          <option value="price">按价格</option>
          <option value="new">最新上架</option>
        </select>
      </div>
    </div>

    <PullRefresh class="p-3" @refresh="onRefresh">
      <SkeletonList v-if="loading && !list.length" :count="6" />
      <template v-else>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ShowCard v-for="s in list" :key="s.id" :show="s" />
        </div>

        <EmptyState v-if="!list.length" icon="🎭" text="该筛选条件下暂无演出" />

        <!-- 加载更多 -->
        <div class="py-4 text-center">
          <button v-if="hasMore" class="btn-ghost" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? '加载中...' : '加载更多' }}
          </button>
          <span v-else-if="list.length" class="text-xs text-ink-300">— 没有更多了 —</span>
        </div>
      </template>
    </PullRefresh>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showApi } from '@/api';
import { useConfigStore } from '@/stores/config';
import ShowCard from '@/components/ShowCard.vue';
import SkeletonList from '@/components/SkeletonList.vue';
import EmptyState from '@/components/EmptyState.vue';
import PullRefresh from '@/components/PullRefresh.vue';

const route = useRoute();
const router = useRouter();
const config = useConfigStore();

const cityTabs = computed(() => ['全部', ...config.cities.map((c) => c.name)]);
const categoryTabs = computed(() => [{ value: 'all', label: '全部' }, ...config.categories]);

const query = reactive({
  city: '全部',
  category: 'all',
  date: '',
  sort: 'hot',
  pageNum: 1,
  pageSize: 10,
});

const list = ref([]);
const total = ref(0);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = computed(() => list.value.length < total.value);

/** 组装接口参数：'全部' / 'all' 视为不筛选 */
function buildParams() {
  const p = { pageNum: query.pageNum, pageSize: query.pageSize, sort: query.sort };
  if (query.city !== '全部') p.city = query.city;
  if (query.category !== 'all') p.category = query.category;
  if (query.date) p.date = query.date;
  return p;
}

async function fetchList(append = false) {
  if (append) loadingMore.value = true;
  else loading.value = true;
  try {
    const res = await showApi.list(buildParams());
    total.value = res.total || 0;
    list.value = append ? [...list.value, ...(res.list || [])] : res.list || [];
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function reset() {
  query.pageNum = 1;
  fetchList();
}
function setFilter(key, value) {
  query[key] = value;
  reset();
}
function loadMore() {
  query.pageNum += 1;
  fetchList(true);
}
function onRefresh(done) {
  query.pageNum = 1;
  fetchList().finally(done);
}

// 页面初始化：合并 url query（如首页分类跳转 ?category=concert）
onMounted(async () => {
  if (!config.cities.length) await config.load();
  if (route.query.city) query.city = route.query.city;
  else if (config.currentCity) query.city = config.currentCity;
  if (route.query.category) query.category = route.query.category;
  fetchList();
});

watch(
  () => route.query,
  (q) => {
    if (q.category) {
      query.category = q.category;
      reset();
    }
  }
);
</script>
