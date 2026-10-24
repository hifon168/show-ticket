<template>
  <div class="min-h-screen">
    <NavBar title="我的订单" />

    <!-- 状态 Tab -->
    <div class="sticky top-12 z-30 flex gap-1 overflow-x-auto border-b border-ink-100 bg-white px-3 py-2 md:top-16">
      <button
        v-for="t in tabs"
        :key="t.value"
        class="shrink-0 rounded-full px-3 py-1.5 text-xs transition"
        :class="status === t.value ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-700'"
        @click="switchTab(t.value)"
      >
        {{ t.label }}
      </button>
    </div>

    <PullRefresh class="p-3" @refresh="onRefresh">
      <SkeletonList v-if="loading" :count="3" />
      <template v-else>
        <div class="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 xl:grid-cols-3">
          <router-link
            v-for="o in list"
            :key="o.id"
            :to="`/order/${o.id}`"
            class="card block p-3"
          >
            <div class="flex items-center justify-between text-xs">
              <span class="text-ink-500">订单号 {{ o.order_no.slice(-8) }}</span>
              <span
                class="tag"
                :class="o.status === 0 ? 'bg-warn/15 text-warn' : o.status === 1 ? 'bg-brand-50 text-brand-500' : 'bg-ink-100 text-ink-500'"
              >
                {{ statusText(o.status) }}
              </span>
            </div>
            <div class="mt-2 flex gap-2">
              <div
                class="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-gradient-to-br from-brand-300 to-accent text-white"
              >
                <AppImage :src="o.poster" text="🎫" img-class="h-full w-full rounded object-cover" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="line-1 text-sm font-medium">{{ o.show_title }}</p>
                <p class="line-1 text-[11px] text-ink-500">{{ o.tier_name }} × {{ o.quantity }}</p>
                <p class="line-1 text-[11px] text-ink-500">🕒 {{ formatDate(o.start_time) }}</p>
              </div>
              <div class="shrink-0 text-right">
                <p class="text-sm font-bold text-brand-500">¥{{ o.amount }}</p>
                <p class="mt-1 text-[11px] text-ink-300">{{ o.source === 'resale' ? '二手票' : '官方票' }}</p>
              </div>
            </div>
            <div v-if="o.status === 0" class="mt-2 flex justify-end gap-2">
              <button class="btn-ghost !py-1 text-xs" @click.stop="cancel(o.id)">取消订单</button>
              <button class="btn-primary !py-1 text-xs" @click.stop="$router.push(`/pay/${o.id}`)">去支付</button>
            </div>
            <div v-else-if="o.status === 1" class="mt-2 flex justify-end gap-2">
              <button class="btn-ghost !py-1 text-xs" @click.stop="refund(o.id)">申请退款</button>
              <button class="btn-primary !py-1 text-xs" @click.stop="confirmOrder(o.id)">确认完成</button>
            </div>
          </router-link>
        </div>
        <EmptyState v-if="!list.length" icon="📋" text="暂无订单" />
      </template>
    </PullRefresh>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { orderApi } from '@/api';
import { formatDate, ORDER_STATUS_TEXT } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import SkeletonList from '@/components/SkeletonList.vue';
import EmptyState from '@/components/EmptyState.vue';
import PullRefresh from '@/components/PullRefresh.vue';
import AppImage from '@/components/AppImage.vue';

const tabs = [
  { value: '', label: '全部' },
  { value: '0', label: '待支付' },
  { value: '1', label: '已支付' },
  { value: '3', label: '已完成' },
  { value: '4', label: '已退款' },
  { value: '2', label: '已取消' },
];

const status = ref('');
const list = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await orderApi.list({ status: status.value, pageSize: 30 });
    list.value = res.list || [];
  } finally {
    loading.value = false;
  }
}

function switchTab(v) {
  status.value = v;
  load();
}
function statusText(s) {
  return ORDER_STATUS_TEXT[s] || '未知';
}
async function cancel(id) {
  if (!confirm('确认取消该订单？')) return;
  await orderApi.cancel(id);
  window.$toast('已取消');
  load();
}
async function refund(id) {
  const reason = prompt('请输入退款原因') || '';
  await orderApi.refund(id, { reason });
  window.$toast('退款申请已提交');
  load();
}
async function confirmOrder(id) {
  await orderApi.confirm(id);
  window.$toast('已完成');
  load();
}
function onRefresh(done) {
  load().finally(done);
}

onMounted(load);
</script>
