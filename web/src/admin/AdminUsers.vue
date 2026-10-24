<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-bold">用户管理</h1>
      <div class="flex gap-2">
        <input v-model="keyword" class="input !w-56" placeholder="搜索手机号/昵称" @keyup.enter="load" />
        <button class="btn-ghost !py-1.5 text-sm" @click="load">搜索</button>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="min-w-[760px] w-full text-left text-sm">
        <thead class="bg-ink-50 text-xs text-ink-500">
          <tr>
            <th class="p-2.5">ID</th><th>昵称</th><th>手机号</th><th>角色</th><th>订单数</th><th>城市</th><th>注册时间</th><th>状态</th><th class="w-24">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in list" :key="u.id" class="border-t border-ink-50">
            <td class="p-2.5 text-ink-500">{{ u.id }}</td>
            <td>{{ u.nickname }}</td>
            <td>{{ u.phone }}</td>
            <td>
              <span class="tag" :class="u.role === 1 ? 'bg-brand-50 text-brand-500' : 'bg-ink-100 text-ink-500'">
                {{ u.role === 1 ? '管理员' : '普通用户' }}
              </span>
            </td>
            <td>{{ u.order_count }}</td>
            <td>{{ u.city || '—' }}</td>
            <td class="whitespace-nowrap">{{ formatDate(u.created_at) }}</td>
            <td>
              <span class="tag" :class="u.status ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-500'">
                {{ u.status ? '正常' : '已禁用' }}
              </span>
            </td>
            <td>
              <button class="btn-ghost !px-2 !py-1 text-xs" @click="toggle(u)">{{ u.status ? '禁用' : '启用' }}</button>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="9" class="p-6 text-center text-ink-300">暂无用户</td></tr>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex justify-center gap-2">
      <button class="btn-ghost" :disabled="pageNum <= 1" @click="pageNum--, load()">上一页</button>
      <span class="py-2 text-sm">第 {{ pageNum }} 页</span>
      <button class="btn-ghost" :disabled="list.length < pageSize" @click="pageNum++, load()">下一页</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '@/api';
import { formatDate } from '@/utils';

const list = ref([]);
const keyword = ref('');
const pageNum = ref(1);
const pageSize = 20;

async function load() {
  const res = await adminApi.users({ keyword: keyword.value, pageNum: pageNum.value, pageSize });
  list.value = res.list || [];
}

async function toggle(u) {
  if (u.role === 1) return window.$toast('不能禁用管理员');
  await adminApi.setUserStatus(u.id, u.status ? 0 : 1);
  window.$toast(u.status ? '已禁用' : '已启用');
  load();
}

onMounted(load);
</script>
