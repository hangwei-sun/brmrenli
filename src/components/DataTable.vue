<template>
  <div class="data-table">
    <!-- 工具栏 -->
    <el-card class="section-card">
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button @click="emit('refresh')">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button
            type="danger"
            :disabled="selectedRows.length === 0"
            @click="handleBatchDelete"
          >
            <el-icon><Delete /></el-icon>
            批量删除 ({{ selectedRows.length }})
          </el-button>
          <el-button type="success" @click="exportToExcel">
            <el-icon><Download /></el-icon>
            导出Excel
          </el-button>
          <el-button @click="handleImportExcel">
            <el-icon><Upload /></el-icon>
            从Excel导入
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-input
            v-model="quickSearch"
            placeholder="快速搜索申请人..."
            clearable
            style="width: 220px"
            @input="handleQuickSearch"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>
    </el-card>

    <!-- 数据表格 -->
    <el-card class="section-card table-card">
      <el-table
        ref="tableRef"
        :data="pageRecords"
        stripe
        border
        style="width: 100%"
        @selection-change="handleSelectionChange"
        :default-sort="{ prop: 'created_at', order: 'descending' }"
        max-height="calc(100vh - 400px)"
      >
        <el-table-column type="selection" width="45" fixed="left" />
        <el-table-column type="index" label="#" width="50" />

        <el-table-column prop="applicant" label="申请人" width="100" fixed="left" sortable="custom" />
        <el-table-column prop="department" label="部门" width="120" />
        <el-table-column prop="agent" label="代办人" width="100" />
        <el-table-column prop="leave_type" label="请假类型" width="100">
          <template #default="{ row }">
            <el-tag
              :type="getLeaveTypeTag(row.leave_type)"
              size="small"
            >
              {{ row.leave_type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="start_date" label="开始日期" width="110" sortable="custom" />
        <el-table-column prop="end_date" label="结束日期" width="110" sortable="custom" />
        <el-table-column prop="days" label="天数" width="60" align="center" sortable="custom" />
        <el-table-column prop="apply_date" label="申请日期" width="110" />
        <el-table-column prop="cancel_date" label="销假日期" width="110" />

        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column prop="created_at" label="创建时间" width="160" />

        <!-- 操作列 -->
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleViewImage(row)">
              <el-icon><View /></el-icon>
              查看原图
            </el-button>
            <el-button link type="warning" size="small" @click="handleEdit(row)">
              <el-icon><Edit /></el-icon>
              编辑
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[20, 50, 100, 200]"
          :total="allRecords.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </el-card>

    <!-- 查看原图对话框 -->
    <el-dialog v-model="imageDialogVisible" title="原始请假条图片" width="800px" destroy-on-close>
      <div style="text-align: center">
        <el-image
          v-if="currentImageUrl"
          :src="currentImageUrl"
          fit="contain"
          style="max-width: 100%; max-height: 600px"
        />
        <el-empty v-else description="无法加载原图" />
        <p style="margin-top: 12px; color: #909399; font-size: 13px">
          {{ currentImageInfo }}
        </p>
      </div>
    </el-dialog>

    <!-- 隐藏的文件导入input -->
    <input
      ref="fileInputRef"
      type="file"
      accept=".xlsx,.xls"
      style="display: none"
      @change="handleFileImport"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as XLSX from 'xlsx'
import { searchRecords, deleteBatchRecords, deleteRecord, readImage, insertRecord } from '../utils/api.js'

const props = defineProps({
  records: { type: Array, default: () => [] }
})

const emit = defineEmits(['refresh', 'edit'])

const tableRef = ref(null)
const fileInputRef = ref(null)
const selectedRows = ref([])
const currentPage = ref(1)
const pageSize = ref(50)
const quickSearch = ref('')
const imageDialogVisible = ref(false)
const currentImageUrl = ref('')
const currentImageInfo = ref('')
const allRecords = ref([])

// 分页后的数据
const pageRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return allRecords.value.slice(start, end)
})

// 同步props.records
watch(() => props.records, (newVal) => {
  allRecords.value = newVal || []
  currentPage.value = 1
}, { immediate: true, deep: true })

// 根据请假类型返回标签样式
function getLeaveTypeTag(type) {
  const map = {
    '年休假': 'primary', '病假': 'danger', '事假': 'warning',
    '婚假': 'success', '丧假': 'info', '探亲假': 'primary',
    '产假': 'success', '护理假': 'warning', '育儿假': 'primary'
  }
  return map[type] || 'info'
}

// 快速搜索
let searchTimer = null
function handleQuickSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(async () => {
    currentPage.value = 1
    if (quickSearch.value) {
      const res = await searchRecords({ applicant: quickSearch.value })
      allRecords.value = res
    } else {
      emit('refresh')
    }
  }, 300)
}

// 选择变化
function handleSelectionChange(rows) {
  selectedRows.value = rows
}

// 批量删除
async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      '确定要删除选中的 ' + selectedRows.value.length + ' 条记录吗？此操作不可恢复。',
      '批量删除确认',
      { type: 'warning', confirmButtonText: '确定删除', cancelButtonText: '取消' }
    )
    const ids = selectedRows.value.map(r => r.id)
    await deleteBatchRecords(ids)
    ElMessage.success('已删除 ' + ids.length + ' 条记录')
    selectedRows.value = []
    emit('refresh')
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error('删除失败: ' + err.message)
    }
  }
}

// 删除单条
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      '确定要删除 ' + row.applicant + ' 的请假记录吗？',
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
    await deleteRecord(row.id)
    ElMessage.success('删除成功')
    emit('refresh')
  } catch (err) {
    if (err !== 'cancel' && err !== 'close') {
      ElMessage.error('删除失败: ' + err.message)
    }
  }
}

// 编辑记录
function handleEdit(row) {
  emit('edit', row)
}

// 查看原图
async function handleViewImage(row) {
  if (row.image_path) {
    currentImageUrl.value = await readImage(row.image_path)
    currentImageInfo.value = row.applicant + ' - ' + row.leave_type + ' (' + row.start_date + ' ~ ' + row.end_date + ')'
  } else {
    currentImageUrl.value = ''
    currentImageInfo.value = '无原图'
  }
  imageDialogVisible.value = true
}

// 导出Excel
function exportToExcel() {
  const dataToExport = allRecords.value.length > 0 ? allRecords.value : props.records

  if (!dataToExport || dataToExport.length === 0) {
    ElMessage.warning('没有可导出的数据')
    return
  }

  const exportData = dataToExport.map(r => ({
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
  XLSX.utils.book_append_sheet(wb, ws, '请假记录')
  XLSX.writeFile(wb, '请假记录_' + new Date().toISOString().slice(0, 10) + '.xlsx')
  ElMessage.success('导出成功')
}

// 从Excel导入
function handleImportExcel() {
  fileInputRef.value.click()
}

async function handleFileImport(e) {
  const file = e.target.files[0]
  if (!file) return

  try {
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(sheet)

    let count = 0
    for (const row of jsonData) {
      await insertRecord({
        applicant: row['申请人'] || '',
        department: row['部门'] || '',
        agent: row['代办人'] || '',
        leave_type: row['请假类型'] || '',
        start_date: row['开始日期'] ? formatExcelDate(row['开始日期']) : '',
        end_date: row['结束日期'] ? formatExcelDate(row['结束日期']) : '',
        days: parseInt(row['天数']) || 0,
        apply_date: row['申请日期'] ? formatExcelDate(row['申请日期']) : '',
        cancel_date: row['销假日期'] ? formatExcelDate(row['销假日期']) : '',
        image_path: '',
        ocr_confidence: 0,
        remark: row['备注'] || ''
      })
      count++
    }

    ElMessage.success('成功导入 ' + count + ' 条记录')
    emit('refresh')
  } catch (err) {
    ElMessage.error('导入失败: ' + err.message)
  } finally {
    fileInputRef.value.value = ''
  }
}

// 格式化Excel日期
function formatExcelDate(val) {
  if (!val) return ''
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000)
    return date.toISOString().slice(0, 10)
  }
  return String(val).trim()
}

defineExpose({ exportToExcel })
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-left {
  display: flex;
  gap: 8px;
}

.table-card {
  overflow: auto;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
