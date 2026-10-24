<template>
  <div class="min-h-screen pb-36 md:pb-10">
    <NavBar title="收银台" />

    <div v-if="loading" class="p-3">
      <div class="skeleton h-32 w-full rounded-xl2"></div>
      <div class="skeleton mt-3 h-44 w-full rounded-xl2"></div>
    </div>

    <div v-else class="p-3 md:mx-auto md:max-w-[720px]">
      <!-- 金额 + 倒计时 -->
      <div class="card bg-brand-gradient p-4 text-white">
        <p class="text-xs opacity-90">待支付金额</p>
        <p class="mt-1 text-3xl font-bold">¥{{ order.amount }}</p>
        <p class="mt-2 text-xs opacity-90">
          订单号 {{ order.order_no }} · 请在 <span class="font-semibold">{{ countdown }}</span> 内完成支付
        </p>
      </div>

      <!-- 商品信息 -->
      <div class="card mt-3 p-3 text-sm">
        <p class="font-semibold">{{ order.show_title }}</p>
        <p class="mt-0.5 text-xs text-ink-500">{{ order.tier_name }} · × {{ order.quantity }}</p>
        <p class="mt-0.5 text-xs text-ink-500">📍 {{ order.city }} {{ order.venue_name }}</p>
        <p class="mt-0.5 text-xs text-ink-500">🕒 {{ formatDate(order.start_time) }}</p>
      </div>

      <!-- 支付方式 -->
      <div class="card mt-3 divide-y divide-ink-50">
        <label
          v-for="m in methods"
          :key="m.value"
          class="flex items-center gap-3 p-3 text-sm"
          :class="m.value === payMethod ? 'bg-brand-50/50' : ''"
        >
          <span class="text-xl">{{ m.icon }}</span>
          <span class="flex-1">{{ m.label }}</span>
          <input v-model="payMethod" type="radio" :value="m.value" class="accent-brand-500" :disabled="stage === 'await'" />
        </label>
      </div>

      <!-- 支付面板：确认后展示 -->
      <div v-if="stage === 'await'" class="card mt-3 p-4 text-center">
        <!-- 测试模式：模拟支付 -->
        <template v-if="payInfo.mode === 'test'">
          <p class="text-sm font-semibold text-ink-700">演示环境 · 测试支付</p>
          <p class="mt-1 text-xs text-ink-400">点击下方按钮即视为支付成功（已打通完整下单→支付→回调→改订单状态流程）</p>
          <button class="btn-primary mt-3 w-full !py-2.5" :disabled="paying" @click="doMock">
            {{ paying ? '处理中...' : '模拟支付（点击即支付成功）' }}
          </button>
          <div v-if="payInfo.qrShow" class="mt-4">
            <p class="text-xs text-ink-400">或扫码完成（用另一台设备扫码将打开支付成功页）</p>
            <img v-if="qrDataUrl" :src="qrDataUrl" class="mx-auto mt-2 h-40 w-40 rounded-lg border border-ink-100" />
          </div>
        </template>

        <!-- 真实微信：二维码 -->
        <template v-else-if="payInfo.method === 'wechat' && payInfo.mode === 'real'">
          <p class="text-sm font-semibold text-ink-700">请使用微信扫一扫</p>
          <img v-if="qrDataUrl" :src="qrDataUrl" class="mx-auto mt-3 h-48 w-48 rounded-lg border border-ink-100" />
          <p class="mt-2 text-xs text-ink-400">打开微信 → 扫一扫 → 完成支付，本页将自动跳转</p>
        </template>

        <!-- 真实支付宝：跳转 -->
        <template v-else-if="payInfo.method === 'alipay' && payInfo.mode === 'real'">
          <p class="text-sm font-semibold text-ink-700">即将跳转到支付宝</p>
          <p class="mt-1 text-xs text-ink-400">点击下方按钮在支付宝完成支付，支付后自动返回</p>
          <a :href="payInfo.payUrl" class="btn-primary mt-3 block w-full !py-2.5 text-center">前往支付宝支付</a>
        </template>
      </div>

      <p class="mt-3 px-1 text-[11px] text-ink-300">
        {{ payInfo.mode === 'test' || !payInfo.mode
          ? '* 当前为测试支付模式，无需真实密钥；配置真实微信/支付宝密钥后自动切换为真实通道。'
          : '* 真实支付通道：支付成功后由渠道异步通知回调，本页将自动更新订单状态。' }}
      </p>
    </div>

    <!-- 支付栏 -->
    <div
      class="action-bar flex items-center gap-3 border-t border-ink-100 bg-white px-3 py-2 md:static md:mx-auto md:mt-4 md:max-w-[720px] md:rounded-xl2 md:border"
    >
      <div class="flex-1 md:text-right">
        <span class="text-xl font-bold text-brand-500">¥{{ order.amount }}</span>
      </div>
      <button class="btn-ghost" :disabled="stage === 'await'" @click="cancelOrder">取消订单</button>
      <button v-if="stage === 'choose'" class="btn-primary !px-8 !py-2.5" :disabled="paying" @click="pay">
        {{ paying ? '发起支付...' : '确认支付' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { orderApi, paymentApi, metaApi } from '@/api';
import { formatDate } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import QRCode from 'qrcode';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const paying = ref(false);
const order = ref({});
const payMethod = ref('wechat');
const leftSeconds = ref(900);
const methods = ref([
  { value: 'wechat', label: '微信支付', icon: '💚', type: 'qr' },
  { value: 'alipay', label: '支付宝', icon: '💙', type: 'redirect' },
]);
const stage = ref('choose'); // choose | await
const payInfo = ref({});
const qrDataUrl = ref('');

const countdown = computed(() => {
  const m = String(Math.floor(leftSeconds.value / 60)).padStart(2, '0');
  const s = String(leftSeconds.value % 60).padStart(2, '0');
  return `${m}:${s}`;
});

let timer = null;
let pollTimer = null;

async function load() {
  loading.value = true;
  try {
    const [o] = await Promise.all([orderApi.detail(route.params.id)]);
    order.value = o;
    const created = new Date(String(o.created_at).replace(/-/g, '/')).getTime();
    leftSeconds.value = Math.max(0, Math.floor((created + 15 * 60 * 1000 - Date.now()) / 1000));
    if (o.status === 1) {
      window.$toast && window.$toast('该订单已支付');
      router.replace(`/order/${o.id}`);
    }
  } finally {
    loading.value = false;
  }
}

async function loadMethods() {
  try {
    const cfg = await metaApi.config();
    if (cfg.payment && cfg.payment.methods && cfg.payment.methods.length) {
      methods.value = cfg.payment.methods;
    }
  } catch (e) {
    /* 用默认通道 */
  }
}

async function pay() {
  paying.value = true;
  try {
    const info = await orderApi.pay(order.value.id, { payMethod: payMethod.value });
    payInfo.value = info;
    stage.value = 'await';
    // 微信（含测试扫码）展示二维码；支付宝真实模式走跳转，不展示二维码
    const showQr = info.method === 'wechat' && (info.mode === 'real' || info.mode === 'test');
    if (showQr && info.codeUrl) {
      try {
        qrDataUrl.value = await QRCode.toDataURL(info.codeUrl, { width: 320, margin: 1 });
      } catch (e) {
        qrDataUrl.value = '';
      }
    } else {
      qrDataUrl.value = '';
    }
  } catch (e) {
    /* 已提示 */
  } finally {
    paying.value = false;
  }
}

async function doMock() {
  paying.value = true;
  try {
    await paymentApi.mockConfirm(order.value.id);
    // 轮询会检测到已支付并跳转
  } catch (e) {
    /* 已提示 */
  } finally {
    paying.value = false;
  }
}

async function cancelOrder() {
  if (!confirm('确认取消该订单？')) return;
  await orderApi.cancel(order.value.id);
  window.$toast('订单已取消');
  router.replace('/orders');
}

async function poll() {
  try {
    const o = await orderApi.detail(order.value.id);
    order.value = o;
    if (o.status === 1) {
      stopPoll();
      window.$toast('支付成功');
      router.replace(`/order/${o.id}`);
    } else if (o.status === 2) {
      stopPoll();
      window.$toast('订单已取消');
      router.replace('/orders');
    }
  } catch (e) {
    /* 忽略轮询错误 */
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(poll, 2000);
}
function stopPoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

onMounted(() => {
  load();
  loadMethods();
  startPoll();
  timer = setInterval(() => {
    if (leftSeconds.value > 0) leftSeconds.value -= 1;
  }, 1000);
});
onBeforeUnmount(() => {
  clearInterval(timer);
  stopPoll();
});
</script>
