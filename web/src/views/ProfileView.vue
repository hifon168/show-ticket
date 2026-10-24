<template>
  <div class="min-h-screen">
    <NavBar title="个人资料" />
    <div class="p-3 md:mx-auto md:max-w-[560px]">
      <div class="card space-y-3 p-3">
        <div>
          <label class="mb-1 block text-xs text-ink-500">头像 URL</label>
          <input v-model="form.avatar" class="input" placeholder="头像图片地址" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-ink-500">昵称</label>
          <input v-model="form.nickname" class="input" placeholder="昵称" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="mb-1 block text-xs text-ink-500">性别</label>
            <select v-model="form.gender" class="input">
              <option :value="0">保密</option>
              <option :value="1">男</option>
              <option :value="2">女</option>
            </select>
          </div>
          <div>
            <label class="mb-1 block text-xs text-ink-500">生日</label>
            <input v-model="form.birthday" class="input" type="date" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs text-ink-500">常驻城市</label>
          <input v-model="form.city" class="input" placeholder="城市" />
        </div>
        <button class="btn-primary w-full !py-2.5" @click="save">保存资料</button>
      </div>

      <!-- 修改密码 -->
      <div class="card mt-3 space-y-2 p-3">
        <h3 class="text-sm font-semibold">修改密码</h3>
        <input v-model="pwd.oldPassword" class="input" type="password" placeholder="原密码" />
        <input v-model="pwd.newPassword" class="input" type="password" placeholder="新密码（至少 6 位）" />
        <button class="btn-dark w-full !py-2.5" @click="changePwd">修改密码</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, onMounted } from 'vue';
import { authApi } from '@/api';
import { useUserStore } from '@/stores/user';
import NavBar from '@/components/NavBar.vue';

const user = useUserStore();
const form = reactive({ nickname: '', avatar: '', gender: 0, birthday: '', city: '' });
const pwd = reactive({ oldPassword: '', newPassword: '' });

async function save() {
  await authApi.updateProfile(form);
  await user.fetchUser();
  window.$toast('保存成功');
}

async function changePwd() {
  if (pwd.newPassword.length < 6) return window.$toast('新密码至少 6 位');
  await authApi.updatePassword(pwd);
  pwd.oldPassword = '';
  pwd.newPassword = '';
  window.$toast('密码修改成功');
}

onMounted(() => {
  const u = user.userInfo || {};
  Object.assign(form, {
    nickname: u.nickname || '',
    avatar: u.avatar || '',
    gender: u.gender || 0,
    birthday: u.birthday ? String(u.birthday).slice(0, 10) : '',
    city: u.city || '',
  });
});
</script>
