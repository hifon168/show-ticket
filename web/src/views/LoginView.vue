<template>
  <div class="min-h-screen bg-white px-6 pt-16 md:flex md:items-center md:justify-center">
    <div class="w-full md:max-w-md">
      <div class="mb-8">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-2xl">🎫</div>
        <h1 class="mt-4 text-2xl font-bold">欢迎回来</h1>
        <p class="mt-1 text-sm text-ink-500">登录后即可购票、卖票、私聊转票</p>
      </div>

      <div class="space-y-3">
        <input v-model="form.phone" class="input" type="tel" maxlength="11" placeholder="请输入手机号" />
        <input v-model="form.password" class="input" type="password" placeholder="请输入密码" />
      </div>

      <button class="btn-primary mt-6 w-full !py-3 text-base" :disabled="submitting" @click="submit">
        {{ submitting ? '登录中...' : '登录' }}
      </button>

      <div class="mt-4 flex justify-between text-sm">
        <router-link to="/register" class="text-brand-500">还没有账号？注册（需邀请码）</router-link>
        <router-link to="/admin/login" class="text-ink-300">后台登录</router-link>
      </div>

      <p class="mt-8 text-center text-xs text-ink-300">演示账号：13800000000 / admin123（管理员）</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';

const route = useRoute();
const router = useRouter();
const user = useUserStore();

const form = reactive({ phone: '', password: '' });
const submitting = ref(false);

async function submit() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) return window.$toast('请输入正确的手机号');
  if (!form.password) return window.$toast('请输入密码');

  submitting.value = true;
  try {
    await user.login(form);
    window.$toast('登录成功');
    router.replace(route.query.redirect || '/');
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false;
  }
}
</script>
