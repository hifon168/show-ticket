<template>
  <div class="min-h-screen pb-36 md:pb-10">
    <NavBar title="确认订单" />
    <div class="p-3 md:mx-auto md:max-w-[720px]">
      <!-- 加载中 -->
      <div v-if="loading" class="space-y-3">
        <div class="skeleton h-28 w-full rounded-xl2"></div>
        <div class="skeleton h-40 w-full rounded-xl2"></div>
      </div>

      <template v-else>
        <!-- ============ 商品信息 ============ -->
        <div class="card p-3">
          <div class="flex gap-3">
            <div
              class="flex h-[92px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-400 to-accent text-xl font-bold text-white"
            >
              <AppImage
                :src="item.poster"
                :text="item.title"
                img-class="h-full w-full rounded-lg object-cover"
                placeholder-class="text-xl"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="line-2 text-[15px] font-semibold">{{ item.title }}</p>
              <p class="mt-1 text-xs text-ink-500">{{ item.tierLabel }}</p>
              <p class="text-xs text-ink-500">📍 {{ item.city }} · {{ item.venue }}</p>
              <p class="text-xs text-ink-500">🕒 {{ item.time }}</p>
            </div>
          </div>

          <!-- 已选座位 -->
          <div v-if="seatsMode" class="mt-3 border-t border-ink-50 pt-3">
            <p class="mb-1 text-sm text-ink-500">已选座位（{{ seats.length }}）</p>
            <div class="space-y-1">
              <div v-for="(s, i) in seats" :key="i" class="flex justify-between text-sm">
                <span>{{ s.seatNo }} · <span class="text-ink-500">{{ s.area }}</span></span>
                <span class="font-medium text-brand-500">¥{{ s.price }}</span>
              </div>
            </div>
          </div>

          <!-- 数量（非选座模式） -->
          <div v-else class="mt-3 flex items-center justify-between border-t border-ink-50 pt-3">
            <span class="text-sm text-ink-500">购买数量</span>
            <div class="flex items-center gap-2">
              <button class="h-7 w-7 rounded-full bg-ink-100" @click="qty = Math.max(1, qty - 1)">-</button>
              <span class="w-8 text-center text-sm">{{ qty }}</span>
              <button class="h-7 w-7 rounded-full bg-ink-100" @click="qty = Math.min(maxQty, qty + 1)">+</button>
            </div>
          </div>
        </div>

        <!-- ============ 联系人信息 ============ -->
        <div class="card mt-3 p-3">
          <h3 class="mb-2 text-sm font-semibold">买方信息</h3>
          <div class="space-y-2">
            <input v-model="form.buyerName" class="input" placeholder="买方姓名 *" />
            <input v-model="form.contactName" class="input" placeholder="取票联系人（默认同买方）" />
            <input v-model="form.contactPhone" class="input" type="tel" maxlength="11" placeholder="手机号（用于出票通知）" />
            <textarea v-model="form.remark" class="input h-16 resize-none" placeholder="备注（选填）" />
          </div>
        </div>

        <!-- ============ 金额明细 ============ -->
        <div class="card mt-3 p-3 text-sm">
          <template v-if="seatsMode">
            <div v-for="(s, i) in seats" :key="i" class="flex justify-between py-1">
              <span class="text-ink-500">{{ s.seatNo }} <span class="text-ink-300">{{ s.area }}</span></span>
              <span>¥{{ s.price }}</span>
            </div>
          </template>
          <template v-else>
            <div class="flex justify-between py-1">
              <span class="text-ink-500">单价</span><span>¥{{ unitPrice }}</span>
            </div>
            <div class="flex justify-between py-1">
              <span class="text-ink-500">数量</span><span>× {{ qty }}</span>
            </div>
          </template>
          <div class="mt-2 flex justify-between border-t border-ink-50 pt-2 text-base">
            <span class="font-semibold">应付总额</span>
            <span class="font-bold text-brand-500">¥{{ amount }}</span>
          </div>
        </div>

        <p class="mt-3 px-1 text-[11px] text-ink-300">
          提示：下单后请在 15 分钟内完成支付，超时订单将自动取消并释放库存。
        </p>
      </template>
    </div>

    <!-- 底部提交栏 -->
    <div
      class="action-bar flex items-center gap-3 border-t border-ink-100 bg-white px-3 py-2 md:static md:mx-auto md:mt-4 md:max-w-[720px] md:rounded-xl2 md:border"
    >
      <div class="flex-1 md:text-right">
        <span class="text-xs text-ink-500">应付</span>
        <span class="ml-1 text-xl font-bold text-brand-500">¥{{ amount }}</span>
      </div>
      <button class="btn-primary !px-8 !py-2.5" :disabled="submitting" @click="submit">
        {{ submitting ? '提交中...' : '提交订单' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showApi, ticketApi, orderApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import AppImage from '@/components/AppImage.vue';

const route = useRoute();
const router = useRouter();
const user = useUserStore();

const loading = ref(true);
const submitting = ref(false);
const qty = ref(Number(route.query.qty || 1));
const maxQty = ref(6);
const unitPrice = ref(0);
const item = ref({});

const seatsMode = ref(false);
const seats = ref([]);
const sessionDate = ref('');

/** 下单来源：选座 seats、官方票档 showId+tierId、或二手票 ticketId */
const showId = Number(route.query.showId || 0);
const tierId = Number(route.query.tierId || 0);
const ticketId = Number(route.query.ticketId || 0);

const amount = computed(() =>
  seatsMode.value
    ? seats.value.reduce((a, b) => a + Number(b.price || 0), 0).toFixed(2)
    : (Number(unitPrice.value) * qty.value).toFixed(2)
);

const form = reactive({
  buyerName: user.userInfo?.nickname || '',
  contactName: user.userInfo?.nickname || '',
  contactPhone: user.userInfo?.phone || '',
  remark: '',
});

async function load() {
  loading.value = true;
  try {
    if (route.query.seats) {
      // 选座模式
      seatsMode.value = true;
      try { seats.value = JSON.parse(decodeURIComponent(route.query.seats)); } catch { seats.value = []; }
      sessionDate.value = route.query.sessionDate || '';
      const s = await showApi.detail(showId);
      unitPrice.value = seats.value.length ? seats.value[0].price : 0;
      qty.value = seats.value.length;
      item.value = {
        title: s.title,
        poster: s.poster,
        city: s.city,
        venue: s.venue_name,
        time: sessionDate.value || formatDate(s.start_time),
        tierLabel: `在线选座 ${seats.value.length} 张`,
      };
    } else if (ticketId) {
      // 二手票
      const t = await ticketApi.detail(ticketId);
      unitPrice.value = Number(t.sell_price);
      maxQty.value = Math.max(1, Math.min(6, t.quantity));
      item.value = {
        title: t.show_title || t.title,
        poster: t.poster,
        city: t.city,
        venue: t.venue_name,
        time: formatDate(t.start_time),
        tierLabel: `二手票 · ${t.tier_name || ''} ${t.seat_info || ''}`.trim(),
      };
    } else {
      // 官方票档
      const s = await showApi.detail(showId);
      const tier = (s.tiers || []).find((x) => x.id === tierId) || (s.tiers || [])[0];
      unitPrice.value = Number(tier?.price || 0);
      maxQty.value = Math.max(1, Math.min(6, tier?.stock || 1));
      item.value = {
        title: s.title,
        poster: s.poster,
        city: s.city,
        venue: s.venue_name,
        time: formatDate(s.start_time),
        tierLabel: `官方票 · ${tier?.name || ''}`,
      };
    }
  } finally {
    loading.value = false;
  }
}

async function submit() {
  if (!form.buyerName) return window.$toast('请填写买方姓名');
  if (!/^1[3-9]\d{9}$/.test(form.contactPhone)) return window.$toast('请填写正确手机号');
  if (!form.contactName) form.contactName = form.buyerName;

  submitting.value = true;
  try {
    const payload = { quantity: qty.value, ...form };
    if (seatsMode.value) {
      Object.assign(payload, { showId, seats: seats.value, sessionDate: sessionDate.value });
    } else if (ticketId) {
      payload.ticketId = ticketId;
    } else {
      Object.assign(payload, { showId, tierId });
    }
    const order = await orderApi.create(payload);
    window.$toast('下单成功');
    router.replace(`/pay/${order.id}`);
  } catch (e) {
    /* 已提示 */
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>
