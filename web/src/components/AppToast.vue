<template>
  <!-- 全局轻提示 -->
  <div class="pointer-events-none fixed inset-x-0 top-1/2 z-[9999] flex justify-center">
    <transition name="fade">
      <div
        v-if="visible"
        class="max-w-[80%] rounded-lg bg-ink-900/90 px-4 py-2.5 text-sm text-white shadow-pop"
      >
        {{ text }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const visible = ref(false);
const text = ref('');
let timer = null;

function show(msg, duration = 1800) {
  text.value = msg;
  visible.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => (visible.value = false), duration);
}

onMounted(() => {
  // 挂载到全局，供 axios 拦截器直接调用
  window.$toast = show;
});
onBeforeUnmount(() => {
  window.$toast = null;
  clearTimeout(timer);
});

defineExpose({ show });
</script>
