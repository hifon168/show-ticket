<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-bold">演出管理</h1>
      <div class="flex gap-2">
        <input v-model="keyword" class="input !w-48" placeholder="搜索名称/艺人/场馆" @keyup.enter="load" />
        <select v-model="status" class="input !w-28" @change="load">
          <option value="all">全部状态</option>
          <option value="1">已上架</option>
          <option value="0">已下架</option>
        </select>
        <button class="btn-primary !py-1.5 text-sm" @click="openCreate">+ 新增演出</button>
      </div>
    </div>

    <div class="card overflow-x-auto">
      <table class="min-w-[820px] w-full text-left text-sm">
        <thead class="bg-ink-50 text-xs text-ink-500">
          <tr>
            <th class="p-2.5">ID</th><th>演出名称</th><th>类型</th><th>城市</th><th>场馆</th>
            <th>开演时间</th><th>票价区间</th><th>状态</th><th class="w-40">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in list" :key="s.id" class="border-t border-ink-50">
            <td class="p-2.5 text-ink-500">{{ s.id }}</td>
            <td class="max-w-[220px]"><p class="line-1">{{ s.title }}</p></td>
            <td>{{ CATEGORY_TEXT[s.category] || s.category }}</td>
            <td>{{ s.city }}</td>
            <td class="max-w-[140px]"><p class="line-1">{{ s.venue_name }}</p></td>
            <td class="whitespace-nowrap">{{ formatDate(s.start_time) }}</td>
            <td class="whitespace-nowrap">¥{{ s.min_price }} - {{ s.max_price }}</td>
            <td>
              <span class="tag" :class="s.status ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-500'">
                {{ s.status ? '上架' : '下架' }}
              </span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn-ghost !px-2 !py-1 text-xs" @click="openEdit(s)">编辑</button>
                <button class="btn-ghost !px-2 !py-1 text-xs" @click="toggle(s)">{{ s.status ? '下架' : '上架' }}</button>
                <button class="btn-ghost !px-2 !py-1 text-xs text-brand-500" @click="remove(s)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="9" class="p-6 text-center text-ink-300">暂无数据</td></tr>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex justify-center gap-2">
      <button class="btn-ghost" :disabled="pageNum <= 1" @click="pageNum--, load()">上一页</button>
      <span class="py-2 text-sm">第 {{ pageNum }} 页</span>
      <button class="btn-ghost" :disabled="list.length < pageSize" @click="pageNum++, load()">下一页</button>
    </div>

    <!-- ================= 新增/编辑弹窗 ================= -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" @click.self="showModal = false">
      <div class="my-4 w-full max-w-2xl rounded-2xl bg-white p-4">
        <h2 class="mb-3 text-lg font-bold">{{ editing ? '编辑演出' : '新增演出' }}</h2>

        <div class="grid gap-2 md:grid-cols-2">
          <input v-model="form.title" class="input md:col-span-2" placeholder="演出名称 *" />
          <input v-model="form.subtitle" class="input md:col-span-2" placeholder="副标题" />
          <select v-model="form.category" class="input">
            <option v-for="c in categories" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
          <input v-model="form.artist" class="input" placeholder="艺人/团体" />
          <input v-model="form.city" class="input" placeholder="城市" />
          <input v-model="form.venue_name" class="input" placeholder="场馆名称" />
          <input v-model="form.address" class="input md:col-span-2" placeholder="详细地址" />
          <input v-model="form.poster" class="input md:col-span-2" placeholder="海报图片URL" />
          <div>
            <label class="mb-1 block text-xs text-ink-500">开演时间</label>
            <input v-model="form.start_time" class="input" type="datetime-local" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-ink-500">结束时间</label>
            <input v-model="form.end_time" class="input" type="datetime-local" />
          </div>
          <input v-model="form.tags" class="input md:col-span-2" placeholder="标签（逗号分隔）" />
          <textarea v-model="form.description" class="input h-24 resize-none md:col-span-2" placeholder="演出介绍"></textarea>
        </div>

        <!-- 票档管理 -->
        <div class="mt-3">
          <div class="mb-1 flex items-center justify-between">
            <h3 class="text-sm font-semibold">票档设置</h3>
            <div class="flex gap-1">
              <button class="btn-ghost !px-2 !py-1 text-xs" @click="addTier">+ 添加票档</button>
              <button v-if="editing" class="btn-ghost !px-2 !py-1 text-xs" @click="saveTiers">保存票档</button>
            </div>
          </div>
          <div v-for="(t, i) in form.tiers" :key="i" class="mb-1.5 flex gap-1.5">
            <input v-model="t.name" class="input" placeholder="票档名称" />
            <input v-model="t.price" class="input !w-24" type="number" placeholder="售价" />
            <input v-model="t.original_price" class="input !w-24" type="number" placeholder="原价" />
            <input v-model="t.stock" class="input !w-20" type="number" placeholder="库存" />
            <button class="btn-ghost !px-2 text-brand-500" @click="form.tiers.splice(i, 1)">✕</button>
          </div>
          <p v-if="!form.tiers.length" class="text-xs text-ink-300">暂无票档（编辑保存后可逐个添加）</p>
        </div>

        <div class="mt-4 flex justify-end gap-2">
          <button class="btn-ghost" @click="showModal = false">取消</button>
          <button class="btn-primary" @click="save">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { adminApi } from '@/api';
import { useConfigStore } from '@/stores/config';
import { formatDate, CATEGORY_TEXT } from '@/utils';

const config = useConfigStore();
const categories = ref([]);

const list = ref([]);
const keyword = ref('');
const status = ref('all');
const pageNum = ref(1);
const pageSize = 10;
const showModal = ref(false);
const editing = ref(false);

const form = reactive({
  id: 0,
  title: '', subtitle: '', category: 'concert', poster: '', artist: '', venue_name: '',
  city: '', address: '', start_time: '', end_time: '', tags: '', description: '', status: 1,
  tiers: [],
});

/** datetime-local 需要 YYYY-MM-DDTHH:mm */
function toLocal(d) {
  if (!d) return '';
  const s = String(d).replace(/-/g, '/').slice(0, 16);
  const dt = new Date(s);
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}T${p(dt.getHours())}:${p(dt.getMinutes())}`;
}
function toMysql(v) {
  return v ? v.replace('T', ' ') + ':00' : '';
}

async function load() {
  if (!categories.value.length) {
    await config.load();
    categories.value = config.categories;
  }
  const res = await adminApi.shows({ keyword: keyword.value, status: status.value, pageNum: pageNum.value, pageSize });
  list.value = res.list || [];
}

function openCreate() {
  editing.value = false;
  Object.assign(form, {
    id: 0, title: '', subtitle: '', category: 'concert', poster: '', artist: '', venue_name: '',
    city: '', address: '', start_time: '', end_time: '', tags: '', description: '', status: 1, tiers: [],
  });
  showModal.value = true;
}

async function openEdit(s) {
  editing.value = true;
  const detail = await adminApi.showDetail(s.id);
  Object.assign(form, {
    ...detail,
    start_time: toLocal(detail.start_time),
    end_time: toLocal(detail.end_time),
    tiers: (detail.tiers || []).map((t) => ({ id: t.id, name: t.name, price: t.price, original_price: t.original_price, stock: t.stock })),
  });
  showModal.value = true;
}

function addTier() {
  form.tiers.push({ name: '', price: 0, original_price: 0, stock: 100 });
}

async function save() {
  if (!form.title) return window.$toast('请填写演出名称');
  const payload = {
    ...form,
    start_time: toMysql(form.start_time),
    end_time: toMysql(form.end_time),
    minPrice: form.tiers.length ? Math.min(...form.tiers.map((t) => Number(t.price))) : undefined,
    maxPrice: form.tiers.length ? Math.max(...form.tiers.map((t) => Number(t.price))) : undefined,
  };
  if (editing.value) {
    await adminApi.updateShow(form.id, payload);
    window.$toast('保存成功');
  } else {
    await adminApi.createShow(payload);
    window.$toast('新增成功');
  }
  showModal.value = false;
  load();
}

/** 编辑态下单独保存票档（新增 / 更新） */
async function saveTiers() {
  for (const t of form.tiers) {
    if (!t.name) continue;
    if (t.id) await adminApi.updateTier(t.id, t);
    else await adminApi.createTier({ show_id: form.id, ...t });
  }
  window.$toast('票档已保存');
  const detail = await adminApi.showDetail(form.id);
  form.tiers = detail.tiers.map((t) => ({ id: t.id, name: t.name, price: t.price, original_price: t.original_price, stock: t.stock }));
}

async function toggle(s) {
  await adminApi.updateShow(s.id, { status: s.status ? 0 : 1 });
  load();
}
async function remove(s) {
  if (!confirm(`确认删除《${s.title}》？`)) return;
  await adminApi.deleteShow(s.id);
  load();
}

onMounted(load);
</script>
