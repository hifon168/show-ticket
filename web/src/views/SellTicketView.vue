<template>
  <div class="min-h-screen pb-24 md:pb-10">
    <NavBar title="发布票务售卖" />

    <div class="p-3 md:mx-auto md:max-w-[720px]">
      <form class="space-y-3" @submit.prevent="submit">
        <!-- 关联演出 -->
        <div class="card p-3">
          <label class="mb-1 block text-sm font-semibold">关联演出 <span class="text-brand-500">*</span></label>
          <select v-model="form.showId" class="input">
            <option value="">请选择演出</option>
            <option v-for="s in shows" :key="s.id" :value="s.id">
              {{ s.title }}（{{ s.city }} · {{ formatDate(s.start_time, false) }}）
            </option>
          </select>
          <p class="mt-1 text-[11px] text-ink-300">找不到演出？请先联系客服在后台录入，或使用每日同步数据。</p>
        </div>

        <!-- 票品信息 -->
        <div class="card space-y-2 p-3">
          <h3 class="text-sm font-semibold">票品信息</h3>
          <input v-model="form.title" class="input" placeholder="标题（选填，默认取演出名）" />
          <div class="grid grid-cols-2 gap-2">
            <input v-model="form.tierName" class="input" placeholder="票档，如 内场A区" />
            <input v-model="form.seatInfo" class="input" placeholder="座位，如 3排12号" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="form.originalPrice" class="input" type="number" placeholder="票面价（元）" />
            <input v-model="form.sellPrice" class="input" type="number" placeholder="转让价（元）*" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <input v-model="form.quantity" class="input" type="number" min="1" placeholder="可售数量*" />
            <input v-model="form.contactPhone" class="input" type="tel" placeholder="联系电话" />
          </div>
          <textarea v-model="form.description" class="input h-24 resize-none" placeholder="转让说明：如 临时有事去不了、可小刀、支持平台担保交易等" />
        </div>

        <!-- 图片（URL 形式，多个用逗号分隔） -->
        <div class="card p-3">
          <label class="mb-1 block text-sm font-semibold">票品图片</label>
          <input v-model="imageText" class="input" placeholder="图片URL，多个用英文逗号分隔" />
        </div>

        <button class="btn-primary w-full !py-3 text-base" :disabled="submitting">
          {{ submitting ? '发布中...' : '发布到二手集市' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { showApi, ticketApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/utils';
import NavBar from '@/components/NavBar.vue';

const route = useRoute();
const router = useRouter();
const user = useUserStore();

const shows = ref([]);
const submitting = ref(false);
const imageText = ref('');

const form = reactive({
  showId: route.query.showId || '',
  title: '',
  tierName: '',
  seatInfo: '',
  originalPrice: '',
  sellPrice: '',
  quantity: 1,
  contactPhone: user.userInfo?.phone || '',
  description: '',
});

async function loadShows() {
  const res = await showApi.list({ pageSize: 100, sort: 'time' });
  shows.value = res.list || [];
}

async function submit() {
  if (!form.showId) return window.$toast('请选择关联演出');
  if (!form.sellPrice || Number(form.sellPrice) <= 0) return window.$toast('请填写转让价');
  if (!form.quantity || Number(form.quantity) < 1) return window.$toast('请填写可售数量');

  submitting.value = true;
  try {
    await ticketApi.create({
      showId: Number(form.showId),
      title: form.title,
      tierName: form.tierName,
      seatInfo: form.seatInfo,
      originalPrice: Number(form.originalPrice || form.sellPrice),
      sellPrice: Number(form.sellPrice),
      quantity: Number(form.quantity),
      contactPhone: form.contactPhone,
      description: form.description,
      images: imageText.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    window.$toast('发布成功');
    router.replace('/mine/tickets');
  } catch (e) {
    /* 已提示 */
  } finally {
    submitting.value = false;
  }
}

onMounted(loadShows);
</script>
