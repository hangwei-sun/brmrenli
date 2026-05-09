<template>
  <div class="birthday-module">
    <!-- 操作工具栏 -->
    <div class="bless-toolbar">
      <el-button type="primary" @click="uploadDialogVisible = true">
        <el-icon><Upload /></el-icon>
        批量导入Excel
      </el-button>
      <el-button @click="loadEmployees">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
      <el-button type="success" plain @click="openManualDialog">
        <el-icon><Plus /></el-icon>
        手动录入
      </el-button>
      <el-button type="danger" plain @click="batchDelete" :disabled="selectedRows.length === 0">
        <el-icon><Delete /></el-icon>
        批量删除 ({{ selectedRows.length }})
      </el-button>
      <div class="toolbar-right">
        <el-input v-model="searchKeyword" placeholder="搜索姓名/部门" clearable @input="onSearch" style="width:200px" />
        <span class="total-hint">共 {{ employees.length }} 名员工</span>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon :size="32" color="#409EFF"><UserFilled /></el-icon>
            <div>
              <div class="stat-num">{{ totalEmployees }}</div>
              <div class="stat-lbl">总员工数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-content">
            <el-icon :size="32" color="#67C23A"><Present /></el-icon>
            <div>
              <div class="stat-num">{{ birthdayCount }}</div>
              <div class="stat-lbl">{{ birthdayLabel }}</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover" class="stat-card">
          <template #header>
            <span class="card-header">
              <el-icon><Calendar /></el-icon>
              生日月份筛选
            </span>
          </template>
          <div class="filter-row">
            <el-radio-group v-model="filterType">
              <el-radio-button value="month">按单月</el-radio-button>
              <el-radio-button value="range">按时间段</el-radio-button>
            </el-radio-group>
            <template v-if="filterType === 'month'">
              <el-select v-model="filterMonth" placeholder="选择月份" style="width:140px">
                <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
              </el-select>
            </template>
            <template v-else>
              <el-select v-model="filterStartMonth" placeholder="起始月" style="width:120px">
                <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
              </el-select>
              <span style="margin:0 8px">至</span>
              <el-select v-model="filterEndMonth" placeholder="结束月" style="width:120px">
                <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
              </el-select>
            </template>
            <el-button type="primary" @click="loadBirthdayData">查询</el-button>
            <el-button @click="clearFilter">清除筛选</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 本月生日员工清单 -->
    <el-card v-if="birthdayList.length > 0" class="birthday-list-card">
      <template #header>
        <div class="card-header">
          <el-icon><Star /></el-icon>
          <span>{{ birthdayLabel }} — 生日员工清单</span>
          <el-button size="small" @click="exportBirthdayList" style="margin-left:auto">
            <el-icon><Download /></el-icon>
            导出Excel
          </el-button>
        </div>
      </template>
      <div class="birthday-grid">
        <el-tag
          v-for="emp in birthdayList"
          :key="emp.id"
          type="success"
          size="large"
          effect="plain"
          class="birthday-tag"
        >
          <span class="emp-name">{{ emp.name }}</span>
          <span class="emp-dept">{{ emp.department }}</span>
          <span class="emp-date">{{ formatBirthday(emp.birth_date || emp.id_number) }}</span>
        </el-tag>
      </div>
    </el-card>

    <!-- 员工数据表 -->
    <el-card class="table-card">
      <template #header>
        <span>员工花名册</span>
      </template>
      <el-table
        :data="employees"
        v-loading="loading"
        @selection-change="onSelectionChange"
        stripe
        max-height="500"
      >
        <el-table-column type="selection" width="45" />
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column label="电话" width="140">
          <template #default="{ row }">
            {{ maskPhone(row.phone) }}
          </template>
        </el-table-column>
        <el-table-column label="身份证号" width="200">
          <template #default="{ row }">
            {{ maskIdNumber(row.id_number) }}
          </template>
        </el-table-column>
        <el-table-column label="出生日期" width="120">
          <template #default="{ row }">
            {{ formatBirthday(row.id_number) }}
          </template>
        </el-table-column>
        <el-table-column prop="department" label="部门" min-width="120" />
        <el-table-column prop="position" label="职务" min-width="100" />
        <el-table-column label="在编/聘用" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.employment_type" :type="row.employment_type === '在编' ? 'success' : ''" size="small">
              {{ row.employment_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" size="small" text @click="deleteSingle(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 手动录入对话框 -->
    <el-dialog v-model="manualDialogVisible" title="手动录入员工信息" width="480px" destroy-on-close>
      <el-form :model="manualForm" label-width="100px">
        <el-form-item label="姓名" required>
          <el-input v-model="manualForm.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="manualForm.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="身份证号" required>
          <el-input v-model="manualForm.id_number" placeholder="请输入身份证号（唯一）" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="manualForm.department" placeholder="请输入所在部门" />
        </el-form-item>
        <el-form-item label="职务">
          <el-input v-model="manualForm.position" placeholder="请输入职务" />
        </el-form-item>
        <el-form-item label="在编/聘用">
          <el-select v-model="manualForm.employment_type" placeholder="请选择" style="width:100%" clearable>
            <el-option label="在编" value="在编" />
            <el-option label="聘用" value="聘用" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="manualForm.remark" type="textarea" :rows="2" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveManual" :loading="manualSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量上传对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="批量导入员工信息" width="550px" destroy-on-close>
      <div class="upload-section">
        <div class="upload-area" @click="handleFileClick">
          <input ref="fileInput" type="file" accept=".xlsx,.xls" @change="handleFileChange" style="display:none" />
          <el-icon :size="48" color="#409EFF"><UploadFilled /></el-icon>
          <p>点击选择 Excel 文件</p>
          <p class="upload-hint">Excel第一行应为表头：姓名、电话、身份证号、部门</p>
          <p class="upload-hint">身份证号为必填项，重复的将自动跳过</p>
        </div>
        <div v-if="uploadFile" class="file-info">
          <el-tag>{{ uploadFile.name }}</el-tag>
          <el-button type="primary" @click="doImport" :loading="importing" style="margin-left:12px">
            开始导入
          </el-button>
        </div>
        <div v-if="importResult" class="import-result">
          <el-alert
            :title="`导入完成：成功 ${importResult.inserted} 条，跳过 ${importResult.skipped} 条（重复或无效）`"
            :type="importResult.inserted > 0 ? 'success' : 'warning'"
            :closable="false"
            show-icon
          />
        </div>
        <!-- 下载模板 -->
        <div class="template-download">
          <el-button text type="primary" @click="downloadTemplate">
            <el-icon><Download /></el-icon>
            下载Excel模板
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import {
  getAllEmployees, insertEmployee, insertEmployeesBatch, deleteEmployee, deleteEmployeesBatch,
  searchEmployees, getEmployeeCount, getBirthdayByMonth, getBirthdayByRange,
  getBirthdayCountByMonth, getSettings
} from '../utils/api.js'

const loading = ref(false)
const employees = ref([])
const selectedRows = ref([])
const searchKeyword = ref('')
const uploadDialogVisible = ref(false)
const uploadFile = ref(null)
const importing = ref(false)
const importResult = ref(null)
const fileInput = ref(null)

// 手动录入
const manualDialogVisible = ref(false)
const manualSaving = ref(false)
const manualForm = reactive({
  name: '',
  phone: '',
  id_number: '',
  department: '',
  position: '',
  employment_type: '',
  remark: ''
})

// 筛选
const filterType = ref('month')
const filterMonth = ref(new Date().getMonth() + 1)
const filterStartMonth = ref(1)
const filterEndMonth = ref(12)
const birthdayList = ref([])
const birthdayCount = ref(0)

// 隐私模式
const privacyMode = ref(false)

const totalEmployees = computed(() => employees.value.length)

const birthdayLabel = computed(() => {
  if (filterType.value === 'month') {
    return filterMonth.value + '月生日员工'
  }
  return `${filterStartMonth.value}月-${filterEndMonth.value}月 生日员工`
})

function onSelectionChange(rows) {
  selectedRows.value = rows
}

// 加载隐私设置
async function loadPrivacySetting() {
  if (!window.electronAPI) return
  try {
    const settings = await getSettings()
    privacyMode.value = settings?.privacyMode || false
  } catch { /* ignore */ }
}

// 隐私脱敏
function maskPhone(phone) {
  if (!phone) return '-'
  if (!privacyMode.value) return phone
  return phone.replace(/(\d{3})\d{4}(\d+)/, '$1****$2')
}

function maskIdNumber(idNum) {
  if (!idNum) return '-'
  if (!privacyMode.value) return idNum
  if (idNum.length === 18) {
    return idNum.substring(0, 4) + '**********' + idNum.substring(14)
  }
  return idNum.substring(0, 3) + '********' + idNum.substring(11)
}

function formatBirthday(idNumber) {
  if (!idNumber) return '-'
  let month, day
  if (idNumber.length === 18) {
    month = idNumber.substring(10, 12)
    day = idNumber.substring(12, 14)
  } else if (idNumber.length === 15) {
    month = idNumber.substring(8, 10)
    day = idNumber.substring(10, 12)
  } else {
    return '-'
  }
  return `${month}月${day}日`
}

async function loadEmployees() {
  loading.value = true
  try {
    employees.value = await getAllEmployees()
  } catch (err) {
    ElMessage.error('加载员工数据失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

async function loadBirthdayData() {
  try {
    if (filterType.value === 'month') {
      birthdayList.value = await getBirthdayByMonth(filterMonth.value)
      birthdayCount.value = await getBirthdayCountByMonth(filterMonth.value)
    } else {
      if (filterStartMonth.value && filterEndMonth.value) {
        birthdayList.value = await getBirthdayByRange(filterStartMonth.value, filterEndMonth.value)
        birthdayCount.value = birthdayList.value.length
      }
    }
  } catch { /* ignore */ }
}

function onFilterChange() {
  if (filterType.value === 'range' && (!filterStartMonth.value || !filterEndMonth.value)) return
  loadBirthdayData()
}

function clearFilter() {
  birthdayList.value = []
  birthdayCount.value = 0
}

function onSearch() {
  if (!searchKeyword.value) {
    loadEmployees()
    return
  }
  searchEmployees({ name: searchKeyword.value }).then(r => {
    if (Array.isArray(r)) employees.value = r
  }).catch(() => {})
}

function handleFileClick() {
  fileInput.value?.click()
}

function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (file) {
    uploadFile.value = file
    importResult.value = null
  }
}

async function doImport() {
  if (!uploadFile.value) return
  importing.value = true
  importResult.value = null
  try {
    const data = await readExcelFile(uploadFile.value)
    const records = []
    data.forEach(row => {
      const name = row['姓名'] || row['name'] || ''
      const phone = String(row['电话'] || row['phone'] || row['手机'] || row['手机号'] || '')
      const idNumber = String(row['身份证号'] || row['id_number'] || row['身份证'] || row['证件号'] || '')
      const department = row['部门'] || row['department'] || row['所在部门'] || row['所属部门'] || ''
      const position = row['职务'] || row['position'] || row['职位'] || ''
      const employmentType = row['在编/聘用'] || row['employment_type'] || row['用工性质'] || ''
      const remark = row['备注'] || row['remark'] || row['note'] || ''
      if (idNumber && name) {
        records.push({ name, phone, id_number: idNumber.trim(), department, position, employment_type: employmentType.trim(), remark })
      }
    })
    if (records.length === 0) {
      ElMessage.warning('未读取到有效数据，请检查Excel格式')
      return
    }
    importResult.value = await insertEmployeesBatch(records)
    ElMessage.success(`导入完成：成功 ${importResult.value.inserted} 条，跳过 ${importResult.value.skipped} 条`)
    uploadFile.value = null
    loadEmployees()
  } catch (err) {
    ElMessage.error('导入失败: ' + err.message)
  } finally {
    importing.value = false
  }
}

function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        resolve(data)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
}

function downloadTemplate() {
  const header = ['姓名', '电话', '身份证号', '部门', '职务', '在编/聘用', '备注']
  const sample = ['张三', '13800138000', '110101199001011234', '融媒体中心', '主任编辑', '在编', '']
  const ws = XLSX.utils.aoa_to_sheet([header, sample])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '员工信息')
  XLSX.writeFile(wb, '员工信息导入模板.xlsx')
  ElMessage.success('模板下载成功')
}

async function deleteSingle(id) {
  try {
    await ElMessageBox.confirm('确定删除该员工信息吗？', '确认删除', { type: 'warning' })
    await deleteEmployee(id)
    ElMessage.success('删除成功')
    loadEmployees()
  } catch { /* cancelled */ }
}

async function batchDelete() {
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 名员工吗？`, '批量删除', { type: 'warning' })
    const ids = selectedRows.value.map(r => r.id)
    await deleteEmployeesBatch(ids)
    ElMessage.success('删除成功')
    selectedRows.value = []
    loadEmployees()
  } catch { /* cancelled */ }
}

function openManualDialog() {
  manualForm.name = ''
  manualForm.phone = ''
  manualForm.id_number = ''
  manualForm.department = ''
  manualForm.position = ''
  manualForm.employment_type = ''
  manualForm.remark = ''
  manualDialogVisible.value = true
}

async function saveManual() {
  if (!manualForm.name || !manualForm.id_number) {
    ElMessage.warning('姓名和身份证号为必填项')
    return
  }
  manualSaving.value = true
  try {
    await insertEmployee({ ...manualForm })
    ElMessage.success('员工信息保存成功')
    manualDialogVisible.value = false
    loadEmployees()
    loadBirthdayData()
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  } finally {
    manualSaving.value = false
  }
}

// 导出生日清单Excel
function exportBirthdayList() {
  if (birthdayList.value.length === 0) {
    ElMessage.warning('暂无生日员工可导出')
    return
  }
  const header = ['姓名', '电话', '身份证号', '出生日期', '部门', '职务', '在编/聘用', '备注']
  const rows = birthdayList.value.map(emp => [
    emp.name || '',
    emp.phone || '',
    privacyMode.value ? maskIdNumber(emp.id_number) : (emp.id_number || ''),
    formatBirthday(emp.birth_date || emp.id_number),
    emp.department || '',
    emp.position || '',
    emp.employment_type || '',
    emp.remark || ''
  ])
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '生日员工清单')
  const filename = `${birthdayLabel.value}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, filename)
  ElMessage.success('导出成功')
}

async function refresh() {
  await loadPrivacySetting()
  loadEmployees()
  loadBirthdayData()
}

function updatePrivacyMode(val) {
  privacyMode.value = val
}

// 向父组件暴露方法
defineExpose({ refresh, updatePrivacyMode })

onMounted(async () => {
  await loadPrivacySetting()
  await loadEmployees()
  await loadBirthdayData()
})
</script>

<style scoped>
.birthday-module {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bless-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-hint {
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
}

.stats-row {
  margin: 0 !important;
}

.stat-card {
  height: 100%;
}

.stat-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-num {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-lbl {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.birthday-list-card {
  margin: 0 !important;
}

.birthday-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.birthday-tag {
  cursor: default;
  font-size: 14px;
  padding: 8px 14px;
}

.birthday-tag .emp-name {
  font-weight: 600;
  margin-right: 8px;
}

.birthday-tag .emp-dept {
  color: #909399;
  margin-right: 8px;
  font-size: 12px;
}

.birthday-tag .emp-date {
  color: #67C23A;
  font-size: 12px;
}

.table-card {
  margin: 0 !important;
}

.upload-section {
  text-align: center;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-area:hover {
  border-color: #409EFF;
  background: rgba(64, 158, 255, 0.04);
}

.upload-hint {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}

.file-info {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.import-result {
  margin-top: 12px;
}

.template-download {
  margin-top: 12px;
}
</style>
