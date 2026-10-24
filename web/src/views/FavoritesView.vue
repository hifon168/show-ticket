<template>
  <div class="min-h-screen">
    <NavBar title="我的收藏" />
    <PullRefresh class="p-3" @refresh="onRefresh">
      <SkeletonList v-if="loading && !list.length" :count="4" />
      <template v-else>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ShowCard v-for="s in list" :key="s.id" :show="s" />
        </div>
        <EmptyState v-if="!list.length" icon="❤️" text="还没有收藏的演出">
          <router-link to="/shows" class="btn-primary mt-3">去逛逛</router-link>
        </EmptyState>
      </template>
    </PullRefresh>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { userApi } from '@/api';
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
    const res = await userApi.favorites({ pageSize: 50 });
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
}
function onRefresh(done) {
  load().finally(done);
}
onMounted(load);
</script>
