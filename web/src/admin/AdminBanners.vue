<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-xl font-bold">首页轮播管理</h1>
      <button class="btn-primary !py-1.5 text-sm" @click="add">+ 新增轮播</button>
    </div>

    <div class="card overflow-x-auto">
      <table class="min-w-[760px] w-full text-left text-sm">
        <thead class="bg-ink-50 text-xs text-ink-500">
          <tr>
            <th class="p-2.5">ID</th><th>标题</th><th>图片URL</th><th>跳转演出ID</th><th>排序</th><th>状态</th><th class="w-32">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in list" :key="b.id" class="border-t border-ink-50">
            <td class="p-2.5 text-ink-500">{{ b.id }}</td>
            <td class="max-w-[200px]"><p class="line-1">{{ b.title }}</p></td>
            <td class="max-w-[220px]"><p class="line-1 text-xs text-ink-500">{{ b.image || '（使用渐变占位）' }}</p></td>
            <td>{{ b.show_id || '—' }}</td>
            <td>{{ b.sort }}</td>
            <td>
              <span class="tag" :class="b.status ? 'bg-green-100 text-green-700' : 'bg-ink-100 text-ink-500'">
                {{ b.status ? '显示' : '隐藏' }}
              </span>
            </td>
            <td>
              <div class="flex gap-1">
                <button class="btn-ghost !px-2 !py-1 text-xs" @click="edit(b)">编辑</button>
                <button class="btn-ghost !px-2 !py-1 text-xs text-brand-500" @click="remove(b)">删除</button>
              </div>
            </td>
          </tr>
          <tr v-if="!list.length"><td colspan="7" class="p-6 text-center text-ink-300">暂无轮播</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑弹窗 -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showModal = false">
      <div class="w-full max-w-md rounded-2xl bg-white p-4">
        <h2 class="mb-3 font-bold">{{ form.id ? '编辑轮播' : '新增轮播' }}</h2>
        <div class="space-y-2">
          <input v-model="form.title" class="input" placeholder="轮播标题" />
          <input v-model="form.image" class="input" placeholder="图片URL（留空使用渐变占位）" />
          <input v-model="form.show_id" class="input" type="number" placeholder="跳转演出ID（可留空）" />
          <input v-model="form.sort" class="input" type="number" placeholder="排序值（越小越靠前）" />
          <select v-model="form.status" class="input">
            <option :value="1">显示</option>
            <option :value="0">隐藏</option>
          </select>
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

const list = ref([]);
const showModal = ref(false);
const form = reactive({ id: 0, title: '', image: '', show_id: '', sort: 0, status: 1 });

async function load() {
  list.value = (await adminApi.banners()) || [];
}
function add() {
  Object.assign(form, { id: 0, title: '', image: '', show_id: '', sort: 0, status: 1 });
  showModal.value = true;
}
function edit(b) {
  Object.assign(form, { ...b, show_id: b.show_id || '' });
  showModal.value = true;
}
async function save() {
  const payload = { ...form, show_id: form.show_id ? Number(form.show_id) : null, sort: Number(form.sort || 0) };
  if (form.id) await adminApi.updateBanner(form.id, payload);
  else await adminApi.createBanner(payload);
  window.$toast('保存成功');
  showModal.value = false;
  load();
}
async function remove(b) {
  if (!confirm('确认删除？')) return;
  await adminApi.deleteBanner(b.id);
  load();
}

onMounted(load);
</script>
