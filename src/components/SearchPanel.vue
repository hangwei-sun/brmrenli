<template>
  <div class="search-panel">
    <!-- 搜索条件 -->
    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><Search /></el-icon>
          <span>查询条件</span>
        </div>
      </template>

      <el-form :model="searchForm" label-width="90px">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="申请人">
              <el-input v-model="searchForm.applicant" placeholder="模糊搜索" clearable />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="部门">
              <el-select v-model="searchForm.department" placeholder="全部" clearable style="width:100%">
                <el-option v-for="d in departmentList" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="请假类型">
              <el-select v-model="searchForm.leave_type" placeholder="全部" clearable style="width:100%">
                <el-option v-for="t in leaveTypes" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="10">
            <el-form-item label="开始日期">
              <el-date-picker
                v-model="searchForm.start_date_range"
                type="daterange"
                range-separator="至"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="10">
            <el-form-item label="结束日期">
              <el-date-picker
                v-model="searchForm.end_date_range"
                type="daterange"
                range-separator="至"
                start-placeholder="开始"
                end-placeholder="结束"
                value-format="YYYY-MM-DD"
                style="width:100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="4">
            <el-form-item label-width="0">
              <el-button type="primary" @click="handleSearch">
                <el-icon><Search /></el-icon>
                查询
              </el-button>
              <el-button @click="handleReset">重置</el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>

    <!-- 搜索结果 -->
    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><List /></el-icon>
          <span>查询结果 ({{ searchResults.length }} 条)</span>
        </div>
      </template>

      <div class="result-toolbar">
        <el-button type="success" :disabled="searchResults.length === 0" @click="exportResults">
          <el-icon><Download /></el-icon>
          导出结果到Excel
        </el-button>
      </div>

      <el-table
        :data="searchResults"
        stripe
        border
        style="width: 100%; margin-top: 12px"
        max-height="calc(100vh - 520px)"
      >
        <el-table-column prop="applicant" label="申请人" width="100" />
        <el-table-column prop="department" label="部门" width="120" />
        <el-table-column prop="agent" label="代办人" width="100" />
        <el-table-column prop="leave_type" label="请假类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getLeaveTypeTag(row.leave_type)" size="small">
              {{ row.leave_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始日期" width="110" />
        <el-table-column prop="end_date" label="结束日期" width="110" />
        <el-table-column prop="days" label="天数" width="60" align="center" />
        <el-table-column prop="apply_date" label="申请日期" width="110" />
        <el-table-column prop="cancel_date" label="销假日期" width="110" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="160" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import { getAllRecords, searchRecords, getDistinctDepartments } from '../utils/api.js'

const emit = defineEmits(['search', 'export'])

const leaveTypes = [
  '年休假', '病假', '事假', '婚假', '丧假',
  '探亲假', '产假', '护理假', '育儿假'
]

const departmentList = ref([])
const searchResults = ref([])

const searchForm = reactive({
  applicant: '',
  department: '',
  leave_type: '',
  start_date_range: null,
  end_date_range: null
})

// 加载部门列表（从职工名单中读取）
async function loadDepartments() {
  try {
    const deps = await getDistinctDepartments()
    departmentList.value = deps || []
  } catch {
    // ignore
  }
}

// 执行搜索
async function handleSearch() {
  const conditions = {}

  if (searchForm.applicant) conditions.applicant = searchForm.applicant
  if (searchForm.department) conditions.department = searchForm.department
  if (searchForm.leave_type) conditions.leave_type = searchForm.leave_type
  if (searchForm.start_date_range && searchForm.start_date_range.length === 2) {
    conditions.start_date_begin = searchForm.start_date_range[0]
    conditions.start_date_end = searchForm.start_date_range[1]
  }
  if (searchForm.end_date_range && searchForm.end_date_range.length === 2) {
    conditions.end_date_begin = searchForm.end_date_range[0]
    conditions.end_date_end = searchForm.end_date_range[1]
  }

  try {
    searchResults.value = await searchRecords(conditions)
    emit('search', conditions)
  } catch (err) {
    ElMessage.error('查询失败: ' + err.message)
  }
}

// 重置搜索条件
function handleReset() {
  searchForm.applicant = ''
  searchForm.department = ''
  searchForm.leave_type = ''
  searchForm.start_date_range = null
  searchForm.end_date_range = null
  searchResults.value = []
}

// 导出搜索结果到Excel
function exportResults() {
  if (searchResults.value.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  const exportData = searchResults.value.map(r => ({
    '申请人': r.applicant,
    '部门': r.department,
    '代办人': r.agent,
    '请假类型': r.leave_type,
    '开始日期': r.start_date,
    '结束日期': r.end_date,
    '天数': r.days,
    '申请日期': r.apply_date,
    '销假日期': r.cancel_date,
    '备注': r.remark,
    '创建时间': r.created_at
  }))

  const ws = XLSX.utils.json_to_sheet(exportData)
  ws['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 },
    { wch: 12 }, { wch: 20 }, { wch: 20 }
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '搜索结果')
  XLSX.writeFile(wb, '查询结果_' + new Date().toISOString().slice(0, 10) + '.xlsx')
  ElMessage.success('导出成功')
}

function getLeaveTypeTag(type) {
  const map = {
    '年休假': 'primary', '病假': 'danger', '事假': 'warning',
    '婚假': 'success', '丧假': 'info', '探亲假': 'primary',
    '产假': 'success', '护理假': 'warning', '育儿假': 'primary'
  }
  return map[type] || 'info'
}

onMounted(() => {
  loadDepartments()
})
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.result-toolbar {
  display: flex;
  justify-content: flex-end;
}
</style>
