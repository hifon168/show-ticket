<template>
  <div class="min-h-screen pb-36 md:pb-10">
    <NavBar title="订单详情" />

    <div v-if="loading" class="p-3">
      <div class="skeleton h-24 w-full rounded-xl2"></div>
      <div class="skeleton mt-3 h-52 w-full rounded-xl2"></div>
    </div>

    <div v-else class="p-3 md:mx-auto md:max-w-[720px]">
      <!-- 状态卡 -->
      <div class="card bg-brand-gradient p-4 text-white">
        <p class="text-lg font-bold">{{ statusText }}</p>
        <p v-if="order.status === 0" class="mt-1 text-xs opacity-90">请在 15 分钟内完成支付，超时自动取消</p>
        <p v-else class="mt-1 text-xs opacity-90">订单号：{{ order.order_no }}</p>
      </div>

      <!-- 演出信息 -->
      <div class="card mt-3 p-3">
        <div class="flex gap-3">
          <div
            class="flex h-[92px] w-[68px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-accent text-xl font-bold text-white"
          >
            <AppImage
              :src="order.poster"
              text="🎫"
              img-class="h-full w-full rounded-lg object-cover"
              placeholder-class="text-xl"
            />
          </div>
          <div class="min-w-0 flex-1 text-sm">
            <p class="line-2 font-semibold">{{ order.show_title }}</p>
            <p class="mt-1 text-xs text-ink-500">{{ order.tier_name }}</p>
            <p class="text-xs text-ink-500">📍 {{ order.city }} {{ order.venue_name }}</p>
            <p class="text-xs text-ink-500">🕒 {{ formatDate(order.start_time) }}</p>
          </div>
        </div>
      </div>

      <!-- 订单明细 -->
      <div class="card mt-3 space-y-2 p-3 text-sm">
        <div class="flex justify-between"><span class="text-ink-500">订单编号</span><span>{{ order.order_no }}</span></div>
        <div class="flex justify-between"><span class="text-ink-500">票品来源</span><span>{{ order.source === 'resale' ? '二手转票' : '官方票' }}</span></div>
        <div class="flex justify-between"><span class="text-ink-500">买方姓名</span><span>{{ order.buyer_name || '—' }}</span></div>
        <div class="flex justify-between"><span class="text-ink-500">取票人</span><span>{{ order.contact_name }} {{ maskPhone(order.contact_phone) }}</span></div>
        <div class="flex justify-between"><span class="text-ink-500">单价 / 数量</span><span>¥{{ order.unit_price }} × {{ order.quantity }}</span></div>
        <div class="flex justify-between"><span class="text-ink-500">支付方式</span><span>{{ payMethodText }}</span></div>
        <div class="flex justify-between"><span class="text-ink-500">下单时间</span><span>{{ formatDate(order.created_at) }}</span></div>
        <div v-if="order.paid_at" class="flex justify-between"><span class="text-ink-500">支付时间</span><span>{{ formatDate(order.paid_at) }}</span></div>
        <div class="flex justify-between border-t border-ink-50 pt-2 text-base">
          <span class="font-semibold">实付金额</span>
          <span class="font-bold text-brand-500">¥{{ order.amount }}</span>
        </div>
      </div>

      <div class="mt-4 hidden gap-2 md:flex md:justify-end">
        <button v-if="order.status === 0" class="btn-ghost" @click="cancel">取消订单</button>
        <button v-if="order.status === 0" class="btn-primary" @click="$router.push(`/pay/${order.id}`)">去支付</button>
        <button v-if="order.status === 1" class="btn-ghost" @click="refund">申请退款</button>
        <button v-if="order.status === 1" class="btn-primary" @click="confirmOrder">确认完成</button>
      </div>
    </div>

    <!-- 移动端操作栏 -->
    <div
      v-if="!loading && [0, 1].includes(order.status)"
      class="action-bar flex items-center justify-end gap-2 border-t border-ink-100 bg-white px-3 py-2 md:hidden"
    >
      <template v-if="order.status === 0">
        <button class="btn-ghost" @click="cancel">取消订单</button>
        <button class="btn-primary" @click="$router.push(`/pay/${order.id}`)">去支付</button>
      </template>
      <template v-else>
        <button class="btn-ghost" @click="refund">申请退款</button>
        <button class="btn-primary" @click="confirmOrder">确认完成</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { orderApi } from '@/api';
import { formatDate, ORDER_STATUS_TEXT, maskPhone } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import AppImage from '@/components/AppImage.vue';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const order = ref({});

const statusText = computed(() => ORDER_STATUS_TEXT[order.value.status] || '');
const payMethodText = computed(
  () => ({ wechat: '微信支付', alipay: '支付宝', balance: '余额支付' })[order.value.pay_method] || '未支付'
);

async function load() {
  loading.value = true;
  try {
    order.value = await orderApi.detail(route.params.id);
  } finally {
    loading.value = false;
  }
}
async function cancel() {
  if (!confirm('确认取消？')) return;
  await orderApi.cancel(order.value.id);
  window.$toast('已取消');
  load();
}
async function refund() {
  const reason = prompt('退款原因') || '';
  await orderApi.refund(order.value.id, { reason });
  window.$toast('已提交退款');
  load();
}
async function confirmOrder() {
  await orderApi.confirm(order.value.id);
  window.$toast('已完成');
  load();
}

onMounted(load);
</script>
