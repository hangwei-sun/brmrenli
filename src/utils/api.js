/**
 * Electron API 安全封装层
 * 在浏览器环境下返回 null，避免因调用 undefined API 导致页面崩溃
 */
function getAPI() {
  return window.electronAPI || null
}

// 文件对话框
export async function openImages() {
  const api = getAPI()
  return api ? api.openImages() : []
}

// 图片操作
export async function copyImage(sourcePath) {
  const api = getAPI()
  return api ? api.copyImage(sourcePath) : sourcePath
}

export async function readImage(imagePath) {
  const api = getAPI()
  return api ? api.readImage(imagePath) : null
}

// OCR识别
export async function recognizeOcr(imagePath) {
  const api = getAPI()
  if (!api) throw new Error('浏览器模式不支持OCR识别，请运行 Electron 应用')
  return api.recognizeOcr(imagePath)
}

export async function recognizeOcrBatch(imagePaths) {
  const api = getAPI()
  if (!api) throw new Error('浏览器模式不支持OCR识别，请运行 Electron 应用')
  return api.recognizeOcrBatch(imagePaths)
}

// 数据库操作
export async function insertRecord(record) {
  const api = getAPI()
  if (!api) throw new Error('浏览器模式不支持数据操作')
  return api.insertRecord(record)
}

export async function updateRecord(id, record) {
  const api = getAPI()
  if (!api) throw new Error('浏览器模式不支持数据操作')
  return api.updateRecord(id, record)
}

export async function deleteRecord(id) {
  const api = getAPI()
  if (!api) throw new Error('浏览器模式不支持数据操作')
  return api.deleteRecord(id)
}

export async function deleteBatchRecords(ids) {
  const api = getAPI()
  if (!api) throw new Error('浏览器模式不支持数据操作')
  return api.deleteBatchRecords(ids)
}

export async function getRecordById(id) {
  const api = getAPI()
  if (!api) return null
  return api.getRecordById(id)
}

export async function getAllRecords() {
  const api = getAPI()
  if (!api) return []
  return api.getAllRecords()
}

export async function searchRecords(conditions) {
  const api = getAPI()
  if (!api) return []
  return api.searchRecords(conditions)
}

export async function getStatistics(params) {
  const api = getAPI()
  if (!api) return null
  return api.getStatistics(params)
}

// 统计报表
export async function getLeaveTypeStats() {
  const api = getAPI()
  if (!api) return []
  return api.getLeaveTypeStats()
}

export async function getDepartmentStats() {
  const api = getAPI()
  if (!api) return []
  return api.getDepartmentStats()
}

export async function getMonthlyTrend(year) {
  const api = getAPI()
  if (!api) return []
  return api.getMonthlyTrend(year || '')
}

export async function getPersonRanking(year) {
  const api = getAPI()
  if (!api) return []
  return api.getPersonRanking(year || '')
}

export async function getAvailableYears() {
  const api = getAPI()
  if (!api) return []
  return api.getAvailableYears()
}

// ============ 设置管理 ============

export async function getSettings() {
  const api = getAPI()
  if (!api) return null
  return api.getSettings()
}

export async function getSetting(key) {
  const api = getAPI()
  if (!api) return null
  return api.getSetting(key)
}

export async function setSetting(key, value) {
  const api = getAPI()
  if (!api) return false
  return api.setSetting(key, value)
}

export async function updateAllSettings(newSettings) {
  const api = getAPI()
  if (!api) return false
  return api.updateAllSettings(newSettings)
}

export async function testTencentApi(config) {
  const api = getAPI()
  if (!api) return { success: false, error: '仅支持Electron环境' }
  return api.testTencentApi(config)
}

export async function testGlmApi(config) {
  const api = getAPI()
  if (!api) return { success: false, error: '仅支持Electron环境' }
  return api.testGlmApi(config)
}
