<template>
  <div class="flex h-screen flex-col bg-ink-50">
    <NavBar :title="peerName" />

    <!-- 关联票品卡片 -->
    <div v-if="conv.ticket_id" class="mx-3 mt-2 flex items-center gap-2 rounded-xl2 bg-white p-2 shadow-card">
      <span class="text-lg">🎫</span>
      <div class="min-w-0 flex-1 text-xs">
        <p class="line-1 font-medium">{{ conv.show_title }}</p>
        <p class="text-ink-500">转让价 ¥{{ conv.sell_price }}</p>
      </div>
      <router-link :to="`/ticket/${conv.ticket_id}`" class="btn-ghost !px-2 !py-1 text-[11px]">查看</router-link>
    </div>

    <!-- 消息列表 -->
    <div ref="scrollBox" class="flex-1 overflow-y-auto p-3">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="skeleton h-10 w-2/3 rounded-lg"></div>
      </div>
      <template v-else>
        <div v-for="m in messages" :key="m.id" class="mb-3 flex" :class="m.sender_id === myId ? 'justify-end' : ''">
          <span
            v-if="m.sender_id !== myId"
            class="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs text-brand-600"
          >
            {{ (m.sender_nickname || 'U').slice(0, 1) }}
          </span>
          <div class="max-w-[72%]">
            <div
              class="rounded-2xl px-3 py-2 text-sm"
              :class="m.sender_id === myId ? 'bg-brand-500 text-white' : 'bg-white shadow-card'"
            >
              {{ m.content }}
            </div>
            <p class="mt-1 px-1 text-[10px] text-ink-300">{{ formatDate(m.created_at) }}</p>
          </div>
        </div>
        <EmptyState v-if="!messages.length" icon="💬" text="还没有消息，打个招呼吧" />
      </template>
    </div>

    <!-- 输入区 -->
    <div class="safe-bottom border-t border-ink-100 bg-white p-2">
      <div class="flex items-end gap-2">
        <textarea
          v-model="text"
          rows="1"
          class="max-h-24 flex-1 resize-none rounded-lg bg-ink-50 px-3 py-2 text-sm outline-none"
          placeholder="输入消息…"
          @keyup.enter.exact="send"
        ></textarea>
        <button class="btn-primary !px-5 !py-2" @click="send">发送</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { chatApi } from '@/api';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import EmptyState from '@/components/EmptyState.vue';

const route = useRoute();
const user = useUserStore();

const loading = ref(true);
const messages = ref([]);
const conv = ref({});
const text = ref('');
const scrollBox = ref(null);

const myId = computed(() => user.userInfo?.id);
const peerName = computed(() => conv.value.peer_nickname || '私聊');

let timer = null;

async function loadConv() {
  const list = await chatApi.conversations();
  conv.value = (list || []).find((c) => c.id === Number(route.params.id)) || {};
}

async function loadMessages(scroll = true) {
  try {
    messages.value = (await chatApi.messages(route.params.id)) || [];
    if (scroll) scrollToBottom();
  } finally {
    loading.value = false;
  }
}

async function send() {
  const content = text.value.trim();
  if (!content) return;
  text.value = '';
  await chatApi.send(route.params.id, { content });
  await loadMessages();
}

function scrollToBottom() {
  nextTick(() => {
    if (scrollBox.value) scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
  });
}

onMounted(async () => {
  await loadConv();
  await loadMessages();
  // 简易轮询：每 3 秒拉取一次新消息（生产环境建议改用 WebSocket）
  timer = setInterval(() => loadMessages(false), 3000);
});
onBeforeUnmount(() => clearInterval(timer));
</script>
