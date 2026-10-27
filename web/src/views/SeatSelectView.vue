<template>
  <div class="min-h-screen bg-white pb-36 md:pb-10">
    <NavBar title="选座购票" />

    <div v-if="loading" class="space-y-3 p-3">
      <div class="skeleton h-24 w-full rounded-xl2"></div>
      <div class="skeleton h-72 w-full rounded-xl2"></div>
    </div>

    <template v-else>
      <!-- 演出信息 -->
      <div class="flex gap-3 p-3">
        <div class="h-[72px] w-[54px] shrink-0 overflow-hidden rounded-lg">
          <AppImage
            :src="show.poster"
            :text="show.title"
            img-class="h-full w-full object-cover"
            placeholder-class="text-base"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="line-2 text-[15px] font-semibold">{{ show.title }}</p>
          <p class="mt-1 text-xs text-ink-500">📍 {{ show.city }} · {{ show.venue_name }}</p>
        </div>
      </div>

      <!-- 日期选择 -->
      <div class="border-y border-ink-50 bg-ink-50/40 px-3 py-3">
        <p class="mb-2 text-sm font-semibold">选择场次</p>
        <div class="flex gap-2 overflow-x-auto pb-1">
          <button
            v-for="(d, i) in dates"
            :key="i"
            class="shrink-0 rounded-xl2 border px-3 py-2 text-center transition"
            :class="selectedDateIdx === i ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'"
            @click="selectedDateIdx = i"
          >
            <p class="text-[13px] font-medium">{{ d.md }}</p>
            <p class="text-[11px] text-ink-500">{{ d.week }} 19:30</p>
          </button>
        </div>
      </div>

      <!-- 图例 -->
      <div class="flex flex-wrap gap-3 px-3 py-3">
        <div v-for="a in areas" :key="a.id" class="flex items-center gap-1 text-xs">
          <span class="inline-block h-3 w-3 rounded-sm" :style="{ background: a.color }"></span>
          <span>{{ a.name }}</span>
          <span class="font-medium text-brand-500">¥{{ a.price }}</span>
        </div>
      </div>

      <!-- 舞台 -->
      <div class="mx-3 mb-4">
        <div class="rounded-t-xl2 bg-gradient-to-r from-brand-400 to-accent py-2 text-center text-xs font-semibold tracking-widest text-white">
          舞 台 STAGE
        </div>
      </div>

      <!-- 座位图（按区域分区，不同区域价格不同） -->
      <div class="space-y-6 px-3">
        <div v-for="a in areas" :key="a.id">
          <p class="mb-2 text-center text-sm font-medium">{{ a.name }} · ¥{{ a.price }}</p>
          <div class="flex justify-center">
            <div class="grid gap-1.5" :style="{ gridTemplateColumns: `repeat(${a.cols}, minmax(0, 1fr))` }">
              <button
                v-for="seat in a.seats"
                :key="seat.key"
                class="h-7 w-7 rounded text-[10px] transition"
                :class="selectedMap[seat.key] ? 'bg-brand-500 text-white' : 'bg-ink-50 text-ink-400'"
                @click="toggleSeat(seat.key)"
              >{{ seat.label }}</button>
            </div>
          </div>
        </div>
      </div>

      <p class="px-3 pt-5 text-center text-[11px] text-ink-300">不同区域座位价格不同，最多可选 6 个座位</p>
    </template>

    <!-- 底部已选 + 下一步 -->
    <div
      v-if="!loading"
      class="action-bar border-t border-ink-100 bg-white px-3 py-2 md:static md:mx-auto md:mt-4 md:max-w-[720px] md:rounded-xl2 md:border"
    >
      <div v-if="selectedSeats.length" class="mb-2 flex flex-wrap gap-1.5">
        <span
          v-for="(s, i) in selectedSeats"
          :key="i"
          class="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-600"
        >{{ s.seatNo }} · ¥{{ s.price }}</span>
      </div>
      <div class="flex items-center justify-between">
        <div>
          <span class="text-xs text-ink-500">已选 {{ selectedSeats.length }} 张</span>
          <span class="ml-2 text-lg font-bold text-brand-500">¥{{ total }}</span>
        </div>
        <button class="btn-primary !px-8 !py-2.5" :disabled="!selectedSeats.length" @click="next">
          {{ selectedSeats.length ? '下一步' : '请先选座' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showApi } from '@/api';
import NavBar from '@/components/NavBar.vue';
import AppImage from '@/components/AppImage.vue';

const route = useRoute();
const router = useRouter();
const showId = Number(route.query.showId || 0);

const loading = ref(true);
const show = ref({});
const tiers = ref([]);
const selectedDateIdx = ref(0);

const palette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
const scales = [[4, 8], [5, 10], [6, 12], [8, 14], [8, 16], [10, 18]];
const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 选中状态用 reactive 字典记录，保证响应式 */
const selectedMap = reactive({});

const dates = computed(() => {
  const base = new Date(String(show.value.start_time || '').replace(/-/g, '/').replace('T', ' '));
  const t = Number.isNaN(base.getTime()) ? new Date() : base;
  const arr = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(t.getTime() + i * 86400000);
    arr.push({
      md: `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`,
      week: WEEK[d.getDay()],
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    });
  }
  return arr;
});

const selectedDate = computed(() => dates.value[selectedDateIdx.value]?.date || '');

/** 区域 = 票档；无票档时用默认三区域 */
const areas = computed(() => {
  const list = tiers.value.length
    ? tiers.value.map((t, i) => ({ id: t.id, name: t.name, price: Number(t.price), color: palette[i % palette.length] }))
    : [
        { id: 0, name: 'VIP区', price: Number(show.value.max_price) || 1280, color: palette[0] },
        { id: 1, name: '内场', price: Math.round((Number(show.value.max_price) || 1280) * 0.7), color: palette[1] },
        { id: 2, name: '看台A', price: Number(show.value.min_price) || 380, color: palette[2] },
      ];
  return list.map((a, i) => {
    const [rows, cols] = scales[i % scales.length];
    const seats = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        seats.push({ key: `${a.id}-${r}-${c}`, label: `${r}-${String(c).padStart(2, '0')}` });
      }
    }
    return { ...a, rows, cols, seats };
  });
});

const selectedSeats = computed(() =>
  areas.value.flatMap((a) =>
    a.seats.filter((s) => selectedMap[s.key]).map((s) => ({ seatNo: `${a.name}${s.label}`, area: a.name, price: a.price, tierId: a.id }))
  )
);

const total = computed(() => selectedSeats.value.reduce((sum, s) => sum + Number(s.price), 0).toFixed(2));

function toggleSeat(key) {
  if (!selectedMap[key] && selectedSeats.value.length >= 6) {
    return window.$toast && window.$toast('每单最多选 6 个座位');
  }
  if (selectedMap[key]) delete selectedMap[key];
  else selectedMap[key] = true;
}

function next() {
  if (!selectedSeats.value.length) return;
  const payload = encodeURIComponent(JSON.stringify(selectedSeats.value));
  router.push({
    path: '/confirm',
    query: { showId, seats: payload, sessionDate: selectedDate.value },
  });
}

async function load() {
  loading.value = true;
  try {
    const res = await showApi.detail(showId);
    show.value = res;
    tiers.value = res.tiers || [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
