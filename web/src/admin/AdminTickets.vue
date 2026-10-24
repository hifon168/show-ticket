<template>
  <div>
    <h1 class="mb-4 text-xl font-bold">二手票管理</h1>

    <div class="card overflow-x-auto">
      <table class="min-w-[900px] w-full text-left text-sm">
        <thead class="bg-ink-50 text-xs text-ink-500">
          <tr>
            <th class="p-2.5">ID</th><th>演出</th><th>卖家</th><th>票档/座位</th><th>票面价</th><th>转让价</th><th>数量</th><th>状态</th><th>发布时间</th><th class="w-32">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in list" :key="t.id" class="border-t border-ink-50">
            <td class="p-2.5 text-ink-500">{{ t.id }}</td>
            <td class="max-w-[180px]"><p class="line-1">{{ t.show_title }}</p></td>
            <td>{{ t.seller_nickname }}</td>
            <td class="max-w-[160px]"><p class="line-1">{{ t.tier_name }} {{ t.seat_info }}</p></td>
            <td>¥{{ t.original_price }}</td>
            <td class="font-semibold text-brand-500">¥{{ t.sell_price }}</td>
            <td>{{ t.quantity }}</td>
            <td>
              <span class="tag" :class="t.status === 0 ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-500'">
                {{ TICKET_STATUS_TEXT[t.status] }}
              </span>
            </td>
            <td class="whitespace-nowrap">{{ formatDate(t.created_at) }}</td>
            <td>
              <div class="flex gap-1">
                <button class="btn-ghost !px-2 !py-1 text-xs" @click="setStatus(t, t.status === 0 ? 2 : 0)">
                  {{ t.status === 0 ? '下架' : '上架' }}
                </button>
                <button class="btn-ghost !px-2 !py-1 text-xs text-brand-500" @click="remove(t)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="10" class="p-6 text-center text-ink-300">暂无票品</td></tr>
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
import { formatDate, TICKET_STATUS_TEXT } from '@/utils';

const list = ref([]);
const pageNum = ref(1);
const pageSize = 20;

async function load() {
  const res = await adminApi.tickets({ pageNum: pageNum.value, pageSize });
  list.value = res.list || [];
}

async function setStatus(t, st) {
  await adminApi.setTicketStatus(t.id, st);
  window.$toast(st === 0 ? '已上架' : '已下架');
  load();
}
async function remove(t) {
  if (!confirm('确认删除该票品？')) return;
  await adminApi.deleteTicket(t.id);
  load();
}

onMounted(load);
</script>
