<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="text-5xl">{{ icon }}</div>
    <p class="mt-3 text-sm text-ink-500">{{ text }}</p>
    <slot />
  </div>
</template>

<script setup>
defineProps({ icon: { type: String, default: '🎭' }, text: { type: String, default: '暂无数据' } });
</script>
