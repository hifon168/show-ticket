<template>
  <!--
    公共图片组件
    公网海报偶发加载失败（防盗链 / 网络）时自动回落到渐变占位 + 首字，
    避免出现浏览器默认的「破图」图标影响观感。
  -->
  <img
    v-if="src && !failed"
    :src="src"
    :alt="alt"
    :class="imgClass"
    loading="lazy"
    referrerpolicy="no-referrer"
    @error="failed = true"
  />
  <div
    v-else
    :class="[placeholderClass, 'flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-400 to-accent font-bold text-white']"
  >
    {{ initial }}
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  text: { type: String, default: '' }, // 用于取首字
  imgClass: { type: String, default: 'h-full w-full object-cover' },
  placeholderClass: { type: String, default: 'text-lg' },
});

const failed = ref(false);
// 图片地址变化时重置失败状态
watch(() => props.src, () => (failed.value = false));

const initial = computed(() => ((props.text || props.alt || '票').trim().slice(0, 1) || '票'));
</script>
