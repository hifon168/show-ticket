<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-bold">订单管理</h1>
      <div class="flex flex-wrap items-center gap-2">
        <select v-model="status" class="input !w-32" @change="load">
          <option value="all">全部状态</option>
          <option value="0">待支付</option>
          <option value="1">已支付</option>
          <option value="2">已取消</option>
          <option value="3">已完成</option>
          <option value="4">已退款</option>
        </select>
        <button class="btn-ghost !py-1.5 text-sm" @click="showGuide = !showGuide">{{ showGuide ? '收起说明' : '❔ 导入说明' }}</button>
        <button class="btn-ghost !py-1.5 text-sm" @click="downloadTemplate">⬇ 下载导入模板</button>
        <button class="btn-primary !py-1.5 text-sm" :disabled="importing" @click="pickFile">
          {{ importing ? '导入中...' : '⬆ Excel 导入订单' }}
        </button>
        <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="onFileChange" />
      </div>
    </div>

    <!-- 导入列说明 -->
    <div v-if="showGuide" class="card mb-3 bg-ink-50 p-3 text-xs leading-relaxed text-ink-500">
      <p class="mb-1 font-semibold text-ink">模板列（中文表头，顺序任意）：</p>
      <p class="mb-2">
        <span class="font-medium text-ink">票品来源</span>
        填 <span class="text-brand-500">官方</span> 或 <span class="text-brand-500">二手</span>（缺省官方）·
        <span class="font-medium text-ink">二手票ID</span> 二手票必填，自动关联票品、卖家与挂单价 ·
        <span class="font-medium text-ink">演出ID / 演出名称</span> 官方票二选一，ID 优先 ·
        <span class="font-medium text-ink">票档名称</span> 可空 ·
        <span class="font-medium text-ink">买方姓名 / 手机号</span> 必填 ·
        <span class="font-medium text-ink">数量</span> 缺省 1 ·
        <span class="font-medium text-ink">单价</span> 缺省自动取票档价或挂单价 ·
        <span class="font-medium text-ink">订单状态</span> 待支付/已支付/已取消/已完成/已退款，缺省已支付
      </p>
      <p class="text-ink-300">注：导入订单不扣减库存，订单号随机生成不连号，导入结果会逐行返回失败原因。</p>
    </div>

    <!-- 导入结果 -->
    <div v-if="importResult" class="card mb-3 p-3 text-sm">
      <div class="flex items-center justify-between">
        <span class="font-semibold">
          导入结果：成功 {{ importResult.success }} 条 / 共 {{ importResult.total }} 条
        </span>
        <button class="text-xs text-ink-300" @click="importResult = null">关闭</button>
      </div>
      <ul v-if="importResult.failed.length" class="mt-2 max-h-40 overflow-y-auto text-xs text-brand-500">
        <li v-for="f in importResult.failed" :key="f.row">第 {{ f.row }} 行：{{ f.reason }}</li>
      </ul>
    </div>

    <div class="card overflow-x-auto">
      <table class="min-w-[860px] w-full text-left text-sm">
        <thead class="bg-ink-50 text-xs text-ink-500">
          <tr>
            <th class="p-2.5">订单号</th><th>演出</th><th>买方姓名</th><th>账号</th><th>票档</th><th>数量</th><th>金额</th><th>来源</th><th>状态</th><th>下单时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in list" :key="o.id" class="border-t border-ink-50">
            <td class="p-2.5 font-mono text-xs">{{ o.order_no }}</td>
            <td class="max-w-[180px]"><p class="line-1">{{ o.show_title }}</p></td>
            <td>{{ o.buyer_name || '—' }}</td>
            <td>{{ o.buyer_nickname || '—' }}</td>
            <td class="max-w-[140px]"><p class="line-1">{{ o.tier_name }}</p></td>
            <td>{{ o.quantity }}</td>
            <td class="font-semibold text-brand-500">¥{{ o.amount }}</td>
            <td>
              <span class="tag bg-ink-100 text-ink-500">{{ sourceText(o.source) }}</span>
              <span v-if="isImported(o)" class="ml-1 text-[10px] text-ink-300">导入</span>
            </td>
            <td>
              <span class="tag" :class="statusClass(o.status)">{{ ORDER_STATUS_TEXT[o.status] }}</span>
            </td>
            <td class="whitespace-nowrap">{{ formatDate(o.created_at) }}</td>
          </tr>
          <tr v-if="!list.length"><td colspan="10" class="p-6 text-center text-ink-300">暂无订单</td></tr>
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
import { formatDate, ORDER_STATUS_TEXT } from '@/utils';

const list = ref([]);
const status = ref('all');
const pageNum = ref(1);
const pageSize = 20;
const fileInput = ref(null);
const importing = ref(false);
const importResult = ref(null);
const showGuide = ref(false);

async function load() {
  const res = await adminApi.orders({ status: status.value, pageNum: pageNum.value, pageSize });
  list.value = res.list || [];
}

/** 下载 Excel 导入模板（带 token 的 blob 下载） */
async function downloadTemplate() {
  try {
    const blob = await adminApi.orderTemplate();
    if (!blob || blob.size === 0) return window.$toast('模板下载失败，请重试');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'order_import_template.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    window.$toast('模板已开始下载');
  } catch (e) {
    /* 已提示 */
  }
}

function pickFile() {
  fileInput.value?.click();
}

async function onFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  importing.value = true;
  try {
    importResult.value = await adminApi.importOrders(fd);
    window.$toast(`导入完成：成功 ${importResult.value.success} 条`);
    pageNum.value = 1;
    load();
  } catch (err) {
    /* 已提示 */
  } finally {
    importing.value = false;
    e.target.value = ''; // 允许重复选择同一文件
  }
}

function sourceText(s) {
  return { official: '官方', resale: '二手', import: 'Excel导入' }[s] || s || '—';
}

/** 识别 Excel 导入的历史订单（默认备注为「Excel导入」） */
function isImported(o) {
  return String(o.remark || '').includes('Excel导入');
}

function statusClass(s) {
  return ['bg-warn/15 text-warn', 'bg-brand-50 text-brand-500', 'bg-ink-100 text-ink-500', 'bg-green-100 text-green-700', 'bg-ink-100 text-ink-500'][s] || '';
}

onMounted(load);
</script>
