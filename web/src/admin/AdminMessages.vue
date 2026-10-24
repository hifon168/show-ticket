<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-bold">留言审核</h1>
      <select v-model="status" class="input !w-32" @change="load">
        <option value="all">全部</option>
        <option value="0">待审核</option>
        <option value="1">已通过</option>
        <option value="2">已拒绝</option>
      </select>
    </div>

    <div class="space-y-3">
      <div v-for="m in list" :key="m.id" class="card p-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>👤 {{ m.nickname }}（ID:{{ m.user_id }}）· {{ m.phone || '无手机号' }} · {{ formatDate(m.created_at) }}</span>
          <span class="tag" :class="statusClass(m.status)">{{ ['待审核', '已通过', '已拒绝'][m.status] }}</span>
        </div>
        <p class="mt-2 whitespace-pre-line text-sm">{{ m.content }}</p>
        <p v-if="m.contact" class="mt-1 text-xs text-ink-500">联系方式：{{ m.contact }}</p>
        <p v-if="m.reply" class="mt-2 rounded bg-ink-50 p-2 text-xs">已回复：{{ m.reply }}</p>

        <div class="mt-2 flex flex-wrap items-center gap-2">
          <input v-model="replies[m.id]" class="input !w-auto flex-1" placeholder="回复内容（选填）" />
          <button class="btn-primary !py-1 text-xs" @click="audit(m, 1)">通过</button>
          <button class="btn-ghost !py-1 text-xs" @click="audit(m, 2)">拒绝</button>
          <button class="btn-ghost !py-1 text-xs text-brand-500" @click="remove(m)">删除</button>
        </div>
      </div>
      <div v-if="!list.length" class="card p-8 text-center text-sm text-ink-300">暂无留言</div>
    </div>

    <div class="mt-3 flex justify-center gap-2">
      <button class="btn-ghost" :disabled="pageNum <= 1" @click="pageNum--, load()">上一页</button>
      <span class="py-2 text-sm">第 {{ pageNum }} 页</span>
      <button class="btn-ghost" :disabled="list.length < pageSize" @click="pageNum++, load()">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { adminApi } from '@/api';
import { formatDate } from '@/utils';

const list = ref([]);
const status = ref('all');
const pageNum = ref(1);
const pageSize = 10;
const replies = reactive({});

async function load() {
  const res = await adminApi.messages({ status: status.value, pageNum: pageNum.value, pageSize });
  list.value = res.list || [];
}

async function audit(m, st) {
  await adminApi.auditMessage(m.id, { status: st, reply: replies[m.id] || '' });
  window.$toast(st === 1 ? '已通过' : '已拒绝');
  load();
}
async function remove(m) {
  if (!confirm('确认删除该留言？')) return;
  await adminApi.deleteMessage(m.id);
  load();
}
function statusClass(s) {
  return ['bg-warn/15 text-warn', 'bg-green-100 text-green-700', 'bg-brand-50 text-brand-500'][s] || '';
}

onMounted(load);
</script>
