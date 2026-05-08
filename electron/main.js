const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const Database = require('./database')
const OcrEngine = require('./ocr')
const SettingsStore = require('./settings')

// 判断是否为开发环境
const isDev = process.env.NODE_ENV === 'development'

let mainWindow = null
let db = null
let ocr = null
let settings = null

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: '包融媒人力智慧管理系统',
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
