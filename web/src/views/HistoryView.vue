<template>
  <div class="min-h-screen">
    <NavBar title="浏览记录">
      <template #right>
        <button class="text-xs text-ink-500" @click="clear">清空</button>
      </template>
    </NavBar>

    <PullRefresh class="p-3" @refresh="onRefresh">
      <SkeletonList v-if="loading && !list.length" :count="4" />
      <template v-else>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="s in list" :key="s.id" class="relative">
            <ShowCard :show="s" />
            <button
              class="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] text-ink-500 shadow"
              @click="remove(s.id)"
            >
              删除
            </button>
            <p class="mt-1 px-1 text-[11px] text-ink-300">{{ fromNow(s.viewed_at) }}浏览</p>
          </div>
        </div>
        <EmptyState v-if="!list.length" icon="🕘" text="暂无浏览记录" />
      </template>
    </PullRefresh>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { userApi } from '@/api';
import { fromNow } from '@/utils';
import ShowCard from '@/components/ShowCard.vue';
import SkeletonList from '@/components/SkeletonList.vue';
import EmptyState from '@/components/EmptyState.vue';
import PullRefresh from '@/components/PullRefresh.vue';
import NavBar from '@/components/NavBar.vue';

const list = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await userApi.history({ pageSize: 50 });
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
}
async function remove(id) {
  await userApi.deleteHistory(id);
  list.value = list.value.filter((x) => x.id !== id);
}
async function clear() {
  if (!confirm('确认清空浏览记录？')) return;
  await userApi.clearHistory();
  list.value = [];
}
function onRefresh(done) {
  load().finally(done);
}
onMounted(load);
</script>
