<template>
  <div>
    <h1 class="mb-4 text-xl font-bold">数据概览</h1>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
      <div v-for="c in cards" :key="c.text" class="card p-4">
        <p class="text-xs text-ink-500">{{ c.text }}</p>
        <p class="mt-1 text-2xl font-bold" :class="c.color || ''">{{ stats[c.key] ?? 0 }}</p>
      </div>
    </div>

    <!-- 演出资讯同步 -->
    <div class="card mt-4 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="font-semibold">每日演出资讯同步</h2>
          <p class="mt-0.5 text-xs text-ink-500">
            系统按 <code>SYNC_CRON</code>（默认每天晚上 23:00）从公网真实数据源自动同步演出数据、 poster 海报与详情页文案。
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn-ghost !py-1.5 text-xs" @click="loadLogs">刷新日志</button>
          <button class="btn-primary !py-1.5 text-xs" :disabled="syncing" @click="runSync">
            {{ syncing ? '同步中...' : '立即同步' }}
          </button>
        </div>
      </div>

      <!-- 实时进度 -->
      <div v-if="syncing || progress.length" class="mt-3 rounded-lg bg-ink-50 p-3">
        <div class="flex items-center justify-between text-xs">
          <span class="font-semibold">
            {{ syncing ? '正在从公网同步真实演出数据…' : '本次同步已完成' }}
          </span>
          <span class="text-ink-300">{{ progress.length }} 条进度</span>
        </div>
        <ul class="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-[11px] leading-5 text-ink-500">
          <li v-for="(p, i) in progress" :key="i">
            <span class="text-ink-300">{{ fmtTime(p.t) }}</span> {{ p.m }}
          </li>
        </ul>
      </div>

      <div class="mt-3 overflow-x-auto">
        <table class="min-w-[560px] w-full text-left text-xs">
          <thead class="text-ink-500">
            <tr>
              <th class="py-1.5">时间</th><th>来源</th><th>总数</th><th>新增</th><th>更新</th><th>状态</th><th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in logs" :key="l.id" class="border-t border-ink-50">
              <td class="py-1.5">{{ formatDate(l.finished_at || l.started_at) }}</td>
              <td>{{ l.source }}</td>
              <td>{{ l.total }}</td>
              <td>{{ l.created_count }}</td>
              <td>{{ l.updated_count }}</td>
              <td>
                <span class="tag" :class="l.status ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-500'">
                  {{ l.status ? '成功' : '失败' }}
                </span>
              </td>
              <td class="text-ink-500">{{ l.message }}</td>
            </tr>
            <tr v-if="!logs.length"><td colspan="7" class="py-4 text-center text-ink-300">暂无同步记录</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { adminApi } from '@/api';
import { formatDate } from '@/utils';

const stats = ref({});
const logs = ref([]);
const syncing = ref(false);
const progress = ref([]);
let timer = null;

const fmtTime = (t) => new Date(t).toLocaleTimeString('zh-CN', { hour12: false });

const cards = [
  { key: 'users', text: '注册用户' },
  { key: 'shows', text: '演出总数' },
  { key: 'orders', text: '订单总数' },
  { key: 'tickets', text: '二手票品' },
  { key: 'unusedCodes', text: '未使用邀请码' },
  { key: 'pendingMessages', text: '待审留言', color: 'text-warn' },
  { key: 'gmv', text: '成交额(¥)', color: 'text-brand-500' },
];

/** 轮询同步进度 */
async function pollStatus() {
  try {
    const s = await adminApi.syncStatus();
    progress.value = s.progress || [];
    syncing.value = !!s.running;
    if (!s.running) {
      clearInterval(timer);
      timer = null;
      if (s.lastError) window.$toast(s.lastError);
      else if (s.lastResult) {
        window.$toast(`同步完成：新增 ${s.lastResult.created} / 更新 ${s.lastResult.updated}`);
      }
      load();
      loadLogs();
    }
  } catch (e) {
    /* 忽略单次轮询异常 */
  }
}

async function load() {
  stats.value = await adminApi.stats();
}
async function loadLogs() {
  const res = await adminApi.syncLogs({ pageSize: 10 });
  logs.value = res.list || [];
}
async function runSync() {
  if (syncing.value) return;
  try {
    await adminApi.runSync();
    syncing.value = true;
    progress.value = [];
    window.$toast('同步任务已启动');
    timer = setInterval(pollStatus, 1500);
    pollStatus();
  } catch (e) {
    /* 已提示 */
  }
}

onMounted(() => {
  load();
  loadLogs();
});
</script>
