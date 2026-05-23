<template>
  <div class="employee-list">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-input v-model="searchKeyword" placeholder="搜索姓名/部门" clearable style="width:240px" @input="onSearch" />
        <span class="total-hint">共 {{ filteredEmployees.length }} 名职工</span>
      </div>
      <div class="toolbar-right">
        <el-button @click="downloadTemplate">
          <el-icon><Download /></el-icon> 下载模板
        </el-button>
        <el-button type="warning" @click="uploadDialogVisible = true">
          <el-icon><UploadFilled /></el-icon> 批量导入
        </el-button>
        <el-button type="primary" @click="openManualDialog(null)">
          <el-icon><Plus /></el-icon> 手工录入
        </el-button>
        <el-button type="danger" plain @click="confirmBatchDelete" :disabled="selectedRows.length === 0">
          <el-icon><Delete /></el-icon> 批量删除 ({{ selectedRows.length }})
        </el-button>
      </div>
    </div>

    <!-- 职工表格 -->
    <el-card class="section-card">
      <el-table :data="filteredEmployees" stripe border highlight-current-row style="width:100%" v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column type="index" label="#" width="50" />
        <el-table-column prop="name" label="姓名" min-width="100" show-overflow-tooltip />
        <el-table-column prop="department" label="所在部门" min-width="140" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.active" :active-value="1" :inactive-value="0" @change="toggleActive(row)" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openManualDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="confirmDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 批量导入对话框 -->
    <el-dialog v-model="uploadDialogVisible" title="批量导入职工" width="500px" destroy-on-close>
      <div class="upload-area-dialog" @click="fileInput?.click()" :class="{ 'has-file': uploadFile }">
        <input ref="fileInput" type="file" accept=".xlsx,.xls" @change="handleFileChange" style="display:none" />
        <el-icon :size="48" color="#409EFF"><UploadFilled /></el-icon>
        <p>点击选择 Excel 文件</p>
        <p class="upload-hint">Excel第一行应为表头：姓名、所在部门</p>
      </div>
      <div v-if="uploadFile" class="file-info">
        <el-tag>{{ uploadFile.name }}</el-tag>
        <el-button type="primary" @click="doImport" :loading="importing" style="margin-left:12px">开始导入</el-button>
      </div>
      <div v-if="importResult" class="import-result">
        <el-alert
          :title="`导入完成：成功 ${importResult.inserted} 条，跳过 ${importResult.skipped} 条`"
          :type="importResult.inserted > 0 ? 'success' : 'warning'"
          :closable="false" show-icon
        />
      </div>
    </el-dialog>

    <!-- 手动录入/编辑对话框 -->
    <el-dialog
      v-model="manualDialogVisible"
      :title="editingEmployee ? '编辑职工信息' : '手工录入职工'"
      width="450px"
      destroy-on-close
      @closed="resetManualForm"
    >
      <el-form :model="manualForm" label-width="80px" ref="manualFormRef">
        <el-form-item label="姓名" prop="name" :rules="[{ required: true, message: '请输入姓名', trigger: 'blur' }]">
          <el-input v-model="manualForm.name" placeholder="请输入职工姓名" :disabled="!!editingEmployee" />
        </el-form-item>
        <el-form-item label="所在部门">
          <el-select v-model="manualForm.department" placeholder="请选择部门" clearable filterable style="width:100%">
            <el-option v-for="d in departmentOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="manualForm.remark" placeholder="选填备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveManual" :loading="manualSaving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 删除验证对话框 -->
    <el-dialog v-model="deleteDialogVisible" title="管理员验证" width="380px" :close-on-click-modal="false">
      <p style="margin-bottom:12px">
        <template v-if="deleteTarget">删除职工 <strong>{{ deleteTarget.name }}</strong> 需要管理员密码</template>
        <template v-else>批量删除 <strong>{{ selectedRows.length }}</strong> 名职工需要管理员密码</template>
      </p>
      <el-input v-model="adminPasswordInput" type="password" show-password placeholder="请输入管理员密码" @keyup.enter="doDelete" />
      <p v-if="deleteError" class="text-error" style="margin-top:8px">{{ deleteError }}</p>
      <template #footer>
        <el-button @click="deleteDialogVisible = false">取消</el-button>
        <el-button type="danger" @click="doDelete" :loading="deleteLoading">确认删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const emit = defineEmits(['employeesChanged'])
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import { getAllEmployees, insertEmployee, insertEmployeesBatch, updateEmployee, deleteEmployee, deleteEmployeesBatch, getDistinctDepartments } from '../utils/api.js'

const loading = ref(false)
const employees = ref([])
const selectedRows = ref([])
const searchKeyword = ref('')
const uploadDialogVisible = ref(false)
const uploadFile = ref(null)
const importing = ref(false)
const importResult = ref(null)
const fileInput = ref(null)

const manualDialogVisible = ref(false)
const manualSaving = ref(false)
const manualFormRef = ref(null)
const editingEmployee = ref(null)

const manualForm = reactive({
  name: '',
  department: '',
  remark: ''
})

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

const filteredEmployees = computed(() => {
  if (!searchKeyword.value) return employees.value
  const kw = searchKeyword.value.toLowerCase()
  return employees.value.filter(e =>
    e.name.toLowerCase().includes(kw) ||
    (e.department || '').toLowerCase().includes(kw)
  )
})

function onSearch() { /* computed handles filtering */ }

async function loadEmployees() {
  loading.value = true
  try {
    employees.value = await getAllEmployees()
  } catch (err) {
    ElMessage.error('加载职工名单失败: ' + err.message)
  } finally {
    loading.value = false
  }
}

// 打开手动录入/编辑
function openManualDialog(row) {
  if (row) {
    editingEmployee.value = row
    manualForm.name = row.name || ''
    manualForm.department = row.department || ''
    manualForm.remark = row.remark || ''
  } else {
    editingEmployee.value = null
    manualForm.name = ''
    manualForm.department = ''
    manualForm.remark = ''
  }
  manualDialogVisible.value = true
}

function resetManualForm() {
  editingEmployee.value = null
  manualForm.name = ''
  manualForm.department = ''
  manualForm.remark = ''
}

async function saveManual() {
  if (!manualForm.name.trim()) {
    ElMessage.warning('请输入职工姓名')
    return
  }
  manualSaving.value = true
  try {
    if (editingEmployee.value) {
      await updateEmployee(editingEmployee.value.id, {
        name: manualForm.name,
        department: manualForm.department,
        remark: manualForm.remark
      })
      ElMessage.success('职工信息已更新')
    } else {
      await insertEmployee({
        name: manualForm.name,
        department: manualForm.department,
        remark: manualForm.remark
      })
      ElMessage.success('职工已添加')
    }
    manualDialogVisible.value = false
    loadEmployees()
    emit('employeesChanged')
  } catch (err) {
    ElMessage.error('保存失败: ' + err.message)
  } finally {
    manualSaving.value = false
  }
}

// 删除（需要管理员密码）
const deleteDialogVisible = ref(false)
const deleteTarget = ref(null)
const adminPasswordInput = ref('')
const deleteError = ref('')
const deleteLoading = ref(false)

function confirmDelete(row) {
  deleteTarget.value = row
  adminPasswordInput.value = ''
  deleteError.value = ''
  deleteDialogVisible.value = true
}

function onSelectionChange(rows) {
  selectedRows.value = rows
}

async function confirmBatchDelete() {
  if (selectedRows.value.length === 0) return
  deleteTarget.value = null // 标记为批量删除模式
  adminPasswordInput.value = ''
  deleteError.value = ''
  deleteDialogVisible.value = true
}

async function doDelete() {
  if (!adminPasswordInput.value) {
    deleteError.value = '请输入管理员密码'
    return
  }
  deleteLoading.value = true
  deleteError.value = ''
  try {
    const ok = await window.electronAPI.verifyAdminPassword(adminPasswordInput.value)
    if (!ok) {
      deleteError.value = '管理员密码错误'
      deleteLoading.value = false
      return
    }
    if (deleteTarget.value === null) {
      // 批量删除模式
      const ids = selectedRows.value.map(r => r.id)
      await deleteEmployeesBatch(ids)
      ElMessage.success(`已删除 ${ids.length} 名职工`)
      selectedRows.value = []
    } else {
      // 单个删除模式
      await deleteEmployee(deleteTarget.value.id)
      ElMessage.success('已删除')
      deleteTarget.value = null
    }
    deleteDialogVisible.value = false
    adminPasswordInput.value = ''
    loadEmployees()
    emit('employeesChanged')
  } catch (err) {
    deleteError.value = '删除失败: ' + err.message
  } finally {
    deleteLoading.value = false
  }
}

// 切换活跃状态
async function toggleActive(row) {
  try {
    await updateEmployee(row.id, { active: row.active })
    emit('employeesChanged')
  } catch (err) {
    ElMessage.error('状态更新失败: ' + err.message)
    row.active = row.active === 1 ? 0 : 1 // 回滚
  }
}

// Excel 导入
function handleFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  uploadFile.value = file
  importResult.value = null
}

async function doImport() {
  if (!uploadFile.value) return
  importing.value = true
  try {
    const data = await readExcelFile(uploadFile.value)
    const records = []
    data.forEach(row => {
      const name = (row['姓名'] || row['name'] || '').trim()
      const department = (row['所在部门'] || row['部门'] || row['department'] || '').trim()
      const remark = (row['备注'] || row['remark'] || '').trim()
      if (name) {
        records.push({ name, department, remark })
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
    emit('employeesChanged')
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
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        resolve(json)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function downloadTemplate() {
  const header = ['姓名', '所在部门', '备注']
  const sample = ['张三', '新闻采编中心', '']
  const ws = XLSX.utils.aoa_to_sheet([header, sample])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '职工名单')
  XLSX.writeFile(wb, '职工名单导入模板.xlsx')
  ElMessage.success('模板下载成功')
}

onMounted(() => {
  loadEmployees()
  loadDepartmentOptions()
})

defineExpose({ refresh: loadEmployees })
</script>

<style scoped>
.employee-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.total-hint {
  font-size: 13px;
  color: #909399;
}
.upload-area-dialog {
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  color: #909399;
  transition: border-color 0.2s;
}
.upload-area-dialog:hover {
  border-color: #409eff;
}
.upload-area-dialog p {
  margin: 8px 0 0;
}
.upload-hint {
  font-size: 12px;
  color: #c0c4cc;
}
.file-info {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
}
.import-result {
  margin-top: 12px;
}
.text-error {
  color: #f56c6c;
  font-size: 13px;
}
</style>
