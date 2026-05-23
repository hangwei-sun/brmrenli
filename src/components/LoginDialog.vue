<template>
  <el-dialog
    v-model="visible"
    :title="locked ? '系统已锁定' : '登录验证'"
    width="400px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
    align-center
  >
    <div class="login-body">
      <div class="login-icon">
        <img src="/logo.png" class="login-logo" alt="Logo" />
      </div>
      <h3 class="login-title">包融媒人力智慧管理系统</h3>
      <el-form @submit.prevent="handleLogin">
        <el-form-item>
          <el-input
            v-model="password"
            type="password"
            placeholder="请输入登录密码"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading" style="width:100%">
            登录
          </el-button>
        </el-form-item>
      </el-form>
      <p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>
    </div>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  locked: { type: Boolean, default: false }
})

const emit = defineEmits(['unlocked'])

const visible = ref(true)
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function handleLogin() {
  if (!password.value) {
    errorMsg.value = '请输入密码'
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const ok = await window.electronAPI.verifyPassword(password.value)
    if (ok) {
      visible.value = false
      password.value = ''
      emit('unlocked')
    } else {
      errorMsg.value = '密码错误，请重试'
      password.value = ''
    }
  } catch (err) {
    errorMsg.value = '验证失败: ' + err.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-body {
  text-align: center;
  padding: 8px 0;
}
.login-icon {
  margin-bottom: 12px;
}
.login-logo {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  object-fit: contain;
}
.login-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #303133;
}
.login-error {
  color: #f56c6c;
  font-size: 13px;
  margin-top: -8px;
}
</style>
