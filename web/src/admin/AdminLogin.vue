<template>
  <div class="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink-900 to-ink-700 px-6">
    <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop">
      <h1 class="text-xl font-bold">后台管理系统</h1>
      <p class="mt-1 text-xs text-ink-500">演出票务平台 · 管理员登录</p>

      <div class="mt-6 space-y-3">
        <input v-model="form.phone" class="input" type="tel" maxlength="11" placeholder="管理员手机号" />
        <input v-model="form.password" class="input" type="password" placeholder="密码" @keyup.enter="submit" />
      </div>

      <button class="btn-primary mt-6 w-full !py-3" :disabled="loading" @click="submit">
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <p class="mt-4 text-center text-[11px] text-ink-300">默认管理员：13800000000 / admin123</p>
      <router-link to="/" class="mt-2 block text-center text-xs text-ink-500">← 返回前台</router-link>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const user = useUserStore();
const form = reactive({ phone: '', password: '' });
const loading = ref(false);

async function submit() {
  if (!form.phone || !form.password) return window.$toast('请输入账号和密码');
  loading.value = true;
  try {
    const data = await user.adminLogin(form);
    if (data.user.role !== 1) {
      window.$toast('该账号不是管理员');
      return user.logout();
    }
    window.$toast('登录成功');
    router.replace('/admin/dashboard');
  } catch (e) {
    /* 已提示 */
  } finally {
    loading.value = false;
  }
}
</script>
