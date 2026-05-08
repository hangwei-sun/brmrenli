/**
 * Excel导入导出工具模块
 * 使用 xlsx 库实现请假记录的批量导入和导出功能
 */
import * as XLSX from 'xlsx'

// 请假记录的Excel字段映射
const FIELD_MAP = {
  '申请人': 'applicant',
  '部门': 'department',
  '代办人': 'agent',
  '请假类型': 'leave_type',
  '开始日期': 'start_date',
  '结束日期': 'end_date',
  '天数': 'days',
  '申请日期': 'apply_date',
  '销假日期': 'cancel_date',
  '备注': 'remark'
}

// 反向映射（英->中）
const REVERSE_FIELD_MAP = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k])
)

/**
 * 导出请假记录到Excel文件
 * @param {Array} records - 请假记录数组
 * @param {string} filename - 文件名（不含扩展名）
 */
export function exportToExcel(records, filename = '请假记录') {
  if (!records || records.length === 0) {
    throw new Error('没有可导出的数据')
  }

  const exportData = records.map(record => {
    const row = {}
    for (const [cnName, enName] of Object.entries(FIELD_MAP)) {
      row[cnName] = record[enName] || ''
    }
    // 添加创建时间
    row['创建时间'] = record.created_at || ''
    return row
  })

  // 创建工作簿
  const ws = XLSX.utils.json_to_sheet(exportData)

  // 设置列宽
  const colWidths = [
    { wch: 10 },  // 申请人
    { wch: 15 },  // 部门
    { wch: 10 },  // 代办人
    { wch: 10 },  // 请假类型
    { wch: 12 },  // 开始日期
    { wch: 12 },  // 结束日期
    { wch: 8 },   // 天数
    { wch: 12 },  // 申请日期
    { wch: 12 },  // 销假日期
    { wch: 20 },  // 备注
    { wch: 20 }   // 创建时间
  ]
  ws['!cols'] = colWidths

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '请假记录')

  // 生成文件名：请假记录_2024-01-01.xlsx
  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `${filename}_${dateStr}.xlsx`)
}

/**
 * 从Excel文件读取请假记录
 * @param {File|ArrayBuffer} fileData - Excel文件的ArrayBuffer
 * @returns {Array} 请假记录数组
 */
export function importFromExcel(fileData) {
  const wb = XLSX.read(fileData)
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    throw new Error('Excel文件中未找到工作表')
  }

  const ws = wb.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json(ws)

  const records = jsonData.map(row => {
    const record = {}
    for (const [cnName, enName] of Object.entries(FIELD_MAP)) {
      let value = row[cnName]
      // Excel中的日期可能是数字格式（日期序列号）
      if (value !== undefined && value !== null && value !== '') {
        if (enName.includes('date') && typeof value === 'number') {
          // 将Excel日期序列号转为YYYY-MM-DD格式
          value = excelDateToString(value)
        }
        record[enName] = String(value).trim()
      } else {
        record[enName] = ''
      }
    }
    record.days = parseInt(record.days) || 0
    return record
  })

  return records
}

/**
 * 将Excel日期序列号转换为YYYY-MM-DD字符串
 * Excel的日期序列号从1900-01-01开始计算（注意1900年的bug）
 * @param {number} serial - Excel日期序列号
 * @returns {string} 格式化的日期字符串
 */
function excelDateToString(serial) {
  // Excel日期的纪元调整：1899-12-30是序列号0
  const date = new Date((serial - 25569) * 86400 * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 验证导入数据的有效性
 * @param {Array} records - 待导入的请假记录
 * @returns {Object} { valid: Array, errors: Array }
 */
export function validateImportData(records) {
  const valid = []
  const errors = []

  records.forEach((record, index) => {
    const rowErrors = []
    if (!record.applicant || record.applicant.trim() === '') {
      rowErrors.push('申请人不能为空')
    }
    if (!record.leave_type || record.leave_type.trim() === '') {
      rowErrors.push('请假类型不能为空')
    }
    if (!record.start_date || record.start_date.trim() === '') {
      rowErrors.push('开始日期不能为空')
    }
    if (!record.end_date || record.end_date.trim() === '') {
      rowErrors.push('结束日期不能为空')
    }
    if (!record.days || record.days <= 0) {
      rowErrors.push('天数必须大于0')
    }

    if (rowErrors.length > 0) {
      errors.push({ row: index + 2, errors: rowErrors }) // +2因为第1行是表头
    } else {
      valid.push(record)
    }
  })

  return { valid, errors }
}
