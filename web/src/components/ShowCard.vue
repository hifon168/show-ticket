<template>
  <!-- 演出卡片：移动端横向卡片，桌面端自适应 -->
  <router-link :to="`/show/${show.id}`" class="card flex gap-3 p-3 active:scale-[0.99]">
    <!-- 海报（无图时用渐变占位 + 首字） -->
    <div
      class="h-[92px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-400 to-accent md:h-[110px] md:w-[82px]"
    >
      <AppImage
        :src="show.poster"
        :text="show.title"
        img-class="h-full w-full object-cover"
        placeholder-class="text-lg"
      />
    </div>

    <div class="flex min-w-0 flex-1 flex-col justify-between">
      <div>
        <h3 class="line-2 text-[15px] font-semibold leading-5">{{ show.title }}</h3>
        <p class="mt-1 line-1 text-xs text-ink-500">{{ show.artist || '—' }}</p>
        <p class="mt-0.5 line-1 text-xs text-ink-500">
          📍 {{ show.city }} · {{ show.venue_name }}
        </p>
      </div>
      <div class="mt-2 flex items-end justify-between">
        <div>
          <span class="text-[15px] font-bold text-brand-500">{{ priceText }}</span>
          <span v-if="show.category" class="ml-2 tag bg-ink-50 text-ink-500">{{ categoryText }}</span>
        </div>
        <span class="text-[11px] text-ink-300">{{ dateText }}</span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue';
import { formatPrice, formatDate, CATEGORY_TEXT } from '@/utils';
import AppImage from './AppImage.vue';

const props = defineProps({ show: { type: Object, required: true } });

const priceText = computed(() =>
  Number(props.show.max_price) > Number(props.show.min_price)
    ? `${formatPrice(props.show.min_price, props.show.max_price)}`
    : `¥${Number(props.show.min_price || 0)}`
);
const categoryText = computed(() => CATEGORY_TEXT[props.show.category] || '演出');
const dateText = computed(() => formatDate(props.show.start_time, false));
</script>
