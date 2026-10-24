<template>
  <div class="min-h-screen bg-white">
    <!-- 搜索栏 -->
    <div class="sticky top-0 z-30 flex items-center gap-2 border-b border-ink-100 bg-white px-3 py-2">
      <button class="h-8 w-8 shrink-0" @click="$router.back()">‹</button>
      <div class="flex h-9 flex-1 items-center gap-2 rounded-full bg-ink-50 px-3">
        <span class="text-ink-300">🔍</span>
        <input
          v-model="keyword"
          class="w-full bg-transparent text-sm outline-none"
          placeholder="搜索演出 / 艺人 / 场馆"
          @keyup.enter="doSearch"
          @input="onInput"
        />
        <button v-if="keyword" class="text-ink-300" @click="clear">✕</button>
      </div>
      <button class="shrink-0 text-sm text-brand-500" @click="doSearch">搜索</button>
    </div>

    <!-- 联想词 -->
    <ul v-if="keyword && !searched" class="px-3">
      <li
        v-for="s in suggests"
        :key="s"
        class="flex items-center gap-2 border-b border-ink-50 py-3 text-sm"
        @click="pick(s)"
      >
        <span class="text-ink-300">🔍</span><span class="flex-1">{{ s }}</span><span class="text-ink-300">↖</span>
      </li>
    </ul>

    <!-- 热搜 + 历史 -->
    <div v-if="!keyword && !searched" class="p-3">
      <h3 class="mb-2 text-sm font-semibold">🔥 热门搜索</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="h in hotWords"
          :key="h"
          class="rounded-full bg-ink-50 px-3 py-1.5 text-xs text-ink-700"
          @click="pick(h)"
        >
          {{ h }}
        </button>
      </div>

      <div v-if="history.length" class="mt-5">
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-semibold">🕘 搜索历史</h3>
          <button class="text-xs text-ink-300" @click="clearHistory">清空</button>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="h in history"
            :key="h"
            class="rounded-full bg-ink-50 px-3 py-1.5 text-xs text-ink-700"
            @click="pick(h)"
          >
            {{ h }}
          </button>
        </div>
      </div>
    </div>

    <!-- 搜索结果 -->
    <div v-else class="p-3">
      <SkeletonList v-if="loading" :count="5" />
      <template v-else>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ShowCard v-for="s in list" :key="s.id" :show="s" />
        </div>
        <EmptyState v-if="!list.length" icon="🔍" :text="`没有找到「${keyword}」相关演出`" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { showApi } from '@/api';
import ShowCard from '@/components/ShowCard.vue';
import SkeletonList from '@/components/SkeletonList.vue';
import EmptyState from '@/components/EmptyState.vue';

const keyword = ref('');
const searched = ref(false);
const loading = ref(false);
const list = ref([]);
const suggests = ref([]);
const hotWords = ref([]);
const history = ref(JSON.parse(localStorage.getItem('searchHistory') || '[]'));

let timer = null;

async function loadHot() {
  try {
    hotWords.value = await showApi.suggest({});
  } catch (e) {
    hotWords.value = [];
  }
}

function onInput() {
  searched.value = false;
  clearTimeout(timer);
  if (!keyword.value) return (suggests.value = []);
  timer = setTimeout(async () => {
    try {
      suggests.value = await showApi.suggest({ keyword: keyword.value });
    } catch (e) {
      suggests.value = [];
    }
  }, 250);
}

async function doSearch() {
  if (!keyword.value.trim()) return;
  searched.value = true;
  loading.value = true;
  saveHistory(keyword.value.trim());
  try {
    const res = await showApi.search({ keyword: keyword.value.trim(), pageSize: 30 });
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
}

function pick(k) {
  keyword.value = k;
  doSearch();
}
function clear() {
  keyword.value = '';
  searched.value = false;
  list.value = [];
}
function saveHistory(k) {
  history.value = [k, ...history.value.filter((x) => x !== k)].slice(0, 10);
  localStorage.setItem('searchHistory', JSON.stringify(history.value));
}
function clearHistory() {
  history.value = [];
  localStorage.removeItem('searchHistory');
}

onMounted(loadHot);
</script>
