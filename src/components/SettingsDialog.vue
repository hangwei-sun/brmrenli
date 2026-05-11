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
              <el-radio value="glm">通道1 — GLM-4.6V (智谱AI视觉大模型/高精度)</el-radio>
              <el-radio value="glm-ocr">通道2 — GLM-OCR (智谱AI专业OCR/低成本)</el-radio>
              <el-radio value="paddle">通道3 — PaddleOCR-VL (百度千帆/版面分析)</el-radio>
              <el-radio value="tesseract">Tesseract (本地/免费)</el-radio>
            </el-radio-group>
            <div class="form-hint">
              <span v-if="form.ocrEngine === 'glm'">通道1：智谱AI GLM-4.6V 视觉大模型，手写体识别率约90-98%，自动忽略印刷体</span>
              <span v-else-if="form.ocrEngine === 'glm-ocr'">通道2：智谱AI专业OCR模型，版面分析+精准定位，成本约为传统OCR的1/10</span>
              <span v-else-if="form.ocrEngine === 'paddle'">通道3：百度千帆 PaddleOCR-VL，文档版面解析，支持图表识别</span>
              <span v-else>使用本地Tesseract引擎，无需联网，手写体识别率约50-65%</span>
            </div>
          </el-form-item>

          <template v-if="form.ocrEngine === 'glm-ocr' || form.ocrEngine === 'glm'">
            <el-divider content-position="left">智谱AI API配置</el-divider>
            <el-form-item label="API Key">
              <el-input v-model="form.glmApiKey" placeholder="请输入智谱AI API Key" show-password type="password" />
              <div class="form-hint">
                获取方式：访问 <a href="#" @click.prevent="openGlmUrl">open.bigmodel.cn</a> 注册后在API Keys页面创建（GLM-OCR与GLM-4.6V共用同一Key）
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

          <template v-if="form.ocrEngine === 'paddle'">
            <el-divider content-position="left">百度千帆 API配置</el-divider>
            <el-form-item label="API Key">
              <el-input v-model="form.paddleOcrApiKey" placeholder="请输入百度千帆API Key" show-password type="password" />
              <div class="form-hint">
                获取方式：访问 <a href="#" @click.prevent="openPaddleUrl">console.bce.baidu.com/qianfan</a> 在应用接入中创建API Key
              </div>
            </el-form-item>
            <el-form-item label="">
              <el-button @click="testPaddleOcrApi" :loading="testingPaddle">
                <el-icon><Connection /></el-icon>
                测试连接
              </el-button>
              <span v-if="testPaddleResult" :class="testPaddleResult.success ? 'text-success' : 'text-error'" style="margin-left:12px">
                {{ testPaddleResult.message || testPaddleResult.error }}
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

      <!-- 通用设置 -->
      <el-tab-pane label="通用" name="recognition">
        <el-form label-width="160px" label-position="left">
          <el-form-item label="识别后自动保存">
            <el-switch v-model="form.autoSave" />
            <span class="form-hint-inline">开启后，OCR识别完成自动保存到数据库</span>
          </el-form-item>
          <el-form-item label="隐私模式">
            <el-switch v-model="form.privacyMode" />
            <span class="form-hint-inline">开启后，电话和身份证号仅部分显示（如138****1234）</span>
          </el-form-item>
        </el-form>
      </el-tab-pane>

      <!-- 数据备份与同步 -->
      <el-tab-pane label="数据备份与同步" name="backup">
        <el-form label-width="100px" label-position="left">
          <el-form-item label="本地备份">
            <div class="form-hint" style="margin-bottom:12px">将数据库、图片和设置打包为 .zip 文件。可用于 U盘传输、局域网共享，或放入坚果云/OneDrive 等云同步文件夹中实现多机自动同步。</div>
            <div style="display:flex; gap:12px">
              <el-button type="primary" @click="handleExportBackup" :loading="exporting">
                <el-icon><Download /></el-icon> 导出备份
              </el-button>
              <el-button type="warning" @click="handleImportBackup" :loading="importing">
                <el-icon><Upload /></el-icon> 导入备份
              </el-button>
            </div>
            <div v-if="backupMessage" style="margin-top:12px">
              <el-alert
                :title="backupMessage"
                :type="backupSuccess ? 'success' : 'error'"
                :closable="true"
                show-icon
                @close="backupMessage = ''"
              />
            </div>
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
          <p class="about-tech">通道1 GLM-4.6V · 通道2 GLM-OCR · 通道3 PaddleOCR-VL · SQLite · ECharts</p>
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
import { exportBackup, importBackup } from '../utils/api.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'themeChanged', 'settingsSaved', 'backupRestored'])

const visible = ref(false)
const activeTab = ref('ocr')
const testing = ref(false)
const exporting = ref(false)
const importing = ref(false)
const backupMessage = ref('')
const backupSuccess = ref(false)
const testingGlm = ref(false)
const testingPaddle = ref(false)
const saving = ref(false)
const testResult = ref(null)
const testGlmResult = ref(null)
const testPaddleResult = ref(null)
const appVersion = ref(__APP_VERSION__)

const form = reactive({
  ocrEngine: 'tesseract',
  glmApiKey: '',
  paddleOcrApiKey: '',
  tencentSecretId: '',
  tencentSecretKey: '',
  tencentRegion: 'ap-guangzhou',
  theme: 'light',
  language: 'zh-CN',
  autoSave: false,
  privacyMode: false
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
        paddleOcrApiKey: settings.paddleOcrApiKey || '',
        tencentSecretId: settings.tencentSecretId || '',
        tencentSecretKey: settings.tencentSecretKey || '',
        tencentRegion: settings.tencentRegion || 'ap-guangzhou',
        theme: settings.theme || 'light',
        language: settings.language || 'zh-CN',
        autoSave: settings.autoSave || false,
        privacyMode: settings.privacyMode || false
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
      paddleOcrApiKey: form.paddleOcrApiKey,
      tencentSecretId: form.tencentSecretId,
      tencentSecretKey: form.tencentSecretKey,
      tencentRegion: form.tencentRegion,
      theme: form.theme,
      language: form.language,
      autoSave: form.autoSave,
      privacyMode: form.privacyMode
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

// 打开百度千帆控制台
function openPaddleUrl() {
  window.open('https://console.bce.baidu.com/qianfan', '_blank')
}

// 测试百度千帆 PaddleOCR-VL连接
async function testPaddleOcrApi() {
  if (!form.paddleOcrApiKey) {
    ElMessage.warning('请先输入API Key')
    return
  }
  testingPaddle.value = true
  testPaddleResult.value = null
  try {
    const result = await window.electronAPI.testPaddleOcrApi({ apiKey: form.paddleOcrApiKey })
    testPaddleResult.value = result
    if (result.success) {
      ElMessage.success('连接测试通过')
    } else {
      ElMessage.error(result.error || '连接测试失败')
    }
  } catch (err) {
    testPaddleResult.value = { success: false, error: err.message }
  } finally {
    testingPaddle.value = false
  }
}

// 主题切换即时预览
function onThemeChange(value) {
  emit('themeChanged', value)
}

// 导出备份
async function handleExportBackup() {
  exporting.value = true
  backupMessage.value = ''
  try {
    const result = await exportBackup()
    if (result.canceled) return
    if (result.success) {
      backupSuccess.value = true
      backupMessage.value = `备份已保存到：${result.filePath}`
      ElMessage.success('备份导出成功')
    } else {
      backupSuccess.value = false
      backupMessage.value = result.error || '导出失败'
      ElMessage.error(result.error || '导出失败')
    }
  } catch (err) {
    backupSuccess.value = false
    backupMessage.value = err.message
  } finally {
    exporting.value = false
  }
}

// 导入备份
async function handleImportBackup() {
  importing.value = true
  backupMessage.value = ''
  try {
    const result = await importBackup()
    if (result.canceled) return
    if (result.success) {
      backupSuccess.value = true
      backupMessage.value = result.message || '数据已成功恢复'
      ElMessage.success('数据已成功恢复，请查看各页面确认数据完整性')
      emit('backupRestored')
    } else {
      backupSuccess.value = false
      backupMessage.value = result.error || '导入失败'
      ElMessage.error(result.error || '导入失败')
    }
  } catch (err) {
    backupSuccess.value = false
    backupMessage.value = err.message
  } finally {
    importing.value = false
  }
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
