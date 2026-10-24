<template>
  <div class="min-h-screen">
    <NavBar title="我挂出的票">
      <template #right>
        <router-link to="/sell" class="text-xs text-brand-500">+ 挂票</router-link>
      </template>
    </NavBar>

    <PullRefresh class="p-3" @refresh="onRefresh">
      <SkeletonList v-if="loading && !list.length" :count="3" />
      <template v-else>
        <div class="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          <div v-for="t in list" :key="t.id" class="card p-3">
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <router-link :to="`/ticket/${t.id}`" class="line-1 text-sm font-semibold">{{ t.show_title }}</router-link>
                <p class="mt-0.5 text-[11px] text-ink-500">{{ t.tier_name }} {{ t.seat_info }}</p>
                <p class="text-[11px] text-ink-500">🕒 {{ formatDate(t.start_time, false) }} · {{ t.city }}</p>
              </div>
              <span
                class="tag shrink-0"
                :class="t.status === 0 ? 'bg-brand-50 text-brand-500' : 'bg-ink-100 text-ink-500'"
              >
                {{ TICKET_STATUS_TEXT[t.status] }}
              </span>
            </div>

            <div class="mt-2 flex items-center justify-between border-t border-ink-50 pt-2">
              <div>
                <span class="text-[15px] font-bold text-brand-500">¥{{ t.sell_price }}</span>
                <span class="ml-2 text-[11px] text-ink-300">剩 {{ t.quantity }} / 已售 {{ t.sold_count }}</span>
              </div>
              <div class="flex gap-1.5">
                <button class="btn-ghost !px-2 !py-1 text-[11px]" @click="toggleStatus(t)">
                  {{ t.status === 0 ? '下架' : '上架' }}
                </button>
                <router-link :to="`/ticket/${t.id}`" class="btn-ghost !px-2 !py-1 text-[11px]">详情</router-link>
                <button class="btn-ghost !px-2 !py-1 text-[11px] text-brand-500" @click="remove(t)">删除</button>
              </div>
            </div>
          </div>
        </div>
        <EmptyState v-if="!list.length" icon="💰" text="还没有挂出的票">
          <router-link to="/sell" class="btn-primary mt-3">立即挂票</router-link>
        </EmptyState>
      </template>
    </PullRefresh>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ticketApi } from '@/api';
import { formatDate, TICKET_STATUS_TEXT } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import SkeletonList from '@/components/SkeletonList.vue';
import EmptyState from '@/components/EmptyState.vue';
import PullRefresh from '@/components/PullRefresh.vue';

const list = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await ticketApi.mine({ pageSize: 50 });
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
}

async function toggleStatus(t) {
  await ticketApi.setStatus(t.id, t.status === 0 ? 2 : 0);
  window.$toast(t.status === 0 ? '已下架' : '已上架');
  load();
}
async function remove(t) {
  if (!confirm('确认删除该票品？')) return;
  await ticketApi.remove(t.id);
  window.$toast('已删除');
  load();
}
function onRefresh(done) {
  load().finally(done);
}

onMounted(load);
</script>
