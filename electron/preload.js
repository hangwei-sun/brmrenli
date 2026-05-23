const { contextBridge, ipcRenderer } = require('electron')

// 通过contextBridge安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  openImages: () => ipcRenderer.invoke('dialog:openImages'),

  // 图片操作
  copyImage: (sourcePath) => ipcRenderer.invoke('image:copy', sourcePath),
  readImage: (imagePath) => ipcRenderer.invoke('image:read', imagePath),
  saveBase64Image: (base64Data, fileName) => ipcRenderer.invoke('image:saveBase64', base64Data, fileName),

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

  // 员工管理
  getAllEmployees: () => ipcRenderer.invoke('db:getAllEmployees'),
  getActiveEmployees: () => ipcRenderer.invoke('db:getActiveEmployees'),
  getDistinctDepartments: () => ipcRenderer.invoke('db:getDistinctDepartments'),
  insertEmployee: (record) => ipcRenderer.invoke('db:insertEmployee', record),
  insertEmployeesBatch: (records) => ipcRenderer.invoke('db:insertEmployeesBatch', records),
  updateEmployee: (id, record) => ipcRenderer.invoke('db:updateEmployee', id, record),
  deleteEmployee: (id) => ipcRenderer.invoke('db:deleteEmployee', id),
  deleteEmployeesBatch: (ids) => ipcRenderer.invoke('db:deleteEmployeesBatch', ids),
  searchEmployees: (conditions) => ipcRenderer.invoke('db:searchEmployees', conditions),
  getEmployeeCount: () => ipcRenderer.invoke('db:getEmployeeCount'),
  getBirthdayByMonth: (month) => ipcRenderer.invoke('db:getBirthdayByMonth', month),
  getBirthdayByRange: (startMonth, endMonth) => ipcRenderer.invoke('db:getBirthdayByRange', startMonth, endMonth),
  getBirthdayCountByMonth: (month) => ipcRenderer.invoke('db:getBirthdayCountByMonth', month),
  getBirthdayStats: () => ipcRenderer.invoke('db:getBirthdayStats'),

  // 设置管理
  getSettings: () => ipcRenderer.invoke('settings:getAll'),
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  updateAllSettings: (newSettings) => ipcRenderer.invoke('settings:updateAll', newSettings),
  testTencentApi: (config) => ipcRenderer.invoke('settings:testTencent', config),
  testGlmApi: (config) => ipcRenderer.invoke('settings:testGlm', config),
  testDashScopeApi: (config) => ipcRenderer.invoke('settings:testDashScope', config),

  // 登录密码
  setPassword: (password) => ipcRenderer.invoke('password:set', password),
  verifyPassword: (password) => ipcRenderer.invoke('password:verify', password),
  isPasswordSet: () => ipcRenderer.invoke('password:isSet'),
  setAdminPassword: (password) => ipcRenderer.invoke('password:setAdmin', password),
  verifyAdminPassword: (password) => ipcRenderer.invoke('password:verifyAdmin', password),

  // 备份与同步
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import')
})
