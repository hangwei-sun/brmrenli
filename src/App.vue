<template>
  <el-container class="app-container">
    <!-- 顶部标题栏 -->
    <el-header class="app-header">
      <div class="header-left">
        <img src="/logo.png" class="app-logo" alt="Logo" />
        <h1>包融媒人力智慧管理系统</h1>
        <el-tag type="info" size="small">包头市融媒体中心</el-tag>
      </div>
      <div class="header-right">
        <span class="record-count" v-if="totalRecords > 0">共 {{ totalRecords }} 条记录</span>
        <span class="browser-hint" v-if="isBrowserMode">
          <el-tag type="warning" size="small">浏览器预览模式 - 部分功能不可用</el-tag>
        </span>
        <el-badge :is-dot="false" class="engine-badge">
          <el-tag :type="engineTagType" size="small" effect="dark">
            {{ engineLabel }}
          </el-tag>
        </el-badge>
        <el-button type="warning" plain size="small" @click="employeeListVisible = true">
          <el-icon><UserFilled /></el-icon> 职工名单
        </el-button>
        <el-button circle :icon="Setting" @click="settingsVisible = true" title="系统设置" />
      </div>
    </el-header>

    <!-- 主体内容区 -->
    <el-main class="app-main">
      <el-tabs v-model="activeTab" type="border-card" class="main-tabs">
        <el-tab-pane name="upload" lazy>
          <template #label>
            <span class="tab-label">
              <el-icon><Upload /></el-icon> 上传识别
            </span>
          </template>
          <ImageUpload @recognized="handleRecognized" />
        </el-tab-pane>

        <el-tab-pane name="data" lazy>
          <template #label>
            <span class="tab-label">
              <el-icon><List /></el-icon> 数据管理
            </span>
          </template>
          <DataTable
            ref="dataTableRef"
            :records="records"
            @refresh="loadRecords"
            @edit="handleEditRecord"
          />
        </el-tab-pane>

        <el-tab-pane lazy>
          <template #label>
            <span class="tab-label">
              <el-icon><Search /></el-icon> 查询筛选
            </span>
          </template>
          <SearchPanel @search="handleSearch" @export="handleExportSearch" />
        </el-tab-pane>

        <el-tab-pane lazy>
          <template #label>
            <span class="tab-label">
              <el-icon><DataAnalysis /></el-icon> 统计报表
            </span>
          </template>
          <Statistics />
        </el-tab-pane>

        <el-tab-pane lazy>
          <template #label>
            <span class="tab-label">
              <el-icon><Present /></el-icon> 生日祝福
            </span>
          </template>
          <BirthdayBlessing ref="birthdayRef" />
        </el-tab-pane>
      </el-tabs>
    </el-main>

    <!-- 底部版权信息 -->
    <el-footer class="app-footer">
      <span>由数智化发展部赋能</span>
    </el-footer>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      title="编辑请假记录"
      width="650px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form :model="editForm" label-width="100px" :rules="formRules" ref="editFormRef">
        <!-- 申请日期 - 最前面，整行显示 -->
        <el-form-item label="申请日期">
          <el-date-picker
            v-model="editForm.apply_date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width:100%"
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="申请人" prop="applicant">
              <el-select v-model="editForm.applicant" placeholder="请选择或输入申请人" clearable filterable allow-create style="width:100%" @change="onEditApplicantChange">
                <el-option v-for="n in employeeNames" :key="n" :label="n" :value="n" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属部门">
              <el-select v-model="editForm.department" placeholder="请选择部门" clearable filterable style="width:100%">
                <el-option v-for="d in departmentOptions" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="代办人">
              <el-input v-model="editForm.agent" placeholder="请输入代办人" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="请假类型" prop="leave_type">
              <el-select v-model="editForm.leave_type" placeholder="请选择" style="width:100%">
                <el-option v-for="t in leaveTypes" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始日期" prop="start_date">
              <el-date-picker
                v-model="editForm.start_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束日期" prop="end_date">
              <el-date-picker
                v-model="editForm.end_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="天数" prop="days">
              <el-input-number v-model="editForm.days" :min="0" :max="365" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="销假日期">
              <el-date-picker
                v-model="editForm.cancel_date"
                type="date"
                placeholder="选择日期"
                value-format="YYYY-MM-DD"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
        <el-form-item label="请假条图片">
          <div class="edit-image-area" @click="editFileInput?.click()">
            <input ref="editFileInput" type="file" accept="image/*" @change="onEditImageChange" style="display:none" />
            <template v-if="editImagePreview">
              <img :src="editImagePreview" class="edit-image-preview" />
              <el-icon class="edit-image-remove" @click.stop="removeEditImage" color="#f56c6c"><CircleCloseFilled /></el-icon>
            </template>
            <template v-else>
              <el-icon :size="36" color="#c0c4cc"><Plus /></el-icon>
              <p class="edit-image-hint">点击更换请假条图片（可选）</p>
            </template>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 登录对话框 -->
    <LoginDialog v-if="loginRequired || locked" :locked="locked" @unlocked="onUnlocked" />

    <!-- 职工名单对话框 -->
    <el-dialog v-model="employeeListVisible" title="职工名单" width="900px" :close-on-click-modal="false" destroy-on-close>
      <EmployeeList @employeesChanged="loadEmployeeNames" />
    </el-dialog>

    <!-- 设置对话框 -->
    <SettingsDialog v-model="settingsVisible" @themeChanged="applyTheme" @settingsSaved="onSettingsSaved" @backupRestored="handleBackupRestored" />
  </el-container>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import ImageUpload from './components/ImageUpload.vue'
import DataTable from './components/DataTable.vue'
import SearchPanel from './components/SearchPanel.vue'
import Statistics from './components/Statistics.vue'
import BirthdayBlessing from './components/BirthdayBlessing.vue'
import EmployeeList from './components/EmployeeList.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import LoginDialog from './components/LoginDialog.vue'
import { saveBase64Image, readImage, getDistinctDepartments } from './utils/api.js'
import { Setting, CircleCloseFilled, UserFilled } from '@element-plus/icons-vue'

const activeTab = ref('upload')
const records = ref([])
const totalRecords = ref(0)
const dataTableRef = ref(null)
const birthdayRef = ref(null)
const employeeListVisible = ref(false)
const employeeNames = ref([])
const editDialogVisible = ref(false)
const editFormRef = ref(null)
const settingsVisible = ref(false)
const loginRequired = ref(false)
const locked = ref(false)
const lockTimeout = ref(0)
let idleTimer = null
let activityEventsBound = false
const currentEngine = ref('tesseract')

// 编辑对话框图片
const editFileInput = ref(null)
const editImagePreview = ref('')
const editImageFile = ref(null)

const engineLabel = computed(() => {
  switch (currentEngine.value) {
    case 'glm-ocr': return '通道2'
    case 'glm': return '通道1'
    case 'qwen-vl-plus': return '通道3'
    case 'qwen-vl-72b': return '通道4'
    case 'tencent': return '腾讯云OCR'
    default: return 'Tesseract OCR'
  }
})

const engineTagType = computed(() => {
  switch (currentEngine.value) {
    case 'glm-ocr': return 'success'
    case 'glm': return ''
    case 'qwen-vl-plus': return 'primary'
    case 'qwen-vl-72b': return 'primary'
    case 'tencent': return ''
    default: return 'info'
  }
})

// 检测是否在浏览器模式（非Electron环境）
const isBrowserMode = ref(false)

const leaveTypes = [
  '年休假', '病假', '事假', '婚假', '丧假',
  '探亲假', '产假', '护理假', '育儿假'
]

const BASE_DEPARTMENTS = [
  '党委班子成员', '新闻采编中心', '蒙编部', '时政部', '评论部',
  '编辑出版部', '专副刊部', '新媒体一部', '新媒体二部', '综合广播部',
  '交通音乐广播部', '生活文艺广播部', '指挥调度部', '电视节目部', '外宣联络部',
  '技术保障部', '数智化发展部', '播出部', '发射部', '传媒发展部',
  '运营服务部', '政务专题部', '大型活动部', '影视制作部', '财务审计部',
  '办公室', '组织人事部', '经营监管部', '机关党委', '质评部',
  '印务部', '舆情智库部', '离退休工作部', '融媒发展公司', '智媒资管理部'
]

const departmentOptions = ref([...BASE_DEPARTMENTS])

async function loadDepartmentOptions() {
  try {
    const deps = await getDistinctDepartments()
    if (deps && deps.length > 0) {
      const merged = new Set([...BASE_DEPARTMENTS, ...deps])
      departmentOptions.value = [...merged].sort()
    }
  } catch { /* keep base list */ }
}

const editForm = reactive({
  id: null,
  applicant: '',
  department: '',
  agent: '',
  leave_type: '',
  start_date: '',
  end_date: '',
  days: 0,
  apply_date: '',
  cancel_date: '',
  image_path: '',
  remark: ''
})

const formRules = {
  applicant: [{ required: true, message: '请输入申请人姓名', trigger: 'blur' }],
  leave_type: [{ required: true, message: '请选择请假类型', trigger: 'change' }],
  start_date: [{ required: true, message: '请选择开始日期', trigger: 'change' }],
  end_date: [{ required: true, message: '请选择结束日期', trigger: 'change' }],
  days: [{ required: true, message: '请输入天数', trigger: 'blur' }]
}

// 安全调用 electronAPI
function getAPI() {
  if (window.electronAPI) return window.electronAPI
  isBrowserMode.value = true
  return null
}

// 加载职工名单（用于申请人下拉，仅显示活跃员工）
async function loadEmployeeNames() {
  if (!window.electronAPI) return
  try {
    const list = await window.electronAPI.getActiveEmployees()
    employeeNames.value = [...new Set(list.map(e => e.name).filter(Boolean))]
  } catch { /* ignore */ }
}

// 数据管理编辑：选择姓名后自动匹配部门
async function onEditApplicantChange(name) {
  if (!name || !window.electronAPI) return
  try {
    const list = await window.electronAPI.getActiveEmployees()
    const match = list.find(e => (e.name || '').trim() === name.trim())
    if (match && match.department) {
      editForm.department = match.department
    }
  } catch { /* ignore */ }
}

// 加载所有记录
async function loadRecords() {
  const api = getAPI()
  if (!api) {
    ElMessage.warning('当前为浏览器预览模式，数据功能需要运行 Electron 应用')
    return
  }
  try {
    records.value = await api.getAllRecords()
    totalRecords.value = records.value.length
  } catch (err) {
    ElMessage.error('加载记录失败: ' + err.message)
  }
}

// OCR识别完成后回调
function handleRecognized(data) {
  activeTab.value = 'data'
  loadRecords()
}

// 编辑记录
async function handleEditRecord(record) {
  Object.assign(editForm, {
    id: record.id,
    applicant: record.applicant || '',
    department: record.department || '',
    agent: record.agent || '',
    leave_type: record.leave_type || '',
    start_date: record.start_date || '',
    end_date: record.end_date || '',
    days: record.days || 0,
    apply_date: record.apply_date || '',
    cancel_date: record.cancel_date || '',
    image_path: record.image_path || '',
    remark: record.remark || ''
  })
  // 加载当前图片预览
  editImagePreview.value = ''
  editImageFile.value = null
  if (record.image_path) {
    try {
      const dataUrl = await readImage(record.image_path)
      if (dataUrl) editImagePreview.value = dataUrl
    } catch { /* ignore */ }
  }
  editDialogVisible.value = true
}

// 编辑对话框图片处理
function onEditImageChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  editImageFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    editImagePreview.value = ev.target.result
  }
  reader.readAsDataURL(file)
}

function removeEditImage() {
  editImagePreview.value = ''
  editImageFile.value = null
  if (editFileInput.value) editFileInput.value.value = ''
}

// 保存编辑
async function saveEdit() {
  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return

  const api = getAPI()
  if (!api) return

  try {
    let imagePath = editForm.image_path
    // 如果有新图片，保存并更新路径
    if (editImagePreview.value && editImageFile.value) {
      try {
        imagePath = await saveBase64Image(editImagePreview.value, editImageFile.value.name || 'image.png')
        if (!imagePath) console.error('saveBase64Image returned empty path')
      } catch (e) { console.error('saveBase64Image error:', e) }
    }
    await api.updateRecord(editForm.id, { ...editForm, image_path: imagePath })
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadRecords()
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  }
}

// 执行搜索
async function handleSearch(conditions) {
  const api = getAPI()
  if (!api) return
  try {
    records.value = await api.searchRecords(conditions)
  } catch (err) {
    ElMessage.error('搜索失败: ' + err.message)
  }
}

// 导出搜索结果
function handleExportSearch() {
  if (dataTableRef.value) {
    dataTableRef.value.exportToExcel()
  }
}

// 主题切换
function applyTheme(theme) {
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'dark' : 'light')
  } else {
    root.classList.add('light')
  }
}

// 加载主题设置
async function loadTheme() {
  if (!window.electronAPI) return
  try {
    const settings = await window.electronAPI.getSettings()
    if (settings) {
      applyTheme(settings.theme || 'light')
      currentEngine.value = settings.ocrEngine || 'tesseract'
    }
  } catch { /* ignore */ }
}

// 备份恢复后回调 — 重新加载所有数据
async function handleBackupRestored() {
  await loadRecords()
  loadTheme()
  if (birthdayRef.value) {
    birthdayRef.value.refresh()
  }
}

// 设置保存后回调
function onSettingsSaved(settings) {
  if (settings.ocrEngine) {
    currentEngine.value = settings.ocrEngine
  }
  if (birthdayRef.value && settings.privacyMode !== undefined) {
    birthdayRef.value.updatePrivacyMode(settings.privacyMode)
  }
  // 更新自动锁定设置
  if (settings.lockTimeout !== undefined) {
    lockTimeout.value = settings.lockTimeout
    if (settings.loginEnabled && settings.lockTimeout > 0) {
      startIdleTimer()
    } else {
      stopIdleTimer()
    }
  }
  if (settings.loginEnabled === false) {
    stopIdleTimer()
  }
}

// 自动锁定
function onUnlocked() {
  loginRequired.value = false
  locked.value = false
  resetIdleTimer()
}

function startIdleTimer() {
  stopIdleTimer()
  if (!lockTimeout.value || lockTimeout.value <= 0) return
  bindActivityEvents()
  resetIdleTimer()
}

function resetIdleTimer() {
  clearTimeout(idleTimer)
  if (!lockTimeout.value || lockTimeout.value <= 0) return
  idleTimer = setTimeout(() => {
    locked.value = true
  }, lockTimeout.value * 60 * 1000)
}

function stopIdleTimer() {
  clearTimeout(idleTimer)
  idleTimer = null
}

function onUserActivity() {
  if (!locked.value) resetIdleTimer()
}

function bindActivityEvents() {
  if (activityEventsBound) return
  activityEventsBound = true
  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
  events.forEach(e => document.addEventListener(e, onUserActivity, { passive: true }))
}

onMounted(async () => {
  loadTheme()
  loadRecords()
  loadEmployeeNames()
  loadDepartmentOptions()
  // 检查是否需要登录
  if (window.electronAPI) {
    try {
      const settings = await window.electronAPI.getSettings()
      if (settings?.loginEnabled && settings?.loginPassword) {
        loginRequired.value = true
      }
      if (settings?.lockTimeout) {
        lockTimeout.value = settings.lockTimeout
      }
      if (settings?.loginEnabled && settings?.lockTimeout > 0) {
        // 初始登录成功后由 onUnlocked 启动计时器
      }
    } catch { /* ignore */ }
  }
})

onUnmounted(() => {
  stopIdleTimer()
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif;
  background-color: #f0f2f5;
}

.app-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
  height: 60px !important;
  background: linear-gradient(135deg, #1a3a5c 0%, #2c5f8a 100%);
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-count {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.85);
}

.app-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 32px !important;
  padding: 0 20px;
  font-size: 12px;
  color: #909399;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
  flex-shrink: 0;
}

html.dark .app-footer {
  background: #262727;
  border-top-color: #363637;
  color: #666;
}

.app-main {
  flex: 1;
  overflow: hidden;
  padding: 16px 20px;
}

.main-tabs {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-tabs > .el-tabs__content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.main-tabs > .el-tabs__header {
  flex-shrink: 0;
  margin-bottom: 0;
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 浏览器提示 */
.browser-hint {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 全局卡片样式 */
.section-card {
  margin-bottom: 16px;
}

.app-logo {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: contain;
}

.engine-badge {
  margin-right: 4px;
}

/* 置信度星星样式 */
.confidence-stars {
  display: inline-block;
  color: #e6a23c;
  font-size: 12px;
  margin-left: 4px;
}

/* ============ 暗色模式 ============ */
html.dark {
  --el-bg-color: #141414;
  --el-bg-color-overlay: #1d1e1f;
  --el-text-color-primary: #e5eaf3;
  --el-text-color-regular: #cfd3dc;
  --el-border-color: #363637;
  --el-border-color-light: #363637;
  --el-fill-color: #262727;
  --el-fill-color-light: #2b2b2b;
  --el-color-primary: #409eff;
  background-color: #141414;
  color: #e5eaf3;
}

html.dark body {
  background-color: #141414;
}

html.dark .app-header {
  background: linear-gradient(135deg, #0d1a2d 0%, #162d45 100%);
}

html.dark .el-card {
  background-color: #1d1e1f;
  border-color: #363637;
}

html.dark .el-tabs--border-card {
  background-color: #1d1e1f;
  border-color: #363637;
}

html.dark .el-tabs--border-card > .el-tabs__header {
  background-color: #262727;
  border-bottom-color: #363637;
}

html.dark .el-table {
  --el-table-bg-color: #1d1e1f;
  --el-table-tr-bg-color: #1d1e1f;
  --el-table-header-bg-color: #262727;
  --el-table-border-color: #363637;
  --el-table-row-hover-bg-color: #2b2b2b;
}

html.dark .el-pagination {
  --el-pagination-bg-color: #1d1e1f;
}

html.dark .el-dialog {
  --el-dialog-bg-color: #1d1e1f;
}

html.dark .el-input__wrapper {
  background-color: #262727;
}

html.dark .el-select .el-input__wrapper {
  background-color: #262727;
}

html.dark .upload-area {
  background: #262727;
  border-color: #363637;
}

html.dark .upload-area:hover,
html.dark .upload-area.is-dragover {
  background: #2b2b2b;
}

html.dark .preview-content .preview-image {
  border-right-color: #363637;
}

html.dark .preview-actions {
  border-top-color: #363637;
}

/* 编辑图片 */
.edit-image-area {
  width: 100%;
  min-height: 100px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s;
}
.edit-image-area:hover {
  border-color: #409eff;
}
.edit-image-preview {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}
.edit-image-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 20px;
  cursor: pointer;
  background: rgba(255,255,255,0.9);
  border-radius: 50%;
}
.edit-image-hint {
  color: #c0c4cc;
  font-size: 13px;
  margin-top: 6px;
}

html.dark .edit-image-area {
  border-color: #363637;
}
html.dark .edit-image-area:hover {
  border-color: #409eff;
}
</style>
