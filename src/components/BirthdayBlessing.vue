<template>
  <div class="birthday-module">
    <!-- 操作工具栏 -->
    <div class="bless-toolbar">
      <el-button @click="loadEmployees">
        <el-icon><Refresh /></el-icon>
        刷新
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
        stripe
        max-height="500"
      >
        <el-table-column prop="seq_number" label="总序号" width="80" align="center" />
        <el-table-column prop="category_seq" label="分类序号" width="80" align="center" />
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
            <el-button type="primary" size="small" text @click="openEditDialog(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑员工信息对话框 -->
    <el-dialog v-model="editDialogVisible" title="编辑员工信息" width="480px" destroy-on-close>
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="姓名">
          <el-input v-model="editForm.name" disabled />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="editForm.department" disabled />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="editForm.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item label="身份证号">
          <el-input v-model="editForm.id_number" placeholder="选填，不可重复" />
        </el-form-item>
        <el-form-item label="职务">
          <el-input v-model="editForm.position" placeholder="请输入职务" />
        </el-form-item>
        <el-form-item label="在编/聘用">
          <el-select v-model="editForm.employment_type" placeholder="请选择" style="width:100%" clearable>
            <el-option label="在编" value="在编" />
            <el-option label="聘用" value="聘用" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="总序号">
              <el-input-number v-model="editForm.seq_number" :min="0" :max="9999" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="分类序号">
              <el-input-number v-model="editForm.category_seq" :min="0" :max="9999" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="editForm.remark" type="textarea" :rows="2" placeholder="可选备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit" :loading="editSaving">保存</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import {
  getActiveEmployees, updateEmployee,
  searchEmployees, getBirthdayByMonth, getBirthdayByRange,
  getBirthdayCountByMonth, getSettings
} from '../utils/api.js'

const loading = ref(false)
const employees = ref([])
const searchKeyword = ref('')

// 筛选
const filterType = ref('month')
const filterMonth = ref(new Date().getMonth() + 1)
const filterStartMonth = ref(1)
const filterEndMonth = ref(12)
const birthdayList = ref([])
const birthdayCount = ref(0)

// 编辑功能
const editDialogVisible = ref(false)
const editSaving = ref(false)
const editingId = ref(null)
const editForm = reactive({
  name: '',
  department: '',
  phone: '',
  id_number: '',
  position: '',
  employment_type: '',
  seq_number: 0,
  category_seq: 0,
  remark: ''
})

function openEditDialog(row) {
  editingId.value = row.id
  editForm.name = row.name || ''
  editForm.department = row.department || ''
  editForm.phone = row.phone || ''
  editForm.id_number = row.id_number || ''
  editForm.position = row.position || ''
  editForm.employment_type = row.employment_type || ''
  editForm.seq_number = row.seq_number || 0
  editForm.category_seq = row.category_seq || 0
  editForm.remark = row.remark || ''
  editDialogVisible.value = true
}

async function saveEdit() {
  editSaving.value = true
  try {
    await updateEmployee(editingId.value, { ...editForm })
    ElMessage.success('员工信息已更新')
    editDialogVisible.value = false
    loadEmployees()
    loadBirthdayData()
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  } finally {
    editSaving.value = false
  }
}

// 隐私模式
const privacyMode = ref(false)

const totalEmployees = computed(() => employees.value.length)

const birthdayLabel = computed(() => {
  if (filterType.value === 'month') {
    return filterMonth.value + '月生日员工'
  }
  return `${filterStartMonth.value}月-${filterEndMonth.value}月 生日员工`
})

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
    employees.value = await getActiveEmployees()
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

// 导出生日清单Excel
function exportBirthdayList() {
  if (birthdayList.value.length === 0) {
    ElMessage.warning('暂无生日员工可导出')
    return
  }
  const header = ['姓名', '电话', '身份证号', '出生日期', '部门', '职务', '在编/聘用', '总序号', '分类序号', '备注']
  const rows = birthdayList.value.map(emp => [
    emp.name || '',
    emp.phone || '',
    privacyMode.value ? maskIdNumber(emp.id_number) : (emp.id_number || ''),
    formatBirthday(emp.birth_date || emp.id_number),
    emp.department || '',
    emp.position || '',
    emp.employment_type || '',
    emp.seq_number || 0,
    emp.category_seq || 0,
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
