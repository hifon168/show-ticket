<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-bold">邀请码管理</h1>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="status" class="input !w-28" @change="load">
          <option value="all">全部</option>
          <option value="0">未使用</option>
          <option value="1">已使用</option>
        </select>
        <input v-model.number="gen.count" class="input !w-20" type="number" min="1" placeholder="数量" />
        <input v-model.number="gen.days" class="input !w-24" type="number" min="0" placeholder="有效期(天)" />
        <button class="btn-primary !py-1.5 text-sm" @click="generate">批量生成</button>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="min-w-[720px] w-full text-left text-sm">
        <thead class="bg-ink-50 text-xs text-ink-500">
          <tr>
            <th class="p-2.5">ID</th><th>邀请码</th><th>状态</th><th>使用者</th><th>使用时间</th><th>有效期</th><th class="w-24">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in list" :key="c.id" class="border-t border-ink-50">
            <td class="p-2.5 text-ink-500">{{ c.id }}</td>
            <td class="font-mono font-semibold">{{ c.code }}</td>
            <td>
              <span class="tag" :class="c.status ? 'bg-ink-100 text-ink-500' : 'bg-green-100 text-green-700'">
                {{ c.status ? '已使用' : '未使用' }}
              </span>
            </td>
            <td>{{ c.used_by_nickname ? `${c.used_by_nickname}(${c.used_by_phone})` : '—' }}</td>
            <td class="whitespace-nowrap">{{ c.used_at ? formatDate(c.used_at) : '—' }}</td>
            <td class="whitespace-nowrap">{{ c.expires_at ? formatDate(c.expires_at) : '长期有效' }}</td>
            <td>
              <button class="btn-ghost !px-2 !py-1 text-xs text-brand-500" @click="remove(c)">删除</button>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="7" class="p-6 text-center text-ink-300">暂无邀请码</td></tr>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex justify-center gap-2">
      <button class="btn-ghost" :disabled="pageNum <= 1" @click="pageNum--, load()">上一页</button>
      <span class="py-2 text-sm">第 {{ pageNum }} 页</span>
      <button class="btn-ghost" :disabled="list.length < pageSize" @click="pageNum++, load()">下一页</button>
    </div>

    <!-- 生成结果 -->
    <div v-if="created.length" class="card mt-4 p-3">
      <div class="mb-2 flex items-center justify-between">
        <h3 class="text-sm font-semibold">本次生成结果</h3>
        <button class="btn-ghost !py-1 text-xs" @click="copyCodes">复制全部</button>
      </div>
      <div class="flex flex-wrap gap-2">
        <span v-for="c in created" :key="c" class="rounded bg-ink-50 px-2 py-1 font-mono text-xs">{{ c }}</span>
      </div>
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
const pageSize = 20;
const created = ref([]);
const gen = reactive({ count: 10, days: 0 });

async function load() {
  const res = await adminApi.inviteCodes({ status: status.value, pageNum: pageNum.value, pageSize });
  list.value = res.list || [];
}

async function generate() {
  const count = Math.min(500, Math.max(1, gen.count || 10));
  const res = await adminApi.createInviteCodes({ count, days: gen.days || 0 });
  created.value = res.codes || [];
  window.$toast(`已生成 ${count} 个邀请码`);
  pageNum.value = 1;
  load();
}

async function remove(c) {
  if (!confirm(`确认删除邀请码 ${c.code}？`)) return;
  await adminApi.deleteInviteCode(c.id);
  load();
}

function copyCodes() {
  navigator.clipboard?.writeText(created.value.join('\n'));
  window.$toast('已复制到剪贴板');
}

onMounted(load);
</script>
