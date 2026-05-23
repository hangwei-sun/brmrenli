const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')
const Database = require('./database')
const OcrEngine = require('./ocr')
const SettingsStore = require('./settings')
const BackupManager = require('./backup')

// 判断是否为开发环境
const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let db = null
let ocr = null
let settings = null
let backupManager = null

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: '包融媒人力智慧管理系统',
    icon: nativeImage.createFromPath(path.join(__dirname, 'icon.ico')),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发环境加载Vite服务器，生产环境加载打包后的文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 初始化数据库和OCR引擎
async function initializeServices() {
  const userDataPath = app.getPath('userData')
  const imagesPath = path.join(userDataPath, 'images')

  // 创建images备份目录
  if (!fs.existsSync(imagesPath)) {
    fs.mkdirSync(imagesPath, { recursive: true })
  }

  // 初始化数据库
  db = new Database(path.join(userDataPath, 'leave_records.db'))
  await db.init()

  // 初始化OCR引擎
  ocr = new OcrEngine()

  // 初始化设置存储
  settings = new SettingsStore(userDataPath)
  ocr.updateSettings(settings.getAll())

  // 初始化备份管理器
  backupManager = new BackupManager(userDataPath, db)
}

// ==================== IPC 事件处理 ====================

// 选择图片文件
ipcMain.handle('dialog:openImages', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择请假条图片',
    filters: [
      { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'webp'] }
    ],
    properties: ['openFile', 'multiSelections']
  })
  if (result.canceled) return []
  return result.filePaths
})

// 复制图片到应用目录备份
ipcMain.handle('image:copy', async (event, sourcePath) => {
  const userDataPath = app.getPath('userData')
  const imagesPath = path.join(userDataPath, 'images')
  const timestamp = Date.now()
  const ext = path.extname(sourcePath)
  const destName = `${timestamp}${ext}`
  const destPath = path.join(imagesPath, destName)
  try {
    fs.copyFileSync(sourcePath, destPath)
    return destPath
  } catch (err) {
    // 如果复制失败，返回原路径
    console.error('图片复制失败:', err)
    return sourcePath
  }
})

// 保存base64图片到应用目录（用于手动录入上传的图片）
ipcMain.handle('image:saveBase64', async (event, base64Data, fileName) => {
  const userDataPath = app.getPath('userData')
  const imagesPath = path.join(userDataPath, 'images')
  const timestamp = Date.now()
  const ext = path.extname(fileName) || '.png'
  const destName = `${timestamp}${ext}`
  const destPath = path.join(imagesPath, destName)
  try {
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '')
    fs.writeFileSync(destPath, Buffer.from(base64, 'base64'))
    return destPath
  } catch (err) {
    console.error('保存图片失败:', err)
    return ''
  }
})

// OCR识别图片
ipcMain.handle('ocr:recognize', async (event, imagePath) => {
  try {
    const result = await ocr.recognize(imagePath)
    return { success: true, data: result }
  } catch (err) {
    console.error('OCR识别失败:', err)
    return { success: false, error: err.message }
  }
})

// 批量OCR识别
ipcMain.handle('ocr:recognizeBatch', async (event, imagePaths) => {
  const results = []
  for (const imagePath of imagePaths) {
    try {
      const result = await ocr.recognize(imagePath)
      results.push({ success: true, data: result, imagePath })
    } catch (err) {
      results.push({ success: false, error: err.message, imagePath })
    }
  }
  return results
})

// ==================== 数据库操作 ====================

// 插入记录
ipcMain.handle('db:insert', async (event, record) => {
  return db.insert(record)
})

// 更新记录
ipcMain.handle('db:update', async (event, id, record) => {
  return db.update(id, record)
})

// 删除记录
ipcMain.handle('db:delete', async (event, id) => {
  return db.delete(id)
})

// 批量删除
ipcMain.handle('db:deleteBatch', async (event, ids) => {
  return db.deleteBatch(ids)
})

// 查询单条记录
ipcMain.handle('db:getById', async (event, id) => {
  return db.getById(id)
})

// 查询所有记录
ipcMain.handle('db:getAll', async () => {
  return db.getAll()
})

// 条件查询
ipcMain.handle('db:search', async (event, conditions) => {
  return db.search(conditions)
})

// 获取统计信息
ipcMain.handle('db:getStatistics', async (event, params) => {
  return db.getStatistics(params)
})

// 获取图片文件（用于查看原图）
ipcMain.handle('image:read', async (event, imagePath) => {
  try {
    if (fs.existsSync(imagePath)) {
      // 读取文件并转为base64
      const data = fs.readFileSync(imagePath)
      const ext = path.extname(imagePath).toLowerCase().replace('.', '')
      const mimeType = ext === 'png' ? 'image/png' : ext === 'bmp' ? 'image/bmp' : ext === 'webp' ? 'image/webp' : ext === 'tiff' ? 'image/tiff' : 'image/jpeg'
      return `data:image/${mimeType};base64,${data.toString('base64')}`
    }
    return null
  } catch (err) {
    console.error('读取图片失败:', err)
    return null
  }
})

// 获取统计数据
ipcMain.handle('db:getLeaveTypeStats', async () => {
  return db.getLeaveTypeStats()
})

ipcMain.handle('db:getDepartmentStats', async () => {
  return db.getDepartmentStats()
})

ipcMain.handle('db:getMonthlyTrend', async (event, year) => {
  return db.getMonthlyTrend(year || '')
})

ipcMain.handle('db:getPersonRanking', async (event, year) => {
  return db.getPersonRanking(year || '')
})

ipcMain.handle('db:getAvailableYears', async () => {
  return db.getAvailableYears()
})

// ==================== 设置管理 ====================

// 获取所有设置
ipcMain.handle('settings:getAll', async () => {
  return settings.getAll()
})

// 获取单个设置
ipcMain.handle('settings:get', async (event, key) => {
  return settings.get(key)
})

// 更新单个设置
ipcMain.handle('settings:set', async (event, key, value) => {
  const result = settings.set(key, value)
  // 更新OCR引擎的设置
  if (ocr) ocr.updateSettings(settings.getAll())
  return result
})

// 批量更新设置
ipcMain.handle('settings:updateAll', async (event, newSettings) => {
  const result = settings.updateAll(newSettings)
  if (ocr) ocr.updateSettings(settings.getAll())
  return result
})

// 测试腾讯云API连接
ipcMain.handle('settings:testTencent', async (event, { secretId, secretKey, region }) => {
  try {
    const tencentcloud = require('tencentcloud-sdk-nodejs-ocr')
    const OcrClient = tencentcloud.ocr.v20181119.Client
    const client = new OcrClient({
      credential: { secretId, secretKey },
      region: region || 'ap-guangzhou',
      profile: { httpProfile: { endpoint: 'ocr.tencentcloudapi.com', reqTimeout: 10 } }
    })
    // 调用API获取账户信息来验证密钥
    await client.GeneralHandwritingOCR({
      ImageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    })
    return { success: false, error: 'UNEXPECTED' } // 这不应该成功
  } catch (err) {
    // 如果错误是认证失败，说明网络通了但密钥不对
    // 如果是其他错误（如图片太小），说明密钥有效
    const authErrors = ['AuthFailure', 'UnauthorizedOperation', 'InvalidParameterValue.SecretId']
    const msg = err.message || ''
    if (authErrors.some(e => msg.includes(e))) {
      return { success: false, error: '密钥验证失败，请检查SecretId和SecretKey是否正确' }
    }
    // 其他错误（如参数错误）说明API调用通了
    if (msg.includes('ImageSize') || msg.includes('ImageBase64') || msg.includes('Parameter') || msg.includes('download')) {
      return { success: true, message: 'API连接成功，密钥验证通过' }
    }
    return { success: false, error: `连接失败: ${msg}` }
  }
})

// ==================== 员工管理 ====================

ipcMain.handle('db:getAllEmployees', async () => {
  return db.getAllEmployees()
})

ipcMain.handle('db:getActiveEmployees', async () => {
  return db.getActiveEmployees()
})

ipcMain.handle('db:getDistinctDepartments', async () => {
  return db.getDistinctDepartments()
})

ipcMain.handle('db:insertEmployee', async (event, record) => {
  return db.insertEmployee(record)
})

ipcMain.handle('db:insertEmployeesBatch', async (event, records) => {
  return db.insertEmployeesBatch(records)
})

ipcMain.handle('db:updateEmployee', async (event, id, record) => {
  return db.updateEmployee(id, record)
})

ipcMain.handle('db:deleteEmployee', async (event, id) => {
  return db.deleteEmployee(id)
})

ipcMain.handle('db:deleteEmployeesBatch', async (event, ids) => {
  return db.deleteEmployeesBatch(ids)
})

ipcMain.handle('db:searchEmployees', async (event, conditions) => {
  return db.searchEmployees(conditions)
})

ipcMain.handle('db:getEmployeeCount', async () => {
  return db.getEmployeeCount()
})

ipcMain.handle('db:getBirthdayByMonth', async (event, month) => {
  return db.getBirthdayByMonth(month)
})

ipcMain.handle('db:getBirthdayByRange', async (event, startMonth, endMonth) => {
  return db.getBirthdayByRange(startMonth, endMonth)
})

ipcMain.handle('db:getBirthdayCountByMonth', async (event, month) => {
  return db.getBirthdayCountByMonth(month)
})

ipcMain.handle('db:getBirthdayStats', async () => {
  return db.getBirthdayStats()
})

// 测试阿里云百炼 DashScope API连接
ipcMain.handle('settings:testDashScope', async (event, { apiKey }) => {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-vl-plus-2025-05-07',
        messages: [
          { role: 'user', content: '你好，请回复"连接成功"' }
        ],
        max_tokens: 10
      })
    })
    if (response.ok) {
      return { success: true, message: 'API连接成功，密钥验证通过' }
    }
    const errText = await response.text().catch(() => '')
    let errMsg = errText
    try {
      errMsg = JSON.parse(errText).error?.message || errText
    } catch {}
    if (errMsg.includes('auth') || errMsg.includes('key') || errMsg.includes('token') || errMsg.includes('unauthorized') || errMsg.includes('InvalidApiKey')) {
      return { success: false, error: '密钥验证失败，请检查API Key是否正确' }
    }
    return { success: false, error: `连接失败: ${errMsg}` }
  } catch (err) {
    return { success: false, error: `连接失败: ${err.message}` }
  }
})

// 测试智谱AI GLM API连接
ipcMain.handle('settings:testGlm', async (event, { apiKey }) => {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4.6v-flash',
        messages: [
          { role: 'user', content: '你好，请回复"连接成功"' }
        ],
        max_tokens: 10
      })
    })
    if (response.ok) {
      return { success: true, message: 'API连接成功，密钥验证通过' }
    }
    const errText = await response.text().catch(() => '')
    let errMsg = errText
    try {
      errMsg = JSON.parse(errText).error?.message || errText
    } catch {}
    if (errMsg.includes('auth') || errMsg.includes('key') || errMsg.includes('token') || errMsg.includes('unauthorized')) {
      return { success: false, error: '密钥验证失败，请检查API Key是否正确' }
    }
    return { success: false, error: `连接失败: ${errMsg}` }
  } catch (err) {
    return { success: false, error: `连接失败: ${err.message}` }
  }
})

// ==================== 登录密码管理 ====================

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

ipcMain.handle('password:set', async (event, password) => {
  const hashed = hashPassword(password)
  settings.set('loginPassword', hashed)
  return true
})

ipcMain.handle('password:verify', async (event, password) => {
  const stored = settings.get('loginPassword')
  if (!stored) return true
  return hashPassword(password) === stored
})

ipcMain.handle('password:isSet', async () => {
  const stored = settings.get('loginPassword')
  return !!stored
})

ipcMain.handle('password:setAdmin', async (event, password) => {
  const hashed = password ? hashPassword(password) : ''
  settings.set('adminPassword', hashed)
  return true
})

ipcMain.handle('password:verifyAdmin', async (event, password) => {
  const stored = settings.get('adminPassword')
  if (!stored) return true
  return hashPassword(password) === stored
})

// ==================== 备份与同步 ====================

// 导出备份
ipcMain.handle('backup:export', async () => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出数据备份',
      defaultPath: `请假数据备份_${new Date().toISOString().slice(0, 10)}.zip`,
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }

    const buffer = backupManager.createBackup()
    fs.writeFileSync(result.filePath, buffer)
    return { success: true, filePath: result.filePath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// 导入备份
ipcMain.handle('backup:import', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择备份文件',
      filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true }

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: '确认导入备份',
      message: '导入备份将完全替换当前所有数据（请假记录、员工花名册、图片），此操作不可撤销。',
      detail: '建议先导出一份当前数据的备份。',
      buttons: ['取消', '确定导入'],
      defaultId: 0,
      cancelId: 0
    })
    if (response !== 1) return { success: false, canceled: true }

    const restoreResult = await backupManager.restore(result.filePaths[0])

    // 重新加载设置到 settings store
    if (settings) settings.load()
    if (ocr) ocr.updateSettings(settings.getAll())

    return restoreResult
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ==================== 应用生命周期 ====================

app.whenReady().then(async () => {
  await initializeServices()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (db) {
    db.close()
  }
})
