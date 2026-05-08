<template>
  <el-dialog
    v-model="visible"
    title="系统设置"
    width="580px"
    :close-on-click-modal="false"
    destroy-on-close
    @open="loadSettings"
  >
    <el-tabs v-model="activeTab">
      <!-- OCR引擎设置 -->
      <el-tab-pane label="OCR引擎" name="ocr">
        <el-form label-width="120px" label-position="left">
          <el-form-item label="识别引擎">
            <el-radio-group v-model="form.ocrEngine">
              <el-radio value="glm">GLM-4.6V (云端/高精度)</el-radio>
              <el-radio value="tesseract">Tesseract (本地/免费)</el-radio>
              <el-radio value="tencent">腾讯云OCR (云端/付费)</el-radio>
            </el-radio-group>
            <div class="form-hint">
              <span v-if="form.ocrEngine === 'glm'">智谱AI大模型，手写体识别率约90-98%，自动忽略印刷体</span>
              <span v-else-if="form.ocrEngine === 'tesseract'">使用本地Tesseract引擎，无需联网，手写体识别率约50-65%</span>
              <span v-else>使用腾讯云手写体识别API，需要联网，每月1000次免费额度</span>
            </div>
          </el-form-item>

          <template v-if="form.ocrEngine === 'glm'">
            <el-divider content-position="left">智谱AI GLM API配置</el-divider>
            <el-form-item label="API Key">
              <el-input v-model="form.glmApiKey" placeholder="请输入智谱AI API Key" show-password type="password" />
              <div class="form-hint">
                获取方式：访问 <a href="#" @click.prevent="openGlmUrl">open.bigmodel.cn</a> 注册后在API Keys页面创建
              </div>
            </el-form-item>
            <el-form-item label="">
              <el-button @click="testGlmApi" :loading="testingGlm">
                <el-icon><Connection /></el-icon>
                测试连接
              </el-button>
              <span v-if="testGlmResult" :class="testGlmResult.success ? 'text-success' : 'text-error'" style="margin-left:12px">
                {{ testGlmResult.message || testGlmResult.error }}
              </span>
            </el-form-item>
          </template>

          <template v-if="form.ocrEngine === 'tencent'">
            <el-divider content-position="left">腾讯云API配置</el-divider>
            <el-form-item label="SecretId">
              <el-input v-model="form.tencentSecretId" placeholder="请输入腾讯云SecretId" show-password />
            </el-form-item>
            <el-form-item label="SecretKey">
              <el-input v-model="form.tencentSecretKey" placeholder="请输入腾讯云SecretKey" show-password type="password" />
            </el-form-item>
            <el-form-item label="地域">
              <el-select v-model="form.tencentRegion" placeholder="选择地域">
                <el-option label="广州 (ap-guangzhou)" value="ap-guangzhou" />
                <el-option label="上海 (ap-shanghai)" value="ap-shanghai" />
                <el-option label="北京 (ap-beijing)" value="ap-beijing" />
                <el-option label="成都 (ap-chengdu)" value="ap-chengdu" />
                <el-option label="重庆 (ap-chongqing)" value="ap-chongqing" />
              </el-select>
            </el-form-item>
            <el-form-item label="">
              <el-button @click="testTencentApi" :loading="testing">
                <el-icon><Connection /></el-icon>
                测试连接
              </el-button>
              <span v-if="testResult" :class="testResult.success ? 'text-success' : 'text-error'" style="margin-left:12px">
                {{ testResult.message || testResult.error }}
              </span>
            </el-form-item>
          </template>
        </el-form>
      </el-tab-pane>

      <!-- 外观设置 -->
      <el-tab-pane label="外观" name="appearance">
        <el-form label-width="100px" label-position="left">
          <el-form-item label="主题模式">
            <el-radio-group v-model="form.theme" @change="onThemeChange">
              <el-radio value="light">
                <el-icon><Sunny /></el-icon>
                浅色模式
              </el-radio>
              <el-radio value="dark">
                <el-icon><Moon /></el-icon>
                暗色模式
              </el-radio>
              <el-radio value="system">
                <el-icon><Monitor /></el-icon>
                跟随系统
              </el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="语言">
            <el-select v-model="form.language" disabled style="width:200px">
              <el-option label="简体中文" value="zh-CN" />
            </el-select>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 识别设置 -->
      <el-tab-pane label="识别" name="recognition">
        <el-form label-width="140px" label-position="left">
          <el-form-item label="识别后自动保存">
            <el-switch v-model="form.autoSave" />
            <span class="form-hint-inline">开启后，OCR识别完成自动保存到数据库</span>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 关于 -->
      <el-tab-pane label="关于" name="about">
        <div class="about-section">
          <div class="about-icon">
            <img src="/logo.png" class="about-logo" alt="Logo" />
          </div>
          <h2>包融媒人力智慧管理系统</h2>
          <p class="about-version">版本 {{ appVersion }}</p>
          <el-divider />
          <p>包头市融媒体中心 内部使用</p>
          <p>开发部门：数智化发展部</p>
          <el-divider />
          <p class="about-tech">Electron + Vue 3 + Element Plus + Tesseract.js</p>
          <p class="about-tech">GLM-4.6V-Flash · 腾讯云OCR · SQLite · ECharts</p>
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="saveSettings" :loading="saving">保存设置</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'themeChanged', 'settingsSaved'])

const visible = ref(false)
const activeTab = ref('ocr')
const testing = ref(false)
const testingGlm = ref(false)
const saving = ref(false)
const testResult = ref(null)
const testGlmResult = ref(null)
const appVersion = ref('1.1.0')

const form = reactive({
  ocrEngine: 'tesseract',
  glmApiKey: '',
  tencentSecretId: '',
  tencentSecretKey: '',
  tencentRegion: 'ap-guangzhou',
  theme: 'light',
  language: 'zh-CN',
  autoSave: false
})

// 同步v-model
import { watch } from 'vue'
watch(() => props.modelValue, (val) => { visible.value = val })
watch(visible, (val) => { emit('update:modelValue', val) })

// 加载设置
async function loadSettings() {
  if (!window.electronAPI) return
  try {
    const settings = await window.electronAPI.getSettings()
    if (settings) {
      Object.assign(form, {
        ocrEngine: settings.ocrEngine || 'tesseract',
        glmApiKey: settings.glmApiKey || '',
        tencentSecretId: settings.tencentSecretId || '',
        tencentSecretKey: settings.tencentSecretKey || '',
        tencentRegion: settings.tencentRegion || 'ap-guangzhou',
        theme: settings.theme || 'light',
        language: settings.language || 'zh-CN',
        autoSave: settings.autoSave || false
      })
    }
  } catch (err) {
    console.error('加载设置失败:', err)
  }
}

// 保存设置
async function saveSettings() {
  saving.value = true
  try {
    const settings = {
      ocrEngine: form.ocrEngine,
      glmApiKey: form.glmApiKey,
      tencentSecretId: form.tencentSecretId,
      tencentSecretKey: form.tencentSecretKey,
      tencentRegion: form.tencentRegion,
      theme: form.theme,
      language: form.language,
      autoSave: form.autoSave
    }
    await window.electronAPI.updateAllSettings(settings)
    ElMessage.success('设置已保存')
    visible.value = false
    emit('settingsSaved', settings)
  } catch (err) {
    ElMessage.error('保存设置失败: ' + err.message)
  } finally {
    saving.value = false
  }
}

// 测试腾讯云连接
async function testTencentApi() {
  if (!form.tencentSecretId || !form.tencentSecretKey) {
    ElMessage.warning('请先输入SecretId和SecretKey')
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const result = await window.electronAPI.testTencentApi({
      secretId: form.tencentSecretId,
      secretKey: form.tencentSecretKey,
      region: form.tencentRegion
    })
    testResult.value = result
    if (result.success) {
      ElMessage.success('连接测试通过')
    } else {
      ElMessage.error(result.error || '连接测试失败')
    }
  } catch (err) {
    testResult.value = { success: false, error: err.message }
  } finally {
    testing.value = false
  }
}

// 测试智谱AI GLM连接
async function testGlmApi() {
  if (!form.glmApiKey) {
    ElMessage.warning('请先输入API Key')
    return
  }
  testingGlm.value = true
  testGlmResult.value = null
  try {
    const result = await window.electronAPI.testGlmApi({ apiKey: form.glmApiKey })
    testGlmResult.value = result
    if (result.success) {
      ElMessage.success('连接测试通过')
    } else {
      ElMessage.error(result.error || '连接测试失败')
    }
  } catch (err) {
    testGlmResult.value = { success: false, error: err.message }
  } finally {
    testingGlm.value = false
  }
}

// 打开智谱AI官网
function openGlmUrl() {
  window.open('https://open.bigmodel.cn', '_blank')
}

// 主题切换即时预览
function onThemeChange(value) {
  emit('themeChanged', value)
}
</script>

<style scoped>
.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.6;
}

.form-hint-inline {
  font-size: 12px;
  color: #909399;
  margin-left: 8px;
}

.text-success {
  color: #67c23a;
  font-size: 13px;
}

.text-error {
  color: #f56c6c;
  font-size: 13px;
}

.about-section {
  text-align: center;
  padding: 16px 0;
}

.about-icon {
  margin-bottom: 12px;
}

.about-logo {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: contain;
}

.about-version {
  color: #909399;
  font-size: 14px;
  margin-top: 4px;
}

.about-tech {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}
</style>
