<template>
  <!-- 通用顶部导航：标题居中，左侧返回，右侧插槽 -->
  <header
    class="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-ink-100 bg-white/95 px-2 backdrop-blur"
  >
    <button class="flex h-9 w-9 items-center justify-center rounded-full active:bg-ink-50" @click="back">
      <svg viewBox="0 0 24 24" class="h-5 w-5 text-ink-900" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <h1 class="flex-1 truncate text-center text-[16px] font-semibold">{{ title }}</h1>
    <div class="w-9">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup>
import { useRouter } from 'vue-router';
const props = defineProps({ title: { type: String, default: '' } });
const router = useRouter();
function back() {
  if (window.history.length > 1) router.back();
  else router.push('/');
}
</script>
