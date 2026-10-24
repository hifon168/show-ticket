<template>
  <div class="min-h-screen">
    <NavBar title="留言反馈" />
    <div class="p-3 md:mx-auto md:max-w-[720px]">
      <!-- 提交留言 -->
      <div class="card p-3">
        <h3 class="mb-2 text-sm font-semibold">我要留言</h3>
        <textarea
          v-model="content"
          class="input h-24 resize-none"
          placeholder="遇到的问题、功能建议、投诉举报…（提交后需管理员审核）"
        ></textarea>
        <input v-model="contact" class="input mt-2" placeholder="联系方式（选填）" />
        <button class="btn-primary mt-3 w-full !py-2.5" @click="submit">提交留言</button>
      </div>

      <!-- 我的留言 -->
      <div class="card mt-3 p-3">
        <h3 class="mb-2 text-sm font-semibold">我的留言</h3>
        <div v-if="!mine.length" class="py-6 text-center text-xs text-ink-300">暂无留言</div>
        <ul v-else class="space-y-3">
          <li v-for="m in mine" :key="m.id" class="rounded-lg bg-ink-50 p-2.5 text-sm">
            <p>{{ m.content }}</p>
            <div class="mt-1 flex items-center justify-between text-[11px] text-ink-500">
              <span>{{ fromNow(m.created_at) }}</span>
              <span
                class="tag"
                :class="m.status === 1 ? 'bg-green-100 text-green-700' : m.status === 2 ? 'bg-brand-50 text-brand-500' : 'bg-ink-100 text-ink-500'"
              >
                {{ ['待审核', '已通过', '已拒绝'][m.status] }}
              </span>
            </div>
            <p v-if="m.reply" class="mt-1.5 rounded bg-white p-2 text-xs text-ink-700">官方回复：{{ m.reply }}</p>
          </li>
        </ul>
      </div>

      <!-- 留言墙 -->
      <div class="card mt-3 p-3">
        <h3 class="mb-2 text-sm font-semibold">大家怎么说</h3>
        <div v-if="!pub.length" class="py-6 text-center text-xs text-ink-300">暂无公开留言</div>
        <ul v-else class="space-y-2">
          <li v-for="m in pub" :key="m.id" class="border-b border-ink-50 pb-2 text-sm last:border-0">
            <p class="text-xs text-ink-500">{{ m.nickname }} · {{ fromNow(m.created_at) }}</p>
            <p class="mt-0.5">{{ m.content }}</p>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { userApi } from '@/api';
import { fromNow } from '@/utils';
import NavBar from '@/components/NavBar.vue';

const content = ref('');
const contact = ref('');
const mine = ref([]);
const pub = ref([]);

async function load() {
  const [a, b] = await Promise.all([userApi.messages({ pageSize: 20 }), userApi.publicMessages()]);
  mine.value = a.list || [];
  pub.value = b || [];
}

async function submit() {
  if (content.value.trim().length < 2) return window.$toast('留言内容至少 2 个字');
  await userApi.addMessage({ content: content.value, contact: contact.value });
  content.value = '';
  window.$toast('提交成功，等待审核');
  load();
}

onMounted(load);
</script>
