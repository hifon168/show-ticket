<template>
  <!-- 列表骨架屏 -->
  <div class="space-y-3">
    <div v-for="i in count" :key="i" class="card flex gap-3 p-3">
      <div class="skeleton h-[92px] w-[68px] shrink-0 md:h-[110px] md:w-[82px]"></div>
      <div class="flex flex-1 flex-col justify-between py-1">
        <div>
          <div class="skeleton h-4 w-4/5"></div>
          <div class="skeleton mt-2 h-3 w-2/5"></div>
          <div class="skeleton mt-2 h-3 w-3/5"></div>
        </div>
        <div class="skeleton h-4 w-1/3"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ count: { type: Number, default: 4 } });
</script>
