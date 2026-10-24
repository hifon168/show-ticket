<template>
  <div class="min-h-screen bg-white px-6 pt-12 md:flex md:items-center md:justify-center">
    <div class="w-full pb-10 md:max-w-md">
      <div class="mb-6">
        <h1 class="text-2xl font-bold">注册账号</h1>
        <p class="mt-1 text-sm text-ink-500">本站采用邀请制，注册需填写有效邀请码</p>
      </div>

      <div class="space-y-3">
        <input v-model="form.phone" class="input" type="tel" maxlength="11" placeholder="手机号（登录账号）" />
        <input v-model="form.nickname" class="input" placeholder="昵称（选填）" />

        <!-- 邀请码：必填，可实时校验 -->
        <div class="flex gap-2">
          <input v-model="form.inviteCode" class="input flex-1 uppercase" placeholder="邀请码（必填）" />
          <button class="btn-ghost shrink-0 !px-3 text-xs" @click="checkCode">校验</button>
        </div>
        <p v-if="codeMsg" class="text-xs" :class="codeOk ? 'text-green-600' : 'text-brand-500'">{{ codeMsg }}</p>

        <input v-model="form.password" class="input" type="password" placeholder="密码（至少 6 位）" />
        <input v-model="form.confirm" class="input" type="password" placeholder="确认密码" />
      </div>

      <button class="btn-primary mt-6 w-full !py-3 text-base" :disabled="submitting" @click="submit">
        {{ submitting ? '提交中...' : '注册' }}
      </button>

      <p class="mt-4 text-center text-sm">
        已有账号？
        <router-link to="/login" class="text-brand-500">立即登录</router-link>
      </p>
      <p class="mt-6 text-center text-xs text-ink-300">演示邀请码：VIP88888 / TICKET66 / WELCOME1</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@/api';
import { useUserStore } from '@/stores/user';

const router = useRouter();
const user = useUserStore();

const form = reactive({ phone: '', nickname: '', inviteCode: '', password: '', confirm: '' });
const submitting = ref(false);
const codeMsg = ref('');
const codeOk = ref(false);

/** 预校验邀请码 */
async function checkCode() {
  if (!form.inviteCode) return (codeMsg.value = '请输入邀请码');
  try {
    await authApi.checkInvite(form.inviteCode.trim().toUpperCase());
    codeOk.value = true;
    codeMsg.value = '✅ 邀请码可用';
  } catch (e) {
    codeOk.value = false;
    codeMsg.value = '❌ ' + e.message;
  }
}

async function submit() {
  if (!/^1[3-9]\d{9}$/.test(form.phone)) return window.$toast('请输入正确的手机号');
  if (!form.inviteCode) return window.$toast('邀请码不能为空');
  if (form.password.length < 6) return window.$toast('密码至少 6 位');
  if (form.password !== form.confirm) return window.$toast('两次密码不一致');

  submitting.value = true;
  try {
    await authApi.register({
      phone: form.phone,
      password: form.password,
      nickname: form.nickname,
      inviteCode: form.inviteCode.trim().toUpperCase(),
    });
    window.$toast('注册成功，请登录');
    router.replace('/login');
  } catch (e) {
    /* 已提示 */
  } finally {
    submitting.value = false;
  }
}
</script>
