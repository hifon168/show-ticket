<template>
  <!-- 下拉刷新容器：移动端手势下拉，桌面端点击右上角刷新按钮 -->
  <div
    ref="box"
    class="relative"
    @touchstart.passive="onStart"
    @touchmove="onMove"
    @touchend="onEnd"
    @touchcancel="onEnd"
  >
    <!-- 下拉提示条 -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center overflow-hidden text-xs text-ink-500 transition-[height] duration-150"
      :style="{ height: pullHeight + 'px' }"
    >
      <span v-if="loading">🔄 正在刷新...</span>
      <span v-else>{{ pullHeight >= threshold ? '↓ 松开立即刷新' : '↓ 下拉刷新' }}</span>
    </div>

    <div :style="{ transform: `translateY(${pullHeight}px)` }" :class="loading ? '' : 'transition-transform duration-150'">
      <slot />
    </div>

    <!-- 桌面端刷新按钮 -->
    <button
      class="fixed right-4 bottom-24 z-30 hidden h-11 w-11 items-center justify-center rounded-full bg-white shadow-pop md:flex"
      title="刷新"
      @click="doRefresh"
    >
      <span :class="loading ? 'animate-spin' : ''">🔄</span>
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  loading: { type: Boolean, default: false },
  threshold: { type: Number, default: 60 },
});
const emit = defineEmits(['refresh']);

const box = ref(null);
const pullHeight = ref(0);
const loading = ref(false);
let startY = 0;
let dragging = false;

function onStart(e) {
  if (loading.value) return;
  // 仅当页面处于顶部时才允许下拉
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  if (scrollTop > 0) return;
  startY = e.touches[0].clientY;
  dragging = true;
}
function onMove(e) {
  if (!dragging) return;
  const dy = e.touches[0].clientY - startY;
  if (dy <= 0) {
    pullHeight.value = 0;
    return;
  }
  pullHeight.value = Math.min(100, dy * 0.45);
}
function onEnd() {
  if (!dragging) return;
  dragging = false;
  if (pullHeight.value >= props.threshold) doRefresh();
  else pullHeight.value = 0;
}
async function doRefresh() {
  loading.value = true;
  pullHeight.value = 44;
  try {
    await new Promise((resolve) => emit('refresh', resolve));
  } finally {
    setTimeout(() => {
      loading.value = false;
      pullHeight.value = 0;
    }, 200);
  }
}
defineExpose({ doRefresh });
</script>
