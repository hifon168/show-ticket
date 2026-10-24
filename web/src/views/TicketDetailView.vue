<template>
  <div class="min-h-screen bg-white pb-36 md:pb-10">
    <NavBar title="票品详情" />

    <div v-if="loading" class="p-3">
      <div class="skeleton h-24 w-full rounded-xl2"></div>
      <div class="skeleton mt-3 h-40 w-full rounded-xl2"></div>
    </div>

    <div v-else class="p-3 md:mx-auto md:max-w-[720px]">
      <!-- 价格卡 -->
      <div class="card bg-accent-gradient p-4 text-white">
        <p class="text-3xl font-bold">¥{{ ticket.sell_price }}</p>
        <p class="mt-1 text-xs opacity-90">
          票面价 <span class="line-through">¥{{ ticket.original_price }}</span>
          · 可售 {{ ticket.quantity }} 张
        </p>
        <p class="mt-2 text-sm">{{ ticket.show_title }}</p>
      </div>

      <!-- 演出信息 -->
      <div class="card mt-3 p-3 text-sm">
        <div class="flex justify-between py-1"><span class="text-ink-500">演出时间</span><span>{{ formatDate(ticket.start_time) }}</span></div>
        <div class="flex justify-between py-1"><span class="text-ink-500">演出场馆</span><span>{{ ticket.city }} {{ ticket.venue_name }}</span></div>
        <div class="flex justify-between py-1"><span class="text-ink-500">艺人</span><span>{{ ticket.artist || '—' }}</span></div>
        <div class="flex justify-between py-1"><span class="text-ink-500">票档</span><span>{{ ticket.tier_name || '—' }}</span></div>
        <div class="flex justify-between py-1"><span class="text-ink-500">座位</span><span>{{ ticket.seat_info || '以实际出票为准' }}</span></div>
      </div>

      <!-- 票品图片 -->
      <div v-if="images.length" class="card mt-3 grid grid-cols-3 gap-2 p-3">
        <img v-for="(img, i) in images" :key="i" :src="img" class="aspect-[3/4] w-full rounded-lg object-cover" />
      </div>

      <!-- 转让说明 -->
      <div class="card mt-3 p-3">
        <h3 class="mb-1 text-sm font-semibold">转让说明</h3>
        <p class="whitespace-pre-line text-sm text-ink-700">{{ ticket.description || '暂无说明' }}</p>
      </div>

      <!-- 卖家 -->
      <div class="card mt-3 flex items-center gap-3 p-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-600">
          {{ (ticket.seller_nickname || 'U').slice(0, 1) }}
        </span>
        <div class="flex-1">
          <p class="text-sm font-medium">{{ ticket.seller_nickname }}</p>
          <p class="text-[11px] text-ink-500">👀 {{ ticket.view_count }} 次浏览 · {{ fromNow(ticket.created_at) }}发布</p>
        </div>
        <button v-if="!isMine" class="btn-ghost !py-1 text-xs" @click="chat">私聊</button>
      </div>

      <p class="mt-3 px-1 text-[11px] text-ink-300">
        温馨提示：二手票交易由买卖双方自行约定，平台提供担保下单流程，请勿脱离平台私下转账。
      </p>
    </div>

    <!-- 操作栏：移动端固定底部，桌面端居中吸底（两端都可见） -->
    <div
      v-if="!loading"
      class="action-bar border-t border-ink-100"
    >
      <div class="mx-auto flex max-w-[720px] items-center gap-2 px-3 py-2">
        <template v-if="!isMine">
          <button class="btn-ghost !px-4" @click="chat">💬 私聊卖家</button>
          <div class="flex-1 text-right">
            <span class="text-xs text-ink-500">应付</span>
            <span class="ml-1 text-xl font-bold text-brand-500">¥{{ ticket.sell_price }}</span>
          </div>
          <button class="btn-primary !px-8" :disabled="Number(ticket.quantity) <= 0 || Number(ticket.status) !== 0" @click="buy">
            {{ Number(ticket.quantity) > 0 && Number(ticket.status) === 0 ? '立即购买' : '已售罄' }}
          </button>
        </template>
        <template v-else>
          <div class="flex-1 text-sm text-ink-500">这是你发布的票品</div>
          <router-link to="/mine/tickets" class="btn-ghost !px-4">管理我的票品</router-link>
          <router-link :to="{ path: '/sell' }" class="btn-primary !px-4">继续挂票</router-link>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ticketApi, chatApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate, fromNow } from '@/utils';
import NavBar from '@/components/NavBar.vue';

const route = useRoute();
const router = useRouter();
const user = useUserStore();

const loading = ref(true);
const ticket = ref({});

const images = computed(() => {
  try {
    return JSON.parse(ticket.value.images || '[]');
  } catch {
    return [];
  }
});
const isMine = computed(() => user.userInfo && user.userInfo.id === ticket.value.seller_id);

async function load() {
  loading.value = true;
  try {
    ticket.value = await ticketApi.detail(route.params.id);
  } finally {
    loading.value = false;
  }
}

async function chat() {
  if (!user.token) return router.push('/login?redirect=' + route.fullPath);
  const conv = await chatApi.start({ ticketId: ticket.value.id });
  router.push(`/chat/${conv.id}`);
}

function buy() {
  if (!user.token) {
    // 未登录：跳登录页，登录后直达结算页（避免“点了没反应”的困惑）
    const redirect = encodeURIComponent(`/confirm?ticketId=${ticket.value.id}&qty=1`);
    return router.push('/login?redirect=' + redirect);
  }
  router.push({ path: '/confirm', query: { ticketId: ticket.value.id, qty: 1 } });
}

onMounted(load);
</script>
