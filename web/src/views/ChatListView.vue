<template>
  <div class="min-h-screen">
    <NavBar title="私聊消息" />

    <PullRefresh class="p-3" @refresh="onRefresh">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="skeleton h-16 w-full rounded-xl2"></div>
      </div>
      <template v-else>
        <div class="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          <router-link
            v-for="c in list"
            :key="c.id"
            :to="`/chat/${c.id}`"
            class="card flex items-center gap-3 p-3"
          >
            <div class="relative">
              <span class="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-600">
                {{ (c.peer_nickname || 'U').slice(0, 1) }}
              </span>
              <span
                v-if="c.unread > 0"
                class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] text-white"
              >
                {{ c.unread }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ c.peer_nickname }}</span>
                <span class="text-[11px] text-ink-300">{{ fromNow(c.last_message_at) }}</span>
              </div>
              <p class="line-1 text-xs text-ink-500">{{ c.last_message || '暂无消息' }}</p>
              <p v-if="c.show_title" class="line-1 text-[11px] text-ink-300">🎫 {{ c.show_title }}</p>
            </div>
          </router-link>
        </div>
        <EmptyState v-if="!list.length" icon="💬" text="暂无私聊，去二手集市找卖家聊聊吧">
          <router-link to="/market" class="btn-primary mt-3">逛集市</router-link>
        </EmptyState>
      </template>
    </PullRefresh>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { chatApi } from '@/api';
import { fromNow } from '@/utils';
import NavBar from '@/components/NavBar.vue';
import EmptyState from '@/components/EmptyState.vue';
import PullRefresh from '@/components/PullRefresh.vue';

const list = ref([]);
const loading = ref(false);

async function load() {
  loading.value = true;
  try {
    list.value = (await chatApi.conversations()) || [];
  } finally {
    loading.value = false;
  }
}
function onRefresh(done) {
  load().finally(done);
}
onMounted(load);
</script>
