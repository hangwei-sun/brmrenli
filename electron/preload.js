const { contextBridge, ipcRenderer } = require('electron')

// 通过contextBridge安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  openImages: () => ipcRenderer.invoke('dialog:openImages'),

  // 图片操作
  copyImage: (sourcePath) => ipcRenderer.invoke('image:copy', sourcePath),
  readImage: (imagePath) => ipcRenderer.invoke('image:read', imagePath),

  // OCR识别
  recognizeOcr: (imagePath) => ipcRenderer.invoke('ocr:recognize', imagePath),
  recognizeOcrBatch: (imagePaths) => ipcRenderer.invoke('ocr:recognizeBatch', imagePaths),

  // 数据库操作
  insertRecord: (record) => ipcRenderer.invoke('db:insert', record),
  updateRecord: (id, record) => ipcRenderer.invoke('db:update', id, record),
  deleteRecord: (id) => ipcRenderer.invoke('db:delete', id),
  deleteBatchRecords: (ids) => ipcRenderer.invoke('db:deleteBatch', ids),
  getRecordById: (id) => ipcRenderer.invoke('db:getById', id),
  getAllRecords: () => ipcRenderer.invoke('db:getAll'),
  searchRecords: (conditions) => ipcRenderer.invoke('db:search', conditions),
  getStatistics: (params) => ipcRenderer.invoke('db:getStatistics', params),

  // 统计报表
  getLeaveTypeStats: () => ipcRenderer.invoke('db:getLeaveTypeStats'),
  getDepartmentStats: () => ipcRenderer.invoke('db:getDepartmentStats'),
  getMonthlyTrend: (year) => ipcRenderer.invoke('db:getMonthlyTrend', year || ''),
  getPersonRanking: (year) => ipcRenderer.invoke('db:getPersonRanking', year || ''),
  getAvailableYears: () => ipcRenderer.invoke('db:getAvailableYears'),

  // 设置管理
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  updateAllSettings: (newSettings) => ipcRenderer.invoke('settings:updateAll', newSettings),
  testTencentApi: (config) => ipcRenderer.invoke('settings:testTencent', config),
  testGlmApi: (config) => ipcRenderer.invoke('settings:testGlm', config)
})
